'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// =============================================================================
// TIPOS
// =============================================================================
export type UserRole = 'ADMIN' | 'ASESOR';

export interface AuthUser {
  id: string;
  username: string;
  nombre: string;
  email: string;
  rol: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isAsesor: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  getAllUsers: () => AuthUser[];
}

// =============================================================================
// BASE DE DATOS DE USUARIOS
// Para agregar un nuevo usuario, copia uno de los bloques de abajo,
// cambia el id, username, password, nombre, email y rol.
// =============================================================================
const USERS_DB: Array<AuthUser & { password: string }> = [
  {
    id: 'usr-001',
    username: 'gerardo garcia',
    password: 'Juan1234',
    nombre: 'Gerardo Garcia',
    email: 'admin@rivmargarita.com',
    rol: 'ADMIN',
  },
  {
    id: 'usr-002',
    username: 'Juan Garcia',
    password: 'mumu1234',
    nombre: 'Juan García',
    email: 'juan.garcia@rivmargarita.com',
    rol: 'ASESOR',
  },
  {
    id: 'usr-003',
    username: 'amado lovera',
    password: '123456',
    nombre: 'Amado Lovera',
    email: 'amadolovera@rivmargarita.com',
    rol: 'ASESOR',
  },
  // ── AÑADE MÁS USUARIOS AQUÍ ───────────────────────────────────────────────
  // {
  //   id: 'usr-003',
  //   username: 'nuevo_usuario',
  //   password: 'su_contraseña123',
  //   nombre: 'Nombre Completo',
  //   email: 'correo@rivmargarita.com',
  //   rol: 'ASESOR', // o 'ADMIN'
  // },
];

const SESSION_KEY = 'riv_session_user_id';

// =============================================================================
// CONTEXT
// =============================================================================
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al iniciar, recuperar sesión guardada del localStorage
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(SESSION_KEY);
      if (savedId) {
        const found = USERS_DB.find(u => u.id === savedId);
        if (found) {
          const { password: _, ...safeUser } = found;
          setUser(safeUser);
        }
      }
    } catch (_) { }
    setIsLoading(false);
  }, []);

  const login = (username: string, password: string): boolean => {
    // Búsqueda insensible a mayúsculas en username
    const found = USERS_DB.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (found) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      try { localStorage.setItem(SESSION_KEY, found.id); } catch (_) { }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { }
  };

  const getAllUsers = (): AuthUser[] => {
    return USERS_DB.map(({ password: _, ...u }) => u);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.rol === 'ADMIN',
      isAsesor: user?.rol === 'ASESOR',
      isLoading,
      login,
      logout,
      getAllUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un <AuthProvider>');
  }
  return context;
}
