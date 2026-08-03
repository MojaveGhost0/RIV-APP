'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { TrendingUp, Home, CheckCircle, Users, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

import { useData } from '../context/DataContext';

const DonutTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-xl shadow-lg border border-gray-100 text-center">
        <p className="text-xs font-bold" style={{ color: payload[0].payload.color }}>{payload[0].name}</p>
        <p className="text-xl font-extrabold text-gray-800">{payload[0].value}</p>
        <p className="text-[10px] text-gray-400">inmuebles</p>
      </div>
    );
  }
  return null;
};

export default function Estadisticas() {
  const { isAdmin, getAllUsers } = useAuth();
  const { properties, appointments } = useData();
  const router = useRouter();
  const [filtroAsesor, setFiltroAsesor] = useState('Todos');

  // PROTECCIÓN DE RUTA: Si no es Admin, redirige al Dashboard
  useEffect(() => {
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <ShieldAlert size={48} className="text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
        <p className="text-sm text-gray-500">Esta sección es exclusiva para Administradores.</p>
      </div>
    );
  }

  // --- CALCULAR DATOS DINÁMICOS ---
  
  // 1. Estado del Inventario
  const activos = properties.filter(p => p.status === 'Activa').length;
  const vendidos = properties.filter(p => p.status === 'Vendida').length;
  const suspendidos = properties.filter(p => p.status === 'Suspendida').length;
  
  const PROPERTY_STATUS_DATA = [
    { name: 'Activos',    value: activos,     color: '#800020' },
    { name: 'Vendidos',   value: vendidos,    color: '#D4AF37' },
    { name: 'Suspendidos',value: suspendidos, color: '#9CA3AF' },
  ];

  const totalInmuebles = properties.length;

  // 2. Captaciones del Mes por Asesor
  const allUsers = getAllUsers();
  
  const CAPTACIONES_MES = allUsers.map(user => {
    const captaciones = properties.filter(p => p.captador === user.nombre).length;
    // Solo usamos el primer nombre y la inicial del apellido para que quepa en el gráfico
    const nombreCorto = user.nombre.split(' ')[0] + ' ' + (user.nombre.split(' ')[1]?.[0] + '.' || '');
    return {
      asesorFull: user.nombre,
      asesor: nombreCorto,
      captaciones: captaciones
    };
  });

  // 3. KPIs
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // FIX #8 — Captaciones del mes: filtra por createdAt del mes actual.
  // Las propiedades del seed sin createdAt se ignoran (captaciones históricas anteriores).
  const nuevasCaptaciones = properties.filter(p => {
    if (!p.createdAt) return false;
    const d = new Date(p.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // Citas concretadas (Completadas en el mes actual)
  const citasConcretadas = appointments.filter(a => {
    if (a.estado !== 'Completada') return false;
    const date = new Date(a.fecha);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  }).length;

  const totalAsesores = allUsers.length;

  // FIX #7 — Nombre del mes dinámico (antes era "Julio 2025" hardcodeado)
  const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const mesCapitalizado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

  const KPI_DATA = { 
    citasConcretadas, 
    nuevasCaptaciones, 
    totalAsesores 
  };

  const asesoresNombres = ['Todos', ...CAPTACIONES_MES.map(c => c.asesor)];
  const dataFiltrada = filtroAsesor === 'Todos' ? CAPTACIONES_MES : CAPTACIONES_MES.filter(c => c.asesor === filtroAsesor);

  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content">

      {/* HEADER */}
      <header className="bg-white px-5 pt-8 pb-5 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-vinotinto/10 p-1.5 rounded-lg">
            <TrendingUp size={16} className="text-vinotinto" />
          </div>
          <p className="text-[10px] font-bold text-vinotinto uppercase tracking-widest">Solo Admin</p>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Estadísticas</h1>
      </header>

      <div className="p-4 space-y-5">

        {/* KPI MINI CARDS */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <CheckCircle size={20} className="text-vinotinto" />, value: KPI_DATA.citasConcretadas, label: 'Citas\nConcretadas' },
            { icon: <Home size={20} className="text-dorado-dark" />,      value: KPI_DATA.nuevasCaptaciones, label: 'Captaciones\nMes' },
            { icon: <Users size={20} className="text-blue-500" />,        value: KPI_DATA.totalAsesores,     label: 'Asesores\nActivos' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center gap-1 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              {kpi.icon}
              <p className="text-2xl font-extrabold text-gray-800 leading-none">{kpi.value}</p>
              <p className="text-[10px] text-gray-500 font-semibold leading-tight whitespace-pre-line">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* GRÁFICO DONA */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-fade-in-up">
          <h2 className="text-base font-bold text-gray-800 mb-0.5">Estado del Inventario</h2>
          <p className="text-xs text-gray-400 mb-4">{totalInmuebles} inmuebles en total</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={PROPERTY_STATUS_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={76}
                  paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {PROPERTY_STATUS_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {PROPERTY_STATUS_DATA.map((e) => (
                <div key={e.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <div>
                    <p className="text-xs text-gray-500 leading-none">{e.name}</p>
                    <p className="text-lg font-extrabold text-gray-800 leading-tight">{e.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GRÁFICO BARRAS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-fade-in-up">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">Captaciones del Mes</h2>
              <p className="text-xs text-gray-400">{mesCapitalizado}</p>
            </div>
            <select value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}
              className="text-xs font-bold bg-vinotinto/10 text-vinotinto border-none rounded-lg px-2 py-1.5 outline-none cursor-pointer">
              {asesoresNombres.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={175}>
            <BarChart data={dataFiltrada} barSize={28} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="asesor" tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #F3F4F6', fontSize: '12px', fontWeight: 'bold' }}
                cursor={{ fill: '#F9FAFB', radius: 8 }} />
              <Bar dataKey="captaciones" name="Captaciones" fill="#800020" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* COUNTER CARD GRANDE: Citas Concretadas */}
        <div className="bg-gradient-to-br from-vinotinto to-vinotinto-light p-6 rounded-2xl shadow-lg text-white relative overflow-hidden animate-fade-in-up">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute right-6 -bottom-3 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <CheckCircle size={32} className="text-dorado mb-4" />
          <p className="text-sm font-semibold opacity-75 mb-1">Citas Concretadas</p>
          <p className="text-7xl font-black tracking-tight leading-none">{KPI_DATA.citasConcretadas}</p>
          <p className="text-xs opacity-50 mt-3">Este mes · Todos los asesores</p>
        </div>

      </div>
    </div>
  );
}
