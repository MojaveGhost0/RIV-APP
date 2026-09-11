import { createClient } from '@supabase/supabase-js';

// =============================================================================
// SUPABASE CLIENT (SEC-04)
// SEGURIDAD: Solo debe usarse la anon key en el bundle cliente.
// NUNCA importar ni exponer SUPABASE_SERVICE_ROLE_KEY en el cliente.
// Las operaciones críticas están protegidas por RLS en el backend de Supabase.
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn('Faltan las variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY). Operando en modo offline/demo.');
  }
}

// Validación de seguridad para evitar fuga accidental de service role key
if (supabaseAnonKey && supabaseAnonKey.includes('service_role')) {
  throw new Error('ALERTA DE SEGURIDAD: La clave SUPABASE_SERVICE_ROLE_KEY no debe usarse en el cliente.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

