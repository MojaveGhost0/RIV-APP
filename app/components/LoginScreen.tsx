'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2, Sparkles, ShieldCheck, Mail, ArrowLeft, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants } from '../lib/motion';
import BrandLogo from './BrandLogo';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Estados para recuperación de contraseña
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setError('');
    setIsLoading(true);

    // Pequeño delay para sensación háptica y feedback visual
    await new Promise(res => setTimeout(res, 400));

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error || 'Usuario o contraseña incorrectos. Intenta nuevamente.');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResetError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setResetError('');
    setResetLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

      // Enviar correo real de recuperación a través de nuestro endpoint con Nodemailer (Gmail SMTP)
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          email: cleanEmail,
          origin,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setResetError(data.error || 'No se pudo enviar el correo de recuperación.');
      } else {
        setResetSent(true);
      }
    } catch (err: any) {
      setResetError(err.message || 'Ocurrió un error al procesar la solicitud.');
    } finally {
      setResetLoading(false);
    }
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
          className="w-28 h-28 bg-white/95 rounded-3xl flex items-center justify-center p-3 mb-4 border border-dorado/50 shadow-2xl shadow-vinotinto/50 relative group"
        >
          <BrandLogo size="lg" className="w-full h-full drop-shadow-xs" />
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
              <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
                <label className="block text-xs font-bold text-gray-600">Contraseña</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(true);
                    setResetSent(false);
                    setResetError('');
                    setResetEmail('');
                  }}
                  className="text-xs font-semibold text-vinotinto hover:text-vinotinto-dark hover:underline transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
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
                className="w-full py-3.5 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-vinotinto/25 hover:shadow-xl hover:shadow-vinotinto/35 disabled:opacity-70 flex items-center justify-center gap-2 transition-all relative overflow-hidden border border-white/20 cursor-pointer"
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

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-gray-100 relative overflow-hidden"
            >
              {/* Encabezado del modal */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-vinotinto/10 text-vinotinto flex items-center justify-center">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Recuperar Contraseña</h3>
                    <p className="text-[11px] text-gray-500">RIV Margarita Premier</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {resetSent ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900">¡Enlace Enviado!</h4>
                    <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto leading-relaxed">
                      Hemos enviado las instrucciones a <strong className="text-gray-800">{resetEmail}</strong>. Revisa tu bandeja de entrada o carpeta de spam para restablecer tu contraseña.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Entendido, volver al ingreso
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="pt-4 space-y-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Ingresa el correo electrónico registrado con tu cuenta de asesor o administrador. Te enviaremos un enlace seguro para crear una nueva contraseña.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Correo Electrónico</label>
                    <div className="relative group">
                      <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-vinotinto transition-colors" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                        placeholder="tu-correo@rivmargarita.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-vinotinto/20 focus:border-vinotinto transition-all"
                      />
                    </div>
                  </div>

                  {resetError && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-700 font-medium">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-2.5 bg-vinotinto hover:bg-vinotinto-dark text-white text-xs font-bold rounded-xl shadow-md shadow-vinotinto/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-70 cursor-pointer"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar Enlace</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <div className="p-4 relative z-10 text-center">
        <p className="text-[11px] text-gray-400 font-medium">
          RIV Margarita Premier · v1.0 • Plataforma Privada
        </p>
      </div>
    </div>
  );
}

