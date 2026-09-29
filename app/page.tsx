'use client';

import { useState } from 'react';
import { Search, MapPin, CheckCircle, ArrowRight, Calendar, Home, Users, Settings, CalendarPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { containerVariants, itemVariants } from './lib/motion';
import { normalize } from './lib/searchEngine';
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

  // LOG-03: Filtrar citasHoy por asesor si no es admin, con comparación normalizada (insensible a tildes y mayúsculas)
  const citasHoy = appointments.filter(c => {
    if (c.fecha !== today || c.estado !== 'Pendiente') return false;
    if (isAdmin) return true;
    return c.asesores.some(a => normalize(a) === myNombre);
  }).length;

  const totalPropiedades = properties.length;

  // LOG-03: Comparación con normalize() para proximaCita
  const proximaCita = appointments
    .filter(c => {
      if (c.estado !== 'Pendiente') return false;
      if (isAdmin) return true;
      return c.asesores.some(a => normalize(a) === myNombre);
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

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
      className="page-content p-4 pb-28 bg-gray-50 min-h-[100dvh]"
    >
      {/* HEADER */}
      <motion.header variants={itemVariants} className="flex justify-between items-center mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Hola, {user?.nombre?.split(' ')[0] ?? 'Bienvenido'} 👋
          </h1>
          <p className="text-sm text-gray-500">{isAdmin ? 'Administrador' : 'Asesor Inmobiliario'}</p>
        </div>
        <BrandLogo size="sm" className="shrink-0" />
      </motion.header>

      {/* BÚSQUEDA */}
      <motion.form variants={itemVariants} onSubmit={handleSearch} className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
          <Search className="text-gray-400" size={22} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="block w-full pl-14 pr-24 py-5 border border-transparent rounded-2xl bg-white shadow-[0_2px_15px_rgba(0,0,0,0.04)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vinotinto/30 focus:border-vinotinto transition-all text-base hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
          placeholder="Buscar por zona, precio, tipo..."
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-1 hover:shadow-md hover:shadow-vinotinto/20 active:scale-95 transition-all z-10"
        >
          Buscar
        </button>
      </motion.form>

      {/* KPIs */}
      <motion.h2 variants={itemVariants} className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        Resumen del día
      </motion.h2>
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 mb-8">

        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/citas')}
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[100px] cursor-pointer hover:shadow-[0_8px_25px_rgba(0,0,0,0.07)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-vinotinto/10 p-2 rounded-xl">
              <Calendar className="text-vinotinto" size={20} />
            </div>
            <span className="text-3xl font-black text-gray-800">{citasHoy}</span>
          </div>
          <p className="text-sm font-semibold text-gray-600">Citas Hoy</p>
          <p className="text-xs text-vinotinto font-bold mt-1 flex items-center gap-0.5">
            Ver agenda <ArrowRight size={12} />
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/inventario')}
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[100px] cursor-pointer hover:shadow-[0_8px_25px_rgba(0,0,0,0.07)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-dorado/10 p-2 rounded-xl">
              <CheckCircle className="text-dorado" size={20} />
            </div>
            <span className="text-3xl font-black text-gray-800">{totalPropiedades}</span>
          </div>
          <p className="text-sm font-semibold text-gray-600">Inmuebles</p>
          <p className="text-xs text-dorado-dark font-bold mt-1 flex items-center gap-0.5">
            Ver inventario <ArrowRight size={12} />
          </p>
        </motion.div>
      </motion.div>

      {/* PRÓXIMA CITA */}
      <motion.h2 variants={itemVariants} className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        Próxima Cita
      </motion.h2>
      <motion.div variants={itemVariants}>
        {proximaCita ? (
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/citas')}
            className="bg-gradient-to-br from-vinotinto-dark via-vinotinto to-vinotinto-dark p-5 rounded-2xl shadow-lg shadow-vinotinto/20 text-white cursor-pointer relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex justify-between items-start mb-3 relative z-10">
              <div>
                <p className="text-xs text-white/70 font-bold uppercase tracking-widest mb-1">
                  {proximaCita.tipo}
                </p>
                <h3 className="font-extrabold text-lg leading-tight drop-shadow-sm">
                  {proximaCita.titulo}
                </h3>
                {proximaCita.cliente?.trim() ? (
                  <p className="text-white/80 text-sm mt-1">
                    Cliente: <span className="font-semibold text-white">{proximaCita.cliente}</span>
                  </p>
                ) : (
                  <p className="text-white/60 text-xs mt-1 italic">
                    Sin cliente asignado
                  </p>
                )}
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl text-sm font-bold backdrop-blur-md shrink-0 border border-white/20">
                {proximaCita.hora}
              </div>
            </div>
            <div className="flex items-center text-sm text-white/80 mt-3 relative z-10">
              <Calendar size={15} className="mr-1.5" />
              {formatFecha(proximaCita.fecha)}
            </div>
          </motion.div>
        ) : (
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/citas')}
            className="bg-white border-2 border-dashed border-gray-200 p-5 rounded-2xl text-center cursor-pointer hover:border-vinotinto/40 hover:bg-vinotinto/5 transition-all"
          >
            <p className="text-gray-400 font-medium text-sm">No hay citas pendientes</p>
            <p className="text-xs text-vinotinto font-bold mt-1">+ Agendar nueva cita</p>
          </motion.div>
        )}
      </motion.div>

      {/* ACCIONES RÁPIDAS */}
      <motion.h2 variants={itemVariants} className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-8">
        Acciones Rápidas
      </motion.h2>
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <motion.button
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/inventario/registro')}
          className="bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="bg-vinotinto/10 p-2 rounded-xl w-fit mb-2">
            <Home size={18} className="text-vinotinto" />
          </div>
          <p className="text-sm font-bold text-gray-800">Registrar Inmueble</p>
          <p className="text-xs text-gray-400 mt-0.5">Captar propiedad nueva</p>
        </motion.button>

        <motion.button
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/citas')}
          className="bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="bg-blue-50 p-2 rounded-xl w-fit mb-2">
            <CalendarPlus size={18} className="text-blue-500" />
          </div>
          <p className="text-sm font-bold text-gray-800">Nueva Cita</p>
          <p className="text-xs text-gray-400 mt-0.5">Agendar visita o reunión</p>
        </motion.button>

        <motion.button
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/crm')}
          className="bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="bg-emerald-50 p-2 rounded-xl w-fit mb-2">
            <Users size={18} className="text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-gray-800">CRM</p>
          <p className="text-xs text-gray-400 mt-0.5">Gestión de clientes</p>
        </motion.button>

        <motion.button
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/perfil')}
          className="bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="bg-dorado/10 p-2 rounded-xl w-fit mb-2">
            <Settings size={18} className="text-dorado-dark" />
          </div>
          <p className="text-sm font-bold text-gray-800">Mi Perfil</p>
          <p className="text-xs text-gray-400 mt-0.5">Ajustes y equipo</p>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

