'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, X, User, ShieldAlert, Trash2, CheckCheck } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const TIPO_COLOR: Record<string, string> = {
  'Cita en Oficina':   'bg-blue-500',
  'Mostrar Propiedad': 'bg-dorado',
  'Captar Propiedad':  'bg-green-500',
};

export default function GestorCitas() {
  const { user, isAdmin, getAllUsers } = useAuth();
  const { appointments, addAppointment, deleteAppointment, updateAppointmentStatus } = useData();
  const allUsers = getAllUsers();

  const [activeTab, setActiveTab] = useState<'proximas' | 'historico'>('proximas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'Mostrar Propiedad',
    titulo: '',
    cliente: '',
    fecha: '',
    hora: '',
    asesoresIds: user?.id ? [user.id] : [],
  });

  // REGLA DE NEGOCIO:
  // - Asesor solo ve sus propias citas.
  // - Admin ve todas las citas de la agencia.
  const citasVisibles = appointments.filter(cita => {
    const esMia = cita.asesores.includes(user?.nombre ?? '');
    if (!isAdmin && !esMia) return false;
    if (activeTab === 'proximas')  return cita.estado === 'Pendiente';
    if (activeTab === 'historico') return cita.estado === 'Completada' || cita.estado === 'Cancelada';
    return true;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Si admin asignó asesores específicos, usarlos; si no, usar el usuario actual
    const asesoresAsignados = isAdmin
      ? formData.asesoresIds.map(id => allUsers.find(u => u.id === id)?.nombre).filter(Boolean) as string[]
      : [user?.nombre ?? 'Asesor'];

    if (asesoresAsignados.length === 0) {
      alert("Debes seleccionar al menos un asesor.");
      return;
    }

    addAppointment({
      tipo: formData.tipo,
      titulo: formData.titulo,
      cliente: formData.cliente,
      fecha: formData.fecha,
      hora: formData.hora,
      asesores: asesoresAsignados,
    });
    setIsModalOpen(false);
    setFormData({ tipo: 'Mostrar Propiedad', titulo: '', cliente: '', fecha: '', hora: '', asesoresIds: user?.id ? [user.id] : [] });
  };

  const handleComplete = (id: string | number) => {
    updateAppointmentStatus(id, 'Completada');
  };

  const handleDelete = (id: string | number) => {
    if (confirm('¿Eliminar esta cita?')) {
      deleteAppointment(id);
    }
  };

  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content">

      {/* HEADER */}
      <header className="bg-white px-4 pt-safe pt-6 pb-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Agenda</h1>
          <p className="text-xs text-gray-400 mt-0.5">{isAdmin ? 'Vista de toda la agencia' : `Mis citas · ${user?.nombre}`}</p>
        </div>
      </header>

      {/* TABS */}
      <div className="px-4 py-4">
        <div className="flex bg-gray-200/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('proximas')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'proximas' ? 'bg-white text-vinotinto shadow-sm' : 'text-gray-500'}`}
          >
            Próximas
          </button>

          {/* HISTÓRICO: SOLO visible para ADMIN */}
          {isAdmin ? (
            <button
              onClick={() => setActiveTab('historico')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'historico' ? 'bg-white text-vinotinto shadow-sm' : 'text-gray-500'}`}
            >
              Histórico
            </button>
          ) : (
            <div className="flex-1 py-2.5 flex items-center justify-center gap-1.5 rounded-lg opacity-30 cursor-not-allowed" title="Solo para Administradores">
              <ShieldAlert size={13} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-500">Histórico</span>
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE CITAS */}
      <div className="px-4 pb-28 space-y-4">
        {citasVisibles.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-gray-100">
            <CalendarIcon className="mx-auto text-gray-300 mb-3" size={44} />
            <p className="text-gray-500 font-semibold">No hay citas en esta vista.</p>
            <p className="text-sm text-gray-400 mt-1">Toca el botón + para agendar una.</p>
          </div>
        ) : (
          citasVisibles.map((cita) => (
            <div key={cita.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden animate-fade-in-up">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${TIPO_COLOR[cita.tipo] ?? 'bg-gray-400'}`}></div>

              <div className="pl-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {cita.tipo}
                  </span>
                  <span className={`text-xs font-bold ${cita.estado === 'Pendiente' ? 'text-amber-500' : 'text-green-600'}`}>
                    ● {cita.estado}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-base mb-3 leading-snug">{cita.titulo}</h3>

                <div className="space-y-1.5 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-vinotinto/60 shrink-0" />
                    <span>Cliente: <span className="font-medium text-gray-700">{cita.cliente}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={14} className="text-vinotinto/60 shrink-0" />
                    <span>{cita.fecha}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-vinotinto/60 shrink-0" />
                    <span>{cita.hora}</span>
                  </div>
                </div>

                {/* Asesor + Acciones */}
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-50">
                  <div className="w-5 h-5 rounded-full bg-vinotinto/10 flex items-center justify-center shrink-0">
                    <User size={10} className="text-vinotinto" />
                  </div>
                  <span className="text-xs text-gray-400 flex-1">
                    {isAdmin ? (
                      <>Asesores: <span className="font-semibold text-gray-600">{cita.asesores.join(', ')}</span></>
                    ) : (
                      <>Registrada por mí</>
                    )}
                  </span>

                  {/* Acciones */}
                  <div className="flex gap-2">
                    {cita.estado === 'Pendiente' && (
                      <button
                        onClick={() => handleComplete(cita.id)}
                        className="flex items-center gap-1 text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg hover:bg-green-100 transition"
                      >
                        <CheckCheck size={12} />
                        Completar
                      </button>
                    )}
                    {(isAdmin || cita.asesores.includes(user?.nombre ?? '')) && (
                      <button
                        onClick={() => handleDelete(cita.id)}
                        className="flex items-center gap-1 text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom)+1rem)] right-5 w-14 h-14 bg-vinotinto text-white rounded-full flex items-center justify-center shadow-lg shadow-vinotinto/30 active:scale-90 transition-transform z-20"
      >
        <Plus size={28} />
      </button>

      {/* MODAL */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Agendar Cita</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cita</label>
                  <select name="tipo" value={formData.tipo} onChange={handleInputChange}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none font-medium text-gray-800">
                    <option value="Cita en Oficina">🏢 Cita en Oficina</option>
                    <option value="Mostrar Propiedad">🏡 Mostrar Propiedad</option>
                    <option value="Captar Propiedad">📝 Captar Propiedad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Propiedad o Asunto</label>
                  <input type="text" name="titulo" value={formData.titulo} onChange={handleInputChange} required
                    placeholder="Ej: Visita Villa Costa Azul"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
                  <input type="text" name="cliente" value={formData.cliente} onChange={handleInputChange} required
                    placeholder="Ej: María López"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" name="fecha" value={formData.fecha} onChange={handleInputChange} required
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                    <input type="time" name="hora" value={formData.hora} onChange={handleInputChange} required
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none" />
                  </div>
                </div>

                {/* Asesores: Checkboxes si Admin, info fija si Asesor */}
                {isAdmin ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Asignar Asesores</label>
                    <div className="space-y-2 border border-gray-200 p-3 rounded-xl max-h-40 overflow-y-auto bg-gray-50">
                      {allUsers.map(u => (
                        <label key={u.id} className="flex items-center gap-2 cursor-pointer p-1">
                          <input
                            type="checkbox"
                            checked={formData.asesoresIds.includes(u.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData(prev => ({
                                ...prev,
                                asesoresIds: checked 
                                  ? [...prev.asesoresIds, u.id]
                                  : prev.asesoresIds.filter(id => id !== u.id)
                              }));
                            }}
                            className="w-4 h-4 text-vinotinto rounded focus:ring-vinotinto"
                          />
                          <span className="text-sm text-gray-800">{u.nombre} <span className="text-xs text-gray-400">({u.rol})</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-vinotinto/5 border border-vinotinto/10 p-3 rounded-lg flex items-center gap-2">
                    <User size={16} className="text-vinotinto shrink-0" />
                    <p className="text-xs text-vinotinto/80 leading-tight">
                      Registrado como: <span className="font-bold">{user?.nombre}</span>
                    </p>
                  </div>
                )}

                <button type="submit"
                  className="w-full py-4 bg-vinotinto text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
                  Guardar Cita
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
