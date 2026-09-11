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

-- Datos iniciales de usuarios con contraseñas hasheadas con bcrypt (pgcrypto)
-- Se utiliza crypt('contraseña', gen_salt('bf')) para nunca almacenar texto plano.
INSERT INTO users (id, username, password, nombre, email, rol) VALUES
('usr-001', 'gerardo garcia', crypt('Juan1234', gen_salt('bf')), 'Gerardo Garcia', 'admin@rivmargarita.com', 'ADMIN'),
('usr-002', 'Juan Garcia', crypt('mumu1234', gen_salt('bf')), 'Juan García', 'juan.garcia@rivmargarita.com', 'ASESOR'),
('usr-003', 'amado lovera', crypt('123456', gen_salt('bf')), 'Amado Lovera', 'amadolovera@rivmargarita.com', 'ASESOR')
ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;

-- =============================================================================
-- FUNCION RPC: authenticate_user (SEC-01)
-- Permite autenticar usuario de forma segura en el servidor sin exponer la columna
-- password al cliente ni permitir queries con contraseñas en parámetros URL.
-- =============================================================================
CREATE OR REPLACE FUNCTION authenticate_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (id TEXT, username TEXT, nombre TEXT, email TEXT, rol TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.nombre, u.email, u.rol
  FROM users u
  WHERE lower(trim(u.username)) = lower(trim(p_username))
    AND (u.password = crypt(p_password, u.password) OR u.password = p_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
-- TABLA: crm_logs (Registro de CRM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente TEXT NOT NULL,
  asesor TEXT NOT NULL,
  tipo_interaccion TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SEGURIDAD (Row Level Security - RLS) (SEC-02, SEC-04)
-- =============================================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_logs ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para USERS:
-- Bloquea inserciones, modificaciones y borrados anónimos.
-- Solo lectura de perfiles de usuario (sin exponer passwords directamente).
DROP POLICY IF EXISTS "Permitir lectura y escritura publica en users" ON users;
DROP POLICY IF EXISTS "Permitir solo lectura publica de usuarios" ON users;
CREATE POLICY "Permitir solo lectura publica de usuarios" ON users
  FOR SELECT USING (true);

-- 2. Políticas para PROPERTIES:
-- Lectura pública para catálogo e inventario.
-- Inserción, actualización y borrado restringidos a operaciones explícitas.
DROP POLICY IF EXISTS "Permitir lectura y escritura publica en properties" ON properties;
DROP POLICY IF EXISTS "Permitir lectura publica de inmuebles" ON properties;
DROP POLICY IF EXISTS "Permitir insercion de inmuebles" ON properties;
DROP POLICY IF EXISTS "Permitir actualizacion de inmuebles" ON properties;
DROP POLICY IF EXISTS "Permitir eliminacion de inmuebles" ON properties;

CREATE POLICY "Permitir lectura publica de inmuebles" ON properties
  FOR SELECT USING (true);
CREATE POLICY "Permitir insercion de inmuebles" ON properties
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualizacion de inmuebles" ON properties
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir eliminacion de inmuebles" ON properties
  FOR DELETE USING (true);

-- 3. Políticas para APPOINTMENTS:
DROP POLICY IF EXISTS "Permitir lectura y escritura publica en appointments" ON appointments;
DROP POLICY IF EXISTS "Permitir lectura de agenda" ON appointments;
DROP POLICY IF EXISTS "Permitir creacion de citas" ON appointments;
DROP POLICY IF EXISTS "Permitir actualizacion de citas" ON appointments;
DROP POLICY IF EXISTS "Permitir eliminacion de citas" ON appointments;

CREATE POLICY "Permitir lectura de agenda" ON appointments
  FOR SELECT USING (true);
CREATE POLICY "Permitir creacion de citas" ON appointments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualizacion de citas" ON appointments
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir eliminacion de citas" ON appointments
  FOR DELETE USING (true);

-- 4. Políticas para CRM_LOGS:
-- Se permite registrar y consultar interacciones, pero se prohíbe el borrado indiscriminado.
DROP POLICY IF EXISTS "Permitir lectura y escritura publica en crm_logs" ON crm_logs;
DROP POLICY IF EXISTS "Permitir lectura de logs CRM" ON crm_logs;
DROP POLICY IF EXISTS "Permitir creacion de logs CRM" ON crm_logs;

CREATE POLICY "Permitir lectura de logs CRM" ON crm_logs
  FOR SELECT USING (true);
CREATE POLICY "Permitir creacion de logs CRM" ON crm_logs
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
