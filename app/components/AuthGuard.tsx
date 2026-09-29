'use client';

import { useAuth } from '../context/AuthContext';
import LoginScreen from './LoginScreen';
import BrandLogo from './BrandLogo';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  // Mientras se carga la sesión guardada, mostrar splash oficial corporativo
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-vinotinto-dark via-vinotinto to-vinotinto-dark text-white p-6 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute w-72 h-72 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

        <motion.div 
          initial={{ scale: 0.85, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center z-10"
        >
          <div className="p-4 rounded-2xl bg-white/5 border border-white/15 backdrop-blur-md shadow-2xl mb-4">
            <BrandLogo size="lg" />
          </div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex items-center gap-2 text-white/70 text-xs font-semibold tracking-wider uppercase mt-3"
          >
            <Loader2 size={16} className="text-[#D4AF37] animate-spin" />
            <span>Cargando plataforma...</span>
          </motion.div>
        </motion.div>
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

