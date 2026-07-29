'use client';

import { useState } from 'react';
import { Search, MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';

export default function Dashboard() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { properties, appointments } = useData();
  const [searchQuery, setSearchQuery] = useState('');

  // Calcular KPIs dinámicamente
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD using local timezone
  const citasHoy = appointments.filter(c => c.fecha === today && c.estado === 'Pendiente').length;
  const totalPropiedades = properties.length;
  const proximaCita = appointments
    .filter(c => c.estado === 'Pendiente' && (!isAdmin ? c.asesores.includes(user?.nombre ?? '') : true))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/inventario?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="page-content p-4 pb-28 bg-gray-50 min-h-[100dvh]">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Hola, {user?.nombre?.split(' ')[0] ?? 'Bienvenido'} 👋
          </h1>
          <p className="text-sm text-gray-500">{isAdmin ? 'Administrador' : 'Asesor Inmobiliario'}</p>
        </div>
      </header>

      {/* SEARCH BAR */}
      <form onSubmit={handleSearch} className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="text-gray-400" size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-16 py-3.5 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-vinotinto focus:border-vinotinto transition-colors shadow-sm text-sm"
          placeholder="Buscar inmueble: zona, precio, tipo..."
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-vinotinto text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-vinotinto/90 transition"
        >
          Buscar
        </button>
      </form>

      {/* QUICK SUMMARY CARDS */}
      <h2 className="text-base font-bold text-gray-800 mb-3">Resumen</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        
        <div
          onClick={() => router.push('/citas')}
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-vinotinto/10 p-2 rounded-xl">
              <MapPin className="text-vinotinto" size={20} />
            </div>
            <span className="text-3xl font-black text-gray-800">{citasHoy}</span>
          </div>
          <p className="text-sm font-semibold text-gray-600">Citas Hoy</p>
          <p className="text-xs text-vinotinto font-bold mt-1 flex items-center gap-0.5">Ver agenda <ArrowRight size={12} /></p>
        </div>

        <div
          onClick={() => router.push('/inventario')}
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-dorado/10 p-2 rounded-xl">
              <CheckCircle className="text-dorado-dark" size={20} />
            </div>
            <span className="text-3xl font-black text-gray-800">{totalPropiedades}</span>
          </div>
          <p className="text-sm font-semibold text-gray-600">Inmuebles</p>
          <p className="text-xs text-dorado-dark font-bold mt-1 flex items-center gap-0.5">Ver inventario <ArrowRight size={12} /></p>
        </div>
      </div>

      {/* PRÓXIMA CITA */}
      <h2 className="text-base font-bold text-gray-800 mb-3">Próxima Cita</h2>
      {proximaCita ? (
        <div
          onClick={() => router.push('/citas')}
          className="bg-gradient-to-r from-vinotinto to-vinotinto-light p-5 rounded-2xl shadow-md text-white cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs text-white/60 font-medium uppercase tracking-wider mb-0.5">{proximaCita.tipo}</p>
              <h3 className="font-bold text-lg leading-tight">{proximaCita.titulo}</h3>
              <p className="text-white/70 text-sm mt-0.5">Cliente: {proximaCita.cliente}</p>
            </div>
            <div className="bg-white/20 px-3 py-1.5 rounded-xl text-sm font-bold backdrop-blur-sm shrink-0">
              {proximaCita.hora}
            </div>
          </div>
          <div className="flex items-center text-sm text-white/70 mt-3">
            <MapPin size={14} className="mr-1.5" />
            {proximaCita.fecha}
          </div>
        </div>
      ) : (
        <div
          onClick={() => router.push('/citas')}
          className="bg-white border border-dashed border-gray-200 p-5 rounded-2xl text-center cursor-pointer hover:border-vinotinto/40 transition-colors"
        >
          <p className="text-gray-400 font-medium text-sm">No hay citas pendientes</p>
          <p className="text-xs text-vinotinto font-bold mt-1">+ Agendar nueva cita</p>
        </div>
      )}

      {/* ACCESO RÁPIDO */}
      <h2 className="text-base font-bold text-gray-800 mb-3 mt-8">Acciones Rápidas</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push('/inventario/registro')}
          className="bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow active:scale-[0.97]"
        >
          <p className="text-xl mb-1">🏠</p>
          <p className="text-sm font-bold text-gray-800">Registrar Inmueble</p>
          <p className="text-xs text-gray-400 mt-0.5">Captar propiedad nueva</p>
        </button>
        <button
          onClick={() => router.push('/citas')}
          className="bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow active:scale-[0.97]"
        >
          <p className="text-xl mb-1">📅</p>
          <p className="text-sm font-bold text-gray-800">Nueva Cita</p>
          <p className="text-xs text-gray-400 mt-0.5">Agendar visita o reunión</p>
        </button>
      </div>
    </div>
  );
}
