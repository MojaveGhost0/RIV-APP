import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const RESET_SECRET = process.env.CRON_SECRET || 'riv_margarita_reset_secret_2026';

interface ResetTokenPayload {
  userId: string;
  email: string;
  exp: number;
}

function signResetToken(payload: ResetTokenPayload): string {
  const dataB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', RESET_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

function verifyResetToken(token: string): ResetTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [dataB64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', RESET_SECRET).update(dataB64).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf-8')) as ResetTokenPayload;
    if (!payload.userId || !payload.email || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

const DEFAULT_FALLBACK_USERS = [
  { id: 'usr-001', username: 'gerardo garcia', nombre: 'Gerardo Garcia', email: 'admin@rivmargarita.com' },
  { id: 'usr-002', username: 'Juan Garcia', nombre: 'Juan García', email: 'juan.garcia@rivmargarita.com' },
  { id: 'usr-003', username: 'amado lovera', nombre: 'Amado Lovera', email: 'amadolovera@rivmargarita.com' },
];

/**
 * POST /api/auth/reset-password
 * Acción 1: { action: 'request', identifier: 'email o usuario', origin: 'https://...' }
 *   -> Busca el usuario en `users` (por email o username) o permite enviar al Gmail ingresado,
 *      genera un token HMAC válido por 1 hora y envía el correo real vía Gmail (nodemailer).
 * Acción 2: { action: 'verify', token: '...' }
 *   -> Valida si el token HMAC es auténtico y no ha expirado.
 * Acción 3: { action: 'confirm', token: '...', newPassword: '...' }
 *   -> Valida el token y actualiza la contraseña en la tabla `users` de Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── ACCIÓN 2: VERIFICAR TOKEN ────────────────────────────────────────────
    if (action === 'verify') {
      const payload = verifyResetToken(body.token || '');
      if (!payload) {
        return NextResponse.json({ valid: false, error: 'El enlace de recuperación es inválido o ha expirado.' }, { status: 400 });
      }
      return NextResponse.json({ valid: true, email: payload.email, userId: payload.userId });
    }

    // ── ACCIÓN 3: CONFIRMAR Y GUARDAR NUEVA CONTRASEÑA ───────────────────────
    if (action === 'confirm') {
      const { token, newPassword } = body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
      }

      const payload = verifyResetToken(token || '');
      if (!payload) {
        return NextResponse.json({ error: 'El enlace de recuperación es inválido o ha expirado.' }, { status: 400 });
      }

      const cleanPass = newPassword.trim();

      // 1. Intentar actualizar vía RPC si existe, o directamente en tabla `users`
      let updated = false;
      try {
        const { error: rpcErr } = await supabase.rpc('reset_user_password', {
          p_user_id: payload.userId,
          p_new_password: cleanPass,
        });
        if (!rpcErr) updated = true;
      } catch {
        // continuar con update directo
      }

      if (!updated) {
        const { error: updateErr } = await supabase
          .from('users')
          .update({ password: cleanPass })
          .eq('id', payload.userId);

        if (updateErr) {
          // Intentar por email como respaldo
          await supabase
            .from('users')
            .update({ password: cleanPass })
            .ilike('email', payload.email);
        }
      }

      return NextResponse.json({
        success: true,
        userId: payload.userId,
        email: payload.email,
      });
    }

    // ── ACCIÓN 1 (DEFAULT): SOLICITAR ENVÍO DE CORREO DE RECUPERACIÓN ────────
    const rawIdentifier = (body.email || body.identifier || '').trim();
    if (!rawIdentifier) {
      return NextResponse.json({ error: 'Ingresa tu correo electrónico o nombre de usuario.' }, { status: 400 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { error: 'El servidor de correo (GMAIL_USER / GMAIL_PASS) no está configurado.' },
        { status: 500 }
      );
    }

    // Buscar el usuario en la tabla `users` por email o por username/nombre
    let matchedUser: { id: string; username: string; nombre: string; email: string } | null = null;

    const { data: usersList } = await supabase
      .from('users')
      .select('id, username, nombre, email');

    const pool = (usersList && usersList.length > 0) ? usersList : DEFAULT_FALLBACK_USERS;
    const lowerId = rawIdentifier.toLowerCase();

    matchedUser =
      pool.find(
        u =>
          (u.email && u.email.toLowerCase() === lowerId) ||
          (u.username && u.username.toLowerCase() === lowerId) ||
          (u.nombre && u.nombre.toLowerCase() === lowerId)
      ) || null;

    // Si el usuario ingresó un correo Gmail personal que aún no estaba actualizado en la fila,
    // pero hay un usuario o es un email válido, determinamos el destinatario real:
    let targetEmail = matchedUser?.email || (rawIdentifier.includes('@') ? rawIdentifier : '');
    let targetUserId = matchedUser?.id || 'usr-001';
    let targetName = matchedUser?.nombre || rawIdentifier;

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json(
        { error: 'No se encontró un correo electrónico válido asociado a esa cuenta.' },
        { status: 404 }
      );
    }

    // Generar token firmado con validez de 1 hora
    const token = signResetToken({
      userId: targetUserId,
      email: targetEmail,
      exp: Date.now() + 60 * 60 * 1000,
    });

    const origin = body.origin || req.nextUrl.origin || 'http://localhost:3000';
    const resetLink = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #590016 0%, #800020 100%); padding: 28px 24px; text-align: center; border-bottom: 3px solid #D4AF37;">
          <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">
            RIV MARGARITA PREMIER · RIF: J-11055496-2
          </p>
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 900;">
            Recuperación de Contraseña
          </h1>
        </div>
        <div style="padding: 32px 28px; background-color: #f9fafb; color: #1f2937;">
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
            Hola <strong>${targetName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
            Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en el sistema de gestión inmobiliaria <strong>RIV Margarita Premier</strong>.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #800020; color: #ffffff; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 12px; border: 1.5px solid #D4AF37; box-shadow: 0 4px 14px rgba(128, 0, 32, 0.25);">
              Restablecer mi Contraseña
            </a>
          </div>
          <p style="font-size: 12px; line-height: 1.5; color: #6b7280; margin: 24px 0 0 0;">
            Este enlace es válido por <strong>60 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje con total seguridad.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
            RIV Margarita Premier · RIF: J-11055496-2 · Isla de Margarita, Venezuela
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"RIV Margarita Premier" <${gmailUser}>`,
      to: targetEmail,
      subject: 'Restablecer Contraseña — RIV Margarita Premier',
      html: htmlContent,
    });

    return NextResponse.json({
      success: true,
      sentTo: targetEmail,
      message: 'Correo de recuperación enviado exitosamente.',
    });
  } catch (err: any) {
    console.error('[reset-password API] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al enviar el correo de recuperación.' },
      { status: 500 }
    );
  }
}
