'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Sparkles, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    // Escuchar el evento de recuperación de contraseña de Supabase o validar sesión
    const checkRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionValid(true);
        }
      } catch (e) {
        console.warn('Error verificando sesión de recuperación:', e);
      } finally {
        setVerifyingSession(false);
      }
    };

    checkRecoverySession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setSessionValid(true);
        setVerifyingSession(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifica.');
      return;
    }

    setLoading(true);

    try {
      // 1. Actualizar contraseña en Supabase Auth
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        throw updateError;
      }

      // 2. Sincronizar en la tabla 'users' de la agencia para mantener consistencia de login
      if (data?.user?.email) {
        try {
          await supabase
            .from('users')
            .update({ password: password.trim() })
            .ilike('email', data.user.email);
        } catch (dbErr) {
          console.warn('Aviso: Sincronización en tabla users:', dbErr);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-[#F3F4F6] relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 right-0 h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-vinotinto/15 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-dorado/15 rounded-full blur-3xl" />
      </div>

      {/* HEADER DE MARCA */}
      <div className="bg-gradient-to-br from-[#590016] via-[#800020] to-[#590016] pt-12 pb-14 px-6 flex flex-col items-center relative z-10 shadow-xl border-b border-vinotinto-light/30">
        <div className="w-24 h-24 bg-white/95 rounded-3xl flex items-center justify-center p-3 mb-3 border border-dorado/50 shadow-2xl shadow-vinotinto/50">
          <BrandLogo size="lg" className="w-full h-full drop-shadow-xs" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-dorado-light bg-black/30 border border-dorado/30 mb-1.5">
          <Sparkles size={11} className="text-dorado" /> Seguridad & Accesos
        </div>

        <h1 className="text-2xl font-extrabold text-white text-center tracking-tight">
          Restablecer Contraseña
        </h1>
        <p className="text-white/80 text-xs mt-1 text-center font-medium">
          RIV Margarita Premier · Portal de Seguridad
        </p>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="relative -mt-6 z-20 px-4 flex-1 flex items-start justify-center">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl shadow-gray-200/60 border border-gray-100">
          {verifyingSession ? (
            <div className="py-12 text-center">
              <Loader2 size={32} className="animate-spin text-vinotinto mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Verificando enlace de seguridad...</p>
            </div>
          ) : success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-4"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">¡Contraseña Actualizada!</h3>
                <p className="text-xs text-gray-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Tu nueva contraseña ha sido establecida con éxito. Ahora puedes acceder al sistema con tus credenciales actualizadas.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/"
                  className="inline-block w-full py-3.5 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-2xl font-bold text-sm shadow-lg shadow-vinotinto/25 hover:shadow-xl transition-all text-center"
                >
                  Ir al Inicio de Sesión
                </a>
              </div>
            </motion.div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-vinotinto/10 text-vinotinto flex items-center justify-center mb-3">
                  <KeyRound size={24} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Crea tu Nueva Contraseña</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ingresa tu nueva clave de acceso seguro</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nueva Contraseña */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">Nueva Contraseña</label>
                  <div className="relative group">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-vinotinto transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-vinotinto/20 focus:border-vinotinto transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Contraseña */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                  <div className="relative group">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-vinotinto transition-colors" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                      placeholder="Repite la nueva contraseña"
                      className="w-full pl-10 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-vinotinto/20 focus:border-vinotinto transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-semibold"
                    >
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Botón de Enviar */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-2xl font-bold text-sm shadow-lg shadow-vinotinto/25 hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        <span>Guardando nueva contraseña...</span>
                      </>
                    ) : (
                      <span>Restablecer Contraseña</span>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <a href="/" className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors">
                    ← Volver al Inicio de Sesión
                  </a>
                </div>
              </form>
            </div>
          )}
        </div>
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
