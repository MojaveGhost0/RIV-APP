'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants } from '../lib/motion';
import BrandLogo from './BrandLogo';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setError('');
    setIsLoading(true);

    // Pequeño delay para sensación háptica y feedback visual
    await new Promise(res => setTimeout(res, 600));

    const success = await login(username, password);
    if (!success) {
      setError('Usuario o contraseña incorrectos. Intenta nuevamente.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-[#F3F4F6] relative overflow-hidden">
      
      {/* Background Decorativo (Luces y halos de lujo) */}
      <div className="absolute top-0 left-0 right-0 h-full overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-vinotinto/15 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -right-20 w-80 h-80 bg-dorado/15 rounded-full blur-3xl" 
        />
      </div>

      {/* HEADER DE BIENVENIDA VIP CON GRADIENTE DE MARCA */}
      <div className="bg-gradient-to-br from-[#590016] via-[#800020] to-[#590016] pt-14 pb-16 px-6 flex flex-col items-center relative z-10 shadow-xl border-b border-vinotinto-light/30">
        {/* Halo decorativo interno */}
        <div className="absolute -top-12 right-1/4 w-48 h-48 bg-dorado/20 rounded-full blur-2xl pointer-events-none" />

        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center p-3.5 mb-4 border border-dorado/40 shadow-2xl shadow-vinotinto/50 relative group"
        >
          <BrandLogo size="lg" variant="light" className="w-full h-full drop-shadow-md" />
        </motion.div>

        <motion.div
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-dorado-light bg-black/30 border border-dorado/30 mb-2 shadow-xs"
        >
          <Sparkles size={11} className="text-dorado" /> Acceso Exclusivo
        </motion.div>
        
        <motion.h1 
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-2xl sm:text-3xl font-extrabold text-white text-center leading-tight tracking-tight drop-shadow-md"
        >
          RIV Margarita Premier
        </motion.h1>
        
        <motion.p 
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/80 text-xs sm:text-sm mt-1 text-center font-medium"
        >
          Sistema de Gestión Inmobiliaria de Alto Nivel
        </motion.p>
      </div>

      {/* SEPARADOR CURVO CON SOMBRA SUAVE */}
      <div className="relative -mt-6 z-20 px-4">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl shadow-gray-200/60 border border-gray-100"
        >
          <motion.div variants={itemVariants} className="text-center mb-6">
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              Ingreso de Asesores
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Ingresa tus credenciales autorizadas</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* CAMPO USUARIO */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 ml-1">Usuario</label>
              <div className="relative group">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-vinotinto transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="Ej: tu_nombre"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50/70 border border-gray-200/80 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-vinotinto/20 focus:border-vinotinto transition-all shadow-xs"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
            </motion.div>

            {/* CAMPO CONTRASEÑA */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 ml-1">Contraseña</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-vinotinto transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-gray-50/70 border border-gray-200/80 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-vinotinto/20 focus:border-vinotinto transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </motion.div>

            {/* MENSAJE DE ERROR ANIMADO */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200/80 rounded-xl px-3.5 py-2.5 mt-1 shadow-xs">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 font-semibold leading-snug">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTÓN DE ACCESO */}
            <motion.div variants={itemVariants} className="pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-vinotinto/25 hover:shadow-xl hover:shadow-vinotinto/35 disabled:opacity-70 flex items-center justify-center gap-2 transition-all relative overflow-hidden border border-white/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Verificando acceso...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} className="text-dorado-light" />
                    <span>Ingresar al Sistema</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          </form>
        </motion.div>
      </div>

      {/* FOOTER */}
      <div className="p-4 relative z-10 text-center">
        <p className="text-[11px] text-gray-400 font-medium">
          RIV Margarita Premier · v1.0 • Plataforma Privada
        </p>
      </div>
    </div>
  );
}

