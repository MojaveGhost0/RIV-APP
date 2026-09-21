'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
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

    // Small delay for UX feel
    await new Promise(res => setTimeout(res, 600));

    const success = await login(username, password);
    if (!success) {
      setError('Usuario o contraseña incorrectos. Intenta nuevamente.');
    }
    setIsLoading(false);
  };


  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 relative overflow-hidden">
      
      {/* Background Decorativo (Glassmorphism Blobs) */}
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-72 h-72 bg-rose-500/30 rounded-full blur-3xl mix-blend-multiply" 
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, -40, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 -right-10 w-64 h-64 bg-red-700/30 rounded-full blur-3xl mix-blend-multiply" 
        />
      </div>

      {/* HEADER VINOTINTO (Con Gradiente Premium) */}
      <div className="bg-gradient-to-br from-[#800020] via-[#990026] to-[#4a0012] pt-16 pb-14 px-8 flex flex-col items-center relative z-10 shadow-lg">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center p-3 mb-5 border border-white/20 shadow-xl"
        >
          <BrandLogo size="lg" variant="light" className="w-full h-full" />
        </motion.div>
        
        <motion.h1 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-extrabold text-white text-center leading-tight drop-shadow-md"
        >
          RIV Margarita Premier
        </motion.h1>
        
        <motion.p 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/80 text-sm mt-1 text-center font-medium"
        >
          Sistema de Gestión Inmobiliaria
        </motion.p>
      </div>

      {/* WAVE SEPARATOR */}
      <div className="bg-gradient-to-br from-[#4a0012] to-[#800020] h-8 relative z-10">
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-[2rem] shadow-[0_-10px_20px_rgba(0,0,0,0.1)]" />
      </div>

      {/* FORMULARIO */}
      <div className="flex-1 px-6 pt-8 pb-10 relative z-10 flex flex-col">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md mx-auto"
        >
          <motion.h2 variants={itemVariants} className="text-xl font-bold text-gray-800 mb-6 text-center">
            Iniciar Sesión
          </motion.h2>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            
            {/* CAMPO USUARIO */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Usuario</label>
              <div className="relative group">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#800020] transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="Ingresa tu usuario"
                  className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]/40 focus:border-[#800020] transition-all shadow-sm"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
            </motion.div>

            {/* CAMPO CONTRASEÑA */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Contraseña</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#800020] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Ingresa tu contraseña"
                  className="w-full pl-10 pr-11 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]/40 focus:border-[#800020] transition-all shadow-sm"
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

            {/* ERROR MESSAGE ANIMATED */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-2 shadow-sm">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 font-medium leading-tight">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SUBMIT BUTTON */}
            <motion.div variants={itemVariants} className="pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-[#800020] to-[#b3002d] text-white rounded-xl font-bold text-base shadow-lg shadow-[#800020]/30 disabled:opacity-70 flex items-center justify-center gap-2 transition-all relative overflow-hidden"
              >
                {/* Efecto de brillo interior (glass) */}
                <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  'Ingresar al Sistema'
                )}
              </motion.button>
            </motion.div>
          </form>

          <motion.p variants={itemVariants} className="text-center text-xs text-gray-400 mt-10">
            RIV Margarita Premier · v1.0{'\n'}Sistema de uso exclusivo interno
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
