-- =============================================================================
-- PROYECTO RIV — Supabase Database Setup
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLA: users (Usuarios y Roles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('ADMIN', 'ASESOR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos iniciales de usuarios (ignora si ya existen)
INSERT INTO users (id, username, password, nombre, email, rol) VALUES
('usr-001', 'gerardo garcia', 'Juan1234', 'Gerardo Garcia', 'admin@rivmargarita.com', 'ADMIN'),
('usr-002', 'Juan Garcia', 'mumu1234', 'Juan García', 'juan.garcia@rivmargarita.com', 'ASESOR'),
('usr-003', 'amado lovera', '123456', 'Amado Lovera', 'amadolovera@rivmargarita.com', 'ASESOR')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TABLA: properties (Inventario de Inmuebles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  location TEXT NOT NULL,
  beds INTEGER NOT NULL DEFAULT 0,
  baths INTEGER NOT NULL DEFAULT 0,
  sqm NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  image TEXT,
  images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Activa',
  captador TEXT NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  "propertyType" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLA: appointments (Citas y Agenda)
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  asesores TEXT[] DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SEGURIDAD (Row Level Security - RLS)
-- =============================================================================
-- Por ahora (fase 1) permitimos lectura/escritura pública anónima (usando la anon key)
-- para no interrumpir el flujo actual del AuthContext harcodeado.
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura y escritura publica en properties" ON properties;
CREATE POLICY "Permitir lectura y escritura publica en properties" ON properties
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y escritura publica en appointments" ON appointments;
CREATE POLICY "Permitir lectura y escritura publica en appointments" ON appointments
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y escritura publica en users" ON users;
CREATE POLICY "Permitir lectura y escritura publica en users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
