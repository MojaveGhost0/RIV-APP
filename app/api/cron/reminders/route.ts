export const dynamic = 'force-dynamic';
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

export async function GET(request: Request) {
  try {
    // 1. Verify Authorization (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Fetch pending appointments that haven't been reminded
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('estado', 'Pendiente')
      .neq('reminder_sent', true);

    if (fetchError) {
      console.error('Error fetching appointments:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ message: 'No pending reminders' });
    }

    // Fetch all users to map names to emails
    const { data: users, error: userError } = await supabase.from('users').select('email, nombre');
    if (userError) throw userError;

    const now = new Date();
    // Assuming appointments are stored in Venezuela time, we should compare appropriately.
    // To keep it simple, we treat `fecha` + `hora` as a local date string.
    let remindersSentCount = 0;

    for (const app of appointments) {
      const appDate = new Date(`${app.fecha}T${app.hora}:00`); // e.g. 2026-09-15T14:30:00
      
      // Calculate time difference in hours
      const diffMs = appDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // If the appointment is within the next 2.5 hours and hasn't passed yet
      // (Using 2.5 hours to give a safe buffer for a cron running every hour)
      if (diffHours > 0 && diffHours <= 2.5) {
        
        // Find emails
        const assignedEmails = users
          .filter(u => app.asesores && app.asesores.includes(u.nombre))
          .map(u => u.email)
          .filter(Boolean);

        if (assignedEmails.length > 0) {
          const formattedDate = appDate.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const formattedTime = appDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #D4AF37; padding: 20px; text-align: center;">
                <h2 style="color: white; margin: 0;">RECORDATORIO DE CITA</h2>
              </div>
              <div style="padding: 30px; background-color: #f9fafb;">
                <p style="font-size: 16px; color: #333;">Hola, tienes una cita programada para las próximas horas.</p>
                <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #D4AF37; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 20px;">
                  <p style="margin: 0 0 10px 0;"><strong>Motivo:</strong> ${app.titulo}</p>
                  <p style="margin: 0 0 10px 0;"><strong>Tipo:</strong> ${app.tipo}</p>
                  <p style="margin: 0 0 10px 0;"><strong>Cliente:</strong> ${app.cliente || 'No especificado'}</p>
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

          await transporter.sendMail({
            from: '"RIV Margarita CRM" <' + process.env.GMAIL_USER + '>',
            to: assignedEmails.join(','),
            subject: `Recordatorio: Cita en menos de 2 horas - ${app.titulo}`,
            html: htmlContent,
          });
        }

        // Mark as sent
        await supabase.from('appointments').update({ reminder_sent: true }).eq('id', app.id);
        remindersSentCount++;
      }
    }

    return NextResponse.json({ success: true, message: `Processed ${appointments.length} appointments. Reminders sent: ${remindersSentCount}` });
  } catch (error: any) {
    console.error('Cron reminder error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
