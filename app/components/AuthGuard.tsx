'use client';

import { useAuth } from '../context/AuthContext';
import LoginScreen from './LoginScreen';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  // Mientras se carga la sesión guardada, mostrar splash
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#800020]">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-5 border border-white/20 shadow-xl"
        >
          <motion.span 
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="text-4xl font-black text-white"
          >
            RIV
          </motion.span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Loader2 size={28} className="text-white/60 animate-spin mt-4" />
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
