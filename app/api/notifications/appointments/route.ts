import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, titulo, cliente, fecha, hora, asesores } = body;

    // 1. Fetch emails of assigned agents from Supabase
    // `asesores` is an array of names e.g. ["Juan Perez", "Maria Gomez"]
    const { data: users, error } = await supabase
      .from('users')
      .select('email, nombre');
    
    if (error) {
      console.error('Error fetching users from Supabase:', error);
      return NextResponse.json({ error: 'Failed to fetch user emails' }, { status: 500 });
    }

    // Filter to get only the emails of the assigned agents
    const assignedEmails = users
      .filter((u) => asesores.includes(u.nombre))
      .map((u) => u.email)
      .filter(Boolean);

    if (assignedEmails.length === 0) {
      return NextResponse.json({ message: 'No emails found for assigned agents' }, { status: 200 });
    }

    // 2. Format Date and Time
    const dateObj = new Date(`${fecha}T${hora}`);
    const formattedDate = dateObj.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    // 3. Compose Email Template
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #800020; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">NUEVA CITA AGENDADA</h2>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <p style="font-size: 16px; color: #333;">Hola, tienes una nueva cita programada.</p>
          <div style="background-color: white; padding: 20px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 20px;">
            <p style="margin: 0 0 10px 0;"><strong>Motivo:</strong> ${titulo}</p>
            <p style="margin: 0 0 10px 0;"><strong>Tipo:</strong> ${tipo}</p>
            <p style="margin: 0 0 10px 0;"><strong>Cliente:</strong> ${cliente || 'No especificado'}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;" />
            <p style="margin: 0 0 10px 0;">📅 <strong>Fecha:</strong> ${formattedDate}</p>
            <p style="margin: 0;">⏰ <strong>Hora:</strong> ${formattedTime}</p>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
            Sistema de Gestión CRM • RIV Margarita Premier
          </p>
        </div>
      </div>
    `;

    // 4. Send Email
    await transporter.sendMail({
      from: '"RIV Margarita CRM" <' + process.env.GMAIL_USER + '>',
      to: assignedEmails.join(','),
      subject: `Nueva Cita Agendada: ${titulo}`,
      html: htmlContent,
    });

    return NextResponse.json({ success: true, message: 'Emails sent successfully' });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
