/**
 * Utilidades de fecha/hora para citas.
 * Centraliza la lógica de "¿la cita ya pasó?" para que Dashboard y Agenda
 * usen exactamente el mismo criterio.
 */
import { useEffect, useState } from 'react';

interface CitaFechaHora {
  fecha: string; // 'YYYY-MM-DD'
  hora?: string; // 'HH:mm' | 'HH:mm:ss' | 'h:mm AM/PM'
}

/** Convierte fecha + hora de la cita a un Date en hora local. */
export function getCitaDate(cita: CitaFechaHora): Date | null {
  if (!cita.fecha) return null;
  const [y, m, d] = cita.fecha.split('-').map(Number);
  if (!y || !m || !d) return null;

  let hours = 23;
  let minutes = 59; // Sin hora válida → se considera vigente todo el día
  const match = cita.hora?.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s*m\.?)?$/i);
  if (match) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
    const meridiem = match[3]?.toLowerCase().replace(/[\s.]/g, '');
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  const date = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

/** Timestamp ordenable (las citas sin fecha válida van al final). */
export function getCitaTime(cita: CitaFechaHora): number {
  return getCitaDate(cita)?.getTime() ?? Number.POSITIVE_INFINITY;
}

/** true si la fecha/hora de la cita ya pasó respecto a `now`. */
export function isCitaPasada(cita: CitaFechaHora, now: number = Date.now()): boolean {
  const date = getCitaDate(cita);
  return date ? date.getTime() < now : false;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' de hoy en hora local (para el atributo `min` de <input type="date">). */
export function todayISO(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'HH:mm' actual (para el atributo `min` de <input type="time"> cuando la fecha es hoy). */
export function nowHHMM(now: number = Date.now()): string {
  const d = new Date(now);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Valida fecha + hora de una cita nueva / reprogramada.
 * Devuelve un mensaje de error en español, o null si es válida.
 */
export function validarFechaHoraCita(fecha: string, hora: string, now: number = Date.now()): string | null {
  if (!fecha) return 'Selecciona la fecha de la cita.';
  if (!hora?.trim()) return 'Indica la hora de la cita.';
  const date = getCitaDate({ fecha, hora });
  if (!date) return 'La fecha u hora ingresada no es válida.';
  // Margen de 1 min para no rechazar una cita creada "para ahora mismo"
  if (date.getTime() < now - 60_000) return 'No puedes agendar una cita en una fecha u hora que ya pasó.';
  return null;
}

/**
 * Hook que devuelve el timestamp actual y se refresca periódicamente,
 * para que una cita pase de "Próximas" a "Histórico" sin recargar la página.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
