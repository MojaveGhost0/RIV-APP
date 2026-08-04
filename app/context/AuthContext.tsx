'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

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
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAllUsers: () => AuthUser[];
}

const SESSION_KEY = 'riv_session_user_id';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Cargar todos los usuarios (útil para asignar citas)
        const { data: usersData } = await supabase.from('users').select('*');
        if (usersData) {
          // Remover password de los datos públicos en memoria por seguridad
          const safeUsers = usersData.map(({ password, ...u }) => u as AuthUser);
          setAllUsers(safeUsers);
          
          // Restaurar sesión si existe
          const savedId = localStorage.getItem(SESSION_KEY);
          if (savedId) {
            const found = safeUsers.find((u: AuthUser) => u.id === savedId);
            if (found) setUser(found);
          }
        }
      } catch (error) {
        console.error('Error inicializando auth con Supabase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Usar ilike para búsqueda insensible a mayúsculas en el username
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', username.trim())
        .eq('password', password)
        .single();

      if (data && !error) {
        const { password: _, ...safeUser } = data;
        setUser(safeUser as AuthUser);
        localStorage.setItem(SESSION_KEY, data.id);
        return true;
      }
    } catch (e) {
      console.error('Error en login:', e);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { }
  };

  const getAllUsers = (): AuthUser[] => {
    return allUsers;
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
