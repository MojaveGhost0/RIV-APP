'use client';

import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from 'next/navigation';
import { User, Shield, ChevronRight, LogOut, Home, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '../lib/motion';

export default function Perfil() {
  const { user, isAdmin, logout } = useAuth();
  const { properties, appointments } = useData();
  const router = useRouter();

  const misCaptaciones = properties.filter(p => p.captador === user?.nombre);
  const misVentas = misCaptaciones.filter(p => p.status === 'Vendida').length;
  const misCitasPendientes = appointments.filter(
    a => a.asesores.includes(user?.nombre ?? '') && a.estado === 'Pendiente'
  );

  const menuItems = [
    {
      icon: <Home size={18} className="text-vinotinto" />,
      label: 'Mis Captaciones',
      sub: `${misCaptaciones.length} propiedad${misCaptaciones.length !== 1 ? 'es' : ''} registrada${misCaptaciones.length !== 1 ? 's' : ''}`,
      action: () => router.push('/inventario'),
    },
    {
      icon: <Calendar size={18} className="text-blue-500" />,
      label: 'Mis Citas',
      sub: `${misCitasPendientes.length} cita${misCitasPendientes.length !== 1 ? 's' : ''} pendiente${misCitasPendientes.length !== 1 ? 's' : ''}`,
      action: () => router.push('/citas'),
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="bg-gray-50 min-h-[100dvh] page-content"
    >
      {/* HEADER */}
      <motion.header
        variants={itemVariants}
        className="bg-white px-5 pt-8 pb-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-vinotinto mb-5">Mi Perfil</h1>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-vinotinto flex items-center justify-center shrink-0 shadow-md">
            <User size={32} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-xl text-gray-800">{user?.nombre}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1.5 px-2 py-0.5 rounded-full ${
              isAdmin ? 'bg-vinotinto/10 text-vinotinto' : 'bg-blue-50 text-blue-600'
            }`}>
              <Shield size={11} /> {user?.rol}
            </span>
          </div>
        </div>
      </motion.header>

      <div className="p-4 space-y-4">
        {/* STATS */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-vinotinto">{misCaptaciones.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1 leading-tight">Captaciones</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-blue-500">{misCitasPendientes.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1 leading-tight">Citas Pend.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-black text-green-600">{misVentas}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1 leading-tight">Ventas</p>
          </div>
        </motion.div>

        {/* OPCIONES */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50"
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
        </motion.div>

        {/* CERRAR SESIÓN */}
        <motion.button
          variants={itemVariants}
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-red-200 text-red-500 font-bold bg-red-50 hover:bg-red-100 active:scale-95 transition-all"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </motion.button>

        <motion.p variants={itemVariants} className="text-center text-xs text-gray-400 pt-1">
          RIV Margarita Premier · v1.0
          <br />
          Sistema de uso exclusivo interno
        </motion.p>
      </div>
    </motion.div>
  );
}
