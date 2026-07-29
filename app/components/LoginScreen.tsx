'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

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

    const success = login(username, password);
    if (!success) {
      setError('Usuario o contraseña incorrectos. Intenta nuevamente.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">

      {/* HEADER VINOTINTO */}
      <div className="bg-[#800020] pt-16 pb-12 px-8 flex flex-col items-center">
        {/* Logo / Ícono */}
        <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-5 border border-white/20 shadow-lg">
          <span className="text-4xl font-black text-white tracking-tight leading-none">RIV</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white text-center leading-tight">
          RIV Margarita Premier
        </h1>
        <p className="text-white/60 text-sm mt-1 text-center">
          Sistema de Gestión Inmobiliaria
        </p>
      </div>

      {/* WAVE SEPARATOR */}
      <div className="bg-[#800020] h-8 relative">
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-[2rem]" />
      </div>

      {/* FORMULARIO */}
      <div className="flex-1 px-6 pt-6 pb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Iniciar Sesión</h2>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">

          {/* CAMPO USUARIO */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usuario</label>
            <div className="relative">
              <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="Ingresa tu usuario"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]/30 focus:border-[#800020] transition"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          </div>

          {/* CAMPO CONTRASEÑA */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Ingresa tu contraseña"
                className="w-full pl-10 pr-11 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]/30 focus:border-[#800020] transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-[#800020] text-white rounded-xl font-bold text-base shadow-lg shadow-[#800020]/30 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verificando...
              </>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-10">
          RIV Margarita Premier · v1.0{'\n'}Sistema de uso exclusivo interno
        </p>
      </div>
    </div>
  );
}
