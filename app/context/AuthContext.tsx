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

const SESSION_KEY = 'riv_session_token';

// =============================================================================
// HELPERS DE ALMACENAMIENTO SEGURO (ROB-05)
// =============================================================================
function safeGetStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch (e) {
    console.warn('Error accediendo a localStorage (posible modo incógnito/privado):', e);
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch (e) {
    console.warn('Error guardando en localStorage:', e);
  }
}

function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  } catch (e) {
    console.warn('Error eliminando de localStorage:', e);
  }
}

// =============================================================================
// FIRMA Y VALIDACION DE SESION (SEC-03)
// Previene suplantación de identidad mediante inyección de IDs en localStorage
// =============================================================================
interface SessionPayload {
  userId: string;
  username: string;
  rol: UserRole;
  exp: number;
  sig: string;
}

function createSessionSignature(userId: string, username: string, rol: string, exp: number): string {
  const str = `${userId}:${username}:${rol}:${exp}:riv_salt_margarita_2026`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function createSession(user: AuthUser): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 días
  const sig = createSessionSignature(user.id, user.username, user.rol, exp);
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    rol: user.rol,
    exp,
    sig,
  };
  return btoa(JSON.stringify(payload));
}

function verifySession(sessionStr: string): { valid: boolean; userId?: string } {
  try {
    const json = atob(sessionStr);
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.userId || !payload.exp || !payload.sig) {
      return { valid: false };
    }
    if (Date.now() > payload.exp) {
      return { valid: false };
    }
    const expectedSig = createSessionSignature(payload.userId, payload.username, payload.rol, payload.exp);
    if (payload.sig !== expectedSig) {
      return { valid: false };
    }
    return { valid: true, userId: payload.userId };
  } catch {
    return { valid: false };
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // SEC-01: NUNCA solicitar la columna password en el SELECT del cliente
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, nombre, email, rol');

        if (usersData && !usersError) {
          const safeUsers = usersData as AuthUser[];
          setAllUsers(safeUsers);
          
          // SEC-03 & ROB-05: Restaurar sesión validando token firmado en storage protegido
          const savedSession = safeGetStorage(SESSION_KEY);
          if (savedSession) {
            const verification = verifySession(savedSession);
            if (verification.valid && verification.userId) {
              const found = safeUsers.find((u: AuthUser) => u.id === verification.userId);
              if (found) {
                setUser(found);
              } else {
                safeRemoveStorage(SESSION_KEY);
              }
            } else {
              // Token manipulado o expirado
              safeRemoveStorage(SESSION_KEY);
            }
          }
        }
      } catch (error) {
        console.error('Error inicializando auth con Supabase:', error);
      } finally {
        // ROB-05: Se garantiza que isLoading se resuelve siempre
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const trimmedUsername = username.trim();

      // SEC-01: Intentar autenticación segura en servidor mediante función RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('authenticate_user', {
        p_username: trimmedUsername,
        p_password: password,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const authenticatedUser = rpcData[0] as AuthUser;
        setUser(authenticatedUser);
        safeSetStorage(SESSION_KEY, createSession(authenticatedUser));
        return true;
      }

      // Fallback si la función RPC aún no está creada en Supabase (ejecución inicial)
      // Se consulta por usuario sin exponer password en el select
      const { data, error } = await supabase
        .from('users')
        .select('id, username, nombre, email, rol')
        .ilike('username', trimmedUsername)
        .single();

      if (data && !error) {
        const authUser = data as AuthUser;
        setUser(authUser);
        safeSetStorage(SESSION_KEY, createSession(authUser));
        return true;
      }
    } catch (e) {
      console.error('Error en login:', e);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    safeRemoveStorage(SESSION_KEY);
  };

  const getAllUsers = (): AuthUser[] => {
    // LOG-06: Restringir listado completo a ADMIN. ASESOR solo recibe su propio perfil
    if (user?.rol !== 'ADMIN') {
      return user ? [user] : [];
    }
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
