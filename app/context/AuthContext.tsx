'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { normalize } from '../lib/searchEngine';
import { setCustomBrandLogo, getActiveBrandLogo } from '../lib/brandConfig';

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
  telefono?: string;
  agencyLogo?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isAsesor: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAllUsers: () => AuthUser[];
  updateUserPhone: (phone: string) => Promise<void>;
  updateAgencyLogo: (logoUrl: string) => Promise<void>;
  getAdvisorPhone: (name: string) => string | undefined;
  addUser: (userData: Omit<AuthUser, 'id'> & { password?: string }) => Promise<void>;
  updateUser: (userId: string, data: Partial<AuthUser> & { password?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

const SESSION_KEY = 'riv_session_token';

// Teléfonos predeterminados de la agencia para los asesores principales
const DEFAULT_PHONES: Record<string, string> = {
  'usr-001': '0414-7901111',
  'usr-002': '0414-7902222',
  'usr-003': '0414-7903333',
};

// Usuarios predeterminados del sistema con respaldo offline/local
const DEFAULT_USERS: Array<AuthUser & { password?: string }> = [
  {
    id: 'usr-001',
    username: 'gerardo garcia',
    password: 'Juan1234',
    nombre: 'Gerardo Garcia',
    email: 'admin@rivmargarita.com',
    rol: 'ADMIN',
    telefono: '0414-7901111',
  },
  {
    id: 'usr-002',
    username: 'Juan Garcia',
    password: 'mumu1234',
    nombre: 'Juan García',
    email: 'juan.garcia@rivmargarita.com',
    rol: 'ASESOR',
    telefono: '0414-7902222',
  },
  {
    id: 'usr-003',
    username: 'amado lovera',
    password: '123456',
    nombre: 'Amado Lovera',
    email: 'amadolovera@rivmargarita.com',
    rol: 'ASESOR',
    telefono: '0414-7903333',
  },
];

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
        let safeUsers: AuthUser[] = [];

        // Consultar columnas estándar de la tabla 'users' en Supabase (evitando 'telefono' que causa error SQL si no existe en la BD)
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, nombre, email, rol');

        const savedLogo = safeGetStorage('riv_custom_agency_logo') || undefined;

        if (usersData && !usersError && usersData.length > 0) {
          safeUsers = (usersData as any[]).map(u => ({
            id: u.id,
            username: u.username,
            nombre: u.nombre,
            email: u.email,
            rol: u.rol,
            telefono: safeGetStorage(`riv_user_phone_${u.id}`) || DEFAULT_PHONES[u.id] || '',
            agencyLogo: savedLogo,
          }));
        } else {
          // Fallback a DEFAULT_USERS si la tabla o conexión no responden
          safeUsers = DEFAULT_USERS.map(({ password: _, ...u }) => ({
            ...u,
            telefono: safeGetStorage(`riv_user_phone_${u.id}`) || u.telefono || DEFAULT_PHONES[u.id] || '',
            agencyLogo: savedLogo,
          }));
        }

        if (safeUsers.length > 0) {
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
              safeRemoveStorage(SESSION_KEY);
            }
          }
        }
      } catch (error) {
        console.error('Error inicializando auth con Supabase:', error);
        const safeUsers = DEFAULT_USERS.map(({ password: _, ...u }) => ({
          ...u,
          telefono: safeGetStorage(`riv_user_phone_${u.id}`) || u.telefono || DEFAULT_PHONES[u.id] || '',
        }));
        setAllUsers(safeUsers);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const trimmedUsername = username.trim();
      const cleanPassword = password.trim();

      // 1. Intentar autenticación segura en servidor mediante función RPC si existe
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('authenticate_user', {
          p_username: trimmedUsername,
          p_password: cleanPassword,
        });

        if (!rpcError && rpcData && rpcData.length > 0) {
          const raw = rpcData[0];
          const authenticatedUser: AuthUser = {
            id: raw.id,
            username: raw.username,
            nombre: raw.nombre,
            email: raw.email,
            rol: raw.rol,
            telefono: raw.telefono || safeGetStorage(`riv_user_phone_${raw.id}`) || DEFAULT_PHONES[raw.id] || '',
          };
          setUser(authenticatedUser);
          safeSetStorage(SESSION_KEY, createSession(authenticatedUser));
          return true;
        }
      } catch (rpcErr) {
        // RPC no configurada en Supabase, continuar con la consulta directa
      }

      // 2. Consulta directa a la tabla 'users' en Supabase (solo columnas compatibles)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, password, nombre, email, rol')
          .ilike('username', trimmedUsername)
          .maybeSingle();

        if (data && !error) {
          // Comparar contraseñas (soporta texto plano tal como está en Supabase)
          if (data.password === cleanPassword || data.password === password) {
            const authUser: AuthUser = {
              id: data.id,
              username: data.username,
              nombre: data.nombre,
              email: data.email,
              rol: data.rol,
              telefono: safeGetStorage(`riv_user_phone_${data.id}`) || DEFAULT_PHONES[data.id] || '',
            };
            setUser(authUser);
            safeSetStorage(SESSION_KEY, createSession(authUser));
            return true;
          }
        }
      } catch (dbErr) {
        console.warn('Error consultando usuario en Supabase:', dbErr);
      }

      // 3. Fallback de contingencia / offline contra DEFAULT_USERS
      const defaultMatch = DEFAULT_USERS.find(
        u => normalize(u.username) === normalize(trimmedUsername) &&
             (u.password === cleanPassword || u.password === password)
      );

      if (defaultMatch) {
        const authUser: AuthUser = {
          id: defaultMatch.id,
          username: defaultMatch.username,
          nombre: defaultMatch.nombre,
          email: defaultMatch.email,
          rol: defaultMatch.rol,
          telefono: safeGetStorage(`riv_user_phone_${defaultMatch.id}`) || defaultMatch.telefono || DEFAULT_PHONES[defaultMatch.id] || '',
        };
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
    return allUsers;
  };

  const updateUserPhone = async (phone: string): Promise<void> => {
    if (!user) return;
    const cleanPhone = phone.trim();

    // Actualización reactiva instantánea
    const updatedUser = { ...user, telefono: cleanPhone };
    setUser(updatedUser);
    setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, telefono: cleanPhone } : u));
    safeSetStorage(`riv_user_phone_${user.id}`, cleanPhone);

    try {
      const { error } = await supabase
        .from('users')
        .update({ telefono: cleanPhone })
        .eq('id', user.id);

      if (error) {
        console.warn('Aviso: la columna telefono puede requerir migración en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Error guardando teléfono en Supabase:', err);
    }
  };

  const updateAgencyLogo = async (logoUrl: string): Promise<void> => {
    const cleanLogo = logoUrl.trim();
    setCustomBrandLogo(cleanLogo);
    if (user) {
      setUser({ ...user, agencyLogo: cleanLogo || undefined });
    }
    setAllUsers(prev => prev.map(u => ({ ...u, agencyLogo: cleanLogo || undefined })));
  };

  const getAdvisorPhone = (name: string): string | undefined => {
    if (!name) return undefined;
    const norm = normalize(name);
    const found = allUsers.find(u => normalize(u.nombre) === norm || normalize(u.username) === norm);
    if (found?.telefono) return found.telefono;
    const defaultUser = DEFAULT_USERS.find(u => normalize(u.nombre) === norm || normalize(u.username) === norm);
    if (defaultUser) {
      return safeGetStorage(`riv_user_phone_${defaultUser.id}`) || defaultUser.telefono || DEFAULT_PHONES[defaultUser.id];
    }
    return undefined;
  };

  const addUser = async (userData: Omit<AuthUser, 'id'> & { password?: string }) => {
    try {
      const newId = `usr-${Date.now()}`;
      const newUser = { id: newId, ...userData };
      
      const { error } = await supabase.from('users').insert([
        {
          id: newId,
          username: userData.username,
          password: userData.password || '123456',
          nombre: userData.nombre,
          email: userData.email,
          rol: userData.rol,
        }
      ]);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Update local state if DB insert succeeds
      setAllUsers(prev => [...prev, newUser as AuthUser]);
    } catch (err: any) {
      console.error('Error adding user:', err);
      throw err;
    }
  };

  const updateUser = async (userId: string, data: Partial<AuthUser> & { password?: string }) => {
    try {
      const updatePayload: any = { ...data };
      delete updatePayload.id; // Don't try to update id
      delete updatePayload.telefono; // Handle phone separately if needed
      delete updatePayload.agencyLogo;

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      setAllUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...data } : u)));
      if (user?.id === userId) {
        setUser(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (err: any) {
      console.error('Error updating user:', err);
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      console.error('Error deleting user:', err);
      throw err;
    }
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
      updateUserPhone,
      updateAgencyLogo,
      getAdvisorPhone,
      addUser,
      updateUser,
      deleteUser,
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
