'use client';

import { useState } from 'react';
import { Search, CheckCircle, ArrowRight, Calendar, Home, Users, Settings, CalendarPlus, Clock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { containerVariants, itemVariants } from './lib/motion';
import { normalize } from './lib/searchEngine';
import { getCitaTime, isCitaPasada, useNow } from './lib/citas';
import BrandLogo from './components/BrandLogo';

/** Convierte "2026-07-16" → "16 Jul 2026" en español */
function formatFecha(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { properties, appointments } = useData();
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const myNombre = normalize(user?.nombre ?? '');

  // LOG-03: Filtrar citasHoy por asesor si no es admin, con comparación normalizada
  const citasHoy = appointments.filter(c => {
    if (c.fecha !== today || c.estado !== 'Pendiente') return false;
    if (isAdmin) return true;
    return c.asesores.some(a => normalize(a) === myNombre);
  }).length;

  const totalPropiedades = properties.length;

  // LOG-03: Comparación con normalize() para proximaCita
  const now = useNow();
  const proximaCita = appointments
    .filter(c => {
      if (c.estado !== 'Pendiente') return false;
      if (isCitaPasada(c, now)) return false;
      if (isAdmin) return true;
      return c.asesores.some(a => normalize(a) === myNombre);
    })
    .sort((a, b) => getCitaTime(a) - getCitaTime(b))[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/inventario?q=${encodeURIComponent(q)}`);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="page-content p-4 sm:p-6 pb-28 bg-[#F3F4F6] min-h-[100dvh] relative overflow-hidden"
    >
      {/* Luces de fondo ambientales de lujo */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-vinotinto/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute top-1/3 left-0 w-72 h-72 bg-dorado/5 rounded-full blur-3xl pointer-events-none -ml-20" />

      {/* HEADER */}
      <motion.header variants={itemVariants} className="flex justify-between items-center mb-6 pt-1 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Hola, {user?.nombre?.split(' ')[0] ?? 'Bienvenido'}
            </h1>
            <span className="text-xl">👋</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-dorado/15 text-dorado-dark border border-dorado/30 shadow-xs">
                <Sparkles size={12} className="text-dorado" /> Administrador
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-vinotinto/10 text-vinotinto border border-vinotinto/20">
                Asesor Inmobiliario
              </span>
            )}
            <span className="text-xs text-gray-400">• RIV Premier</span>
          </div>
        </div>
        <BrandLogo size="sm" className="shrink-0 drop-shadow-xs" />
      </motion.header>

      {/* BÚSQUEDA CON GLASSMORPHISM */}
      <motion.form variants={itemVariants} onSubmit={handleSearch} className="relative mb-7 z-10">
        <div className="relative flex items-center bg-white/85 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus-within:border-vinotinto/60 focus-within:ring-2 focus-within:ring-vinotinto/15 transition-all group">
          <div className="pl-4 pr-2 flex items-center pointer-events-none text-gray-400 group-focus-within:text-vinotinto transition-colors">
            <Search size={20} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full py-4 pr-28 bg-transparent text-gray-800 placeholder-gray-400 text-sm sm:text-base focus:outline-none"
            placeholder="Buscar por zona, precio, tipo de inmueble..."
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="submit"
            className="absolute right-2 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-vinotinto/20 hover:shadow-lg hover:shadow-vinotinto/30 transition-all flex items-center gap-1"
          >
            Buscar
          </motion.button>
        </div>
      </motion.form>

      {/* RESUMEN DEL DÍA (KPIs) */}
      <motion.div variants={itemVariants} className="mb-2 z-10 relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-vinotinto" /> Resumen del día
          </h2>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3.5 mb-7 z-10 relative">
        {/* KPI: Citas Hoy */}
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/citas')}
          className="bg-white/85 backdrop-blur-md p-4.5 rounded-2xl border border-gray-200/70 shadow-xs hover:shadow-lg hover:border-vinotinto/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-vinotinto/10 p-2.5 rounded-xl text-vinotinto group-hover:bg-vinotinto group-hover:text-white transition-colors duration-200">
              <Calendar size={18} />
            </div>
            <span className="text-3xl font-black text-gray-900 tracking-tight">{citasHoy}</span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600">Citas Hoy</p>
            <p className="text-xs text-vinotinto font-bold mt-1 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Ver agenda <ArrowRight size={12} />
            </p>
          </div>
        </motion.div>

        {/* KPI: Inmuebles */}
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/inventario')}
          className="bg-white/85 backdrop-blur-md p-4.5 rounded-2xl border border-dorado/30 shadow-xs shadow-dorado/5 hover:shadow-lg hover:border-dorado/60 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-dorado/15 p-2.5 rounded-xl text-dorado-dark group-hover:bg-dorado group-hover:text-white transition-colors duration-200">
              <CheckCircle size={18} />
            </div>
            <span className="text-3xl font-black text-gray-900 tracking-tight">{totalPropiedades}</span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-600">Inmuebles</p>
            <p className="text-xs text-dorado-dark font-bold mt-1 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Ver inventario <ArrowRight size={12} />
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* PRÓXIMA CITA DESTACADA */}
      <motion.div variants={itemVariants} className="mb-2 z-10 relative">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-dorado" /> Próxima Cita
        </h2>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-7 z-10 relative">
        {proximaCita ? (
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/citas')}
            className="bg-gradient-to-br from-[#590016] via-[#800020] to-[#590016] p-5 rounded-2xl shadow-xl shadow-vinotinto/20 text-white cursor-pointer relative overflow-hidden border border-vinotinto-light/30 group"
          >
            {/* Halo de luz dorado de ambientación */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-dorado/15 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

            <div className="flex justify-between items-start mb-3.5 relative z-10">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-dorado-light bg-black/25 px-2.5 py-0.5 rounded-lg border border-dorado/20 mb-2">
                  <Sparkles size={10} /> {proximaCita.tipo}
                </span>
                <h3 className="font-extrabold text-lg sm:text-xl leading-tight drop-shadow-sm text-white">
                  {proximaCita.titulo}
                </h3>
                {proximaCita.cliente?.trim() ? (
                  <p className="text-white/80 text-sm mt-1.5 flex items-center gap-1">
                    Cliente: <span className="font-semibold text-white">{proximaCita.cliente}</span>
                  </p>
                ) : (
                  <p className="text-white/60 text-xs mt-1.5 italic">
                    Sin cliente asignado
                  </p>
                )}
              </div>
              <div className="bg-white/15 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold backdrop-blur-md shrink-0 border border-white/20 flex items-center gap-1.5 shadow-xs">
                <Clock size={13} className="text-dorado-light" />
                {proximaCita.hora}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm text-white/80 pt-3 border-t border-white/10 relative z-10">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-dorado-light" />
                {formatFecha(proximaCita.fecha)}
              </div>
              <span className="text-xs font-semibold text-dorado-light flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Ver detalle <ArrowRight size={12} />
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/citas')}
            className="bg-white/80 backdrop-blur-md border border-dashed border-gray-300 p-5 rounded-2xl text-center cursor-pointer hover:border-vinotinto/50 hover:bg-vinotinto/5 transition-all shadow-xs"
          >
            <Calendar className="mx-auto text-gray-400 mb-2" size={24} />
            <p className="text-gray-500 font-medium text-sm">No hay citas pendientes hoy</p>
            <p className="text-xs text-vinotinto font-bold mt-1 inline-flex items-center gap-1">
              + Agendar nueva cita
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* ACCIONES RÁPIDAS */}
      <motion.div variants={itemVariants} className="mb-2 z-10 relative">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Acciones Rápidas
        </h2>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 z-10 relative">
        {/* Registrar Inmueble */}
        <motion.button
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/inventario/registro')}
          className="bg-white/85 backdrop-blur-md border border-gray-100 rounded-2xl p-4 text-left shadow-xs hover:shadow-md hover:border-vinotinto/30 transition-all group"
        >
          <div className="bg-vinotinto/10 p-2.5 rounded-xl w-fit mb-2.5 text-vinotinto group-hover:bg-vinotinto group-hover:text-white transition-colors duration-200">
            <Home size={18} />
          </div>
          <p className="text-sm font-bold text-gray-900 group-hover:text-vinotinto transition-colors">Registrar Inmueble</p>
          <p className="text-xs text-gray-400 mt-0.5">Captar propiedad nueva</p>
        </motion.button>

        {/* Nueva Cita */}
        <motion.button
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/citas')}
          className="bg-white/85 backdrop-blur-md border border-gray-100 rounded-2xl p-4 text-left shadow-xs hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="bg-blue-50 p-2.5 rounded-xl w-fit mb-2.5 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
            <CalendarPlus size={18} />
          </div>
          <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Nueva Cita</p>
          <p className="text-xs text-gray-400 mt-0.5">Agendar visita o reunión</p>
        </motion.button>

        {/* CRM */}
        <motion.button
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/crm')}
          className="bg-white/85 backdrop-blur-md border border-gray-100 rounded-2xl p-4 text-left shadow-xs hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="bg-emerald-50 p-2.5 rounded-xl w-fit mb-2.5 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
            <Users size={18} />
          </div>
          <p className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">CRM Clientes</p>
          <p className="text-xs text-gray-400 mt-0.5">Gestión de prospectos</p>
        </motion.button>

        {/* Mi Perfil */}
        <motion.button
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/perfil')}
          className="bg-white/85 backdrop-blur-md border border-gray-100 rounded-2xl p-4 text-left shadow-xs hover:shadow-md hover:border-dorado/40 transition-all group"
        >
          <div className="bg-dorado/15 p-2.5 rounded-xl w-fit mb-2.5 text-dorado-dark group-hover:bg-dorado group-hover:text-white transition-colors duration-200">
            <Settings size={18} />
          </div>
          <p className="text-sm font-bold text-gray-900 group-hover:text-dorado-dark transition-colors">Mi Perfil</p>
          <p className="text-xs text-gray-400 mt-0.5">Ajustes y equipo</p>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

