'use client';

import { useAuth } from '../context/AuthContext';
import LoginScreen from './LoginScreen';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  // Mientras se carga la sesión guardada, mostrar splash
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#800020]">
        <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-5 border border-white/20">
          <span className="text-4xl font-black text-white">RIV</span>
        </div>
        <Loader2 size={28} className="text-white/60 animate-spin mt-4" />
      </div>
    );
  }

  // Si no hay sesión, mostrar el Login
  if (!user) {
    return <LoginScreen />;
  }

  // Si hay sesión, mostrar la app
  return <>{children}</>;
}
