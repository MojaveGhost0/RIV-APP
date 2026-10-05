'use client';

import { useEffect } from 'react';

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Traduce al español los mensajes de validación nativos del navegador
 * ("Please fill out this field.", etc.) para TODOS los formularios de la app,
 * sin tener que tocar cada input.
 *
 * Personalización opcional por campo:
 *   data-msg-required="..."   data-msg-min="..."   data-msg-max="..."
 *   data-msg-pattern="..."    (o el atributo `title` para pattern)
 */
function getSpanishMessage(el: FormField): string {
  const v = el.validity;
  const input = el as HTMLInputElement;
  const type = (input.type || '').toLowerCase();
  const ds = el.dataset;

  if (v.valueMissing) {
    if (ds.msgRequired) return ds.msgRequired;
    if (el.tagName === 'SELECT') return 'Por favor selecciona una opción de la lista.';
    if (type === 'checkbox') return 'Marca esta casilla para continuar.';
    if (type === 'radio') return 'Selecciona una de las opciones.';
    if (type === 'file') return 'Por favor selecciona un archivo.';
    if (type === 'date') return 'Por favor selecciona una fecha.';
    if (type === 'time') return 'Por favor indica la hora.';
    return 'Por favor completa este campo.';
  }
  if (v.badInput) {
    if (type === 'number') return 'Ingresa un número válido.';
    if (type === 'date') return 'Ingresa una fecha válida.';
    if (type === 'time') return 'Ingresa una hora válida.';
    return 'El valor ingresado no es válido.';
  }
  if (v.typeMismatch) {
    if (type === 'email') return 'Ingresa un correo electrónico válido (ej: nombre@correo.com).';
    if (type === 'url') return 'Ingresa una dirección web válida (ej: https://...).';
    return 'El formato ingresado no es válido.';
  }
  if (v.rangeUnderflow) {
    if (ds.msgMin) return ds.msgMin;
    if (type === 'date') return 'La fecha no puede ser anterior a hoy.';
    if (type === 'time') return 'La hora ya pasó. Elige una hora posterior.';
    return Number(input.min) === 0
      ? 'El valor no puede ser negativo.'
      : `El valor debe ser mayor o igual a ${input.min}.`;
  }
  if (v.rangeOverflow) {
    if (ds.msgMax) return ds.msgMax;
    return `El valor debe ser menor o igual a ${input.max}.`;
  }
  if (v.stepMismatch) {
    return input.step === '1' || !input.step
      ? 'Ingresa un número entero (sin decimales).'
      : 'Ingresa un valor válido.';
  }
  if (v.tooLong) {
    return `Máximo ${(el as HTMLInputElement).maxLength} caracteres (tienes ${el.value.length}).`;
  }
  if (v.tooShort) {
    return `Debe tener al menos ${(el as HTMLInputElement).minLength} caracteres (tienes ${el.value.length}).`;
  }
  if (v.patternMismatch) {
    return ds.msgPattern || el.title || 'El formato ingresado no es válido.';
  }
  return 'Revisa este campo.';
}

function isField(t: EventTarget | null): t is FormField {
  return !!t && typeof (t as FormField).setCustomValidity === 'function';
}

export default function SpanishValidation() {
  useEffect(() => {
    const onInvalid = (e: Event) => {
      if (!isField(e.target)) return;
      e.target.setCustomValidity(getSpanishMessage(e.target));
    };
    // Al editar, se limpia el mensaje para que el navegador re-evalúe el campo
    const onEdit = (e: Event) => {
      if (isField(e.target)) e.target.setCustomValidity('');
    };

    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onEdit, true);
      document.removeEventListener('change', onEdit, true);
    };
  }, []);

  return null;
}
