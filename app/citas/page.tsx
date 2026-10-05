'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, X, User, ShieldAlert, Trash2, CheckCheck, AlertCircle, Edit2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { normalize } from '../lib/searchEngine';
import { getCitaTime, isCitaPasada, useNow, todayISO, nowHHMM, validarFechaHoraCita } from '../lib/citas';

const TIPO_COLOR: Record<string, string> = {
  'Cita en Oficina':   'bg-blue-500',
  'Mostrar Propiedad': 'bg-dorado',
  'Captar Propiedad':  'bg-green-500',
};

export default function GestorCitas() {
  const { user, isAdmin, getAllUsers } = useAuth();
  const { appointments, addAppointment, deleteAppointment, updateAppointmentStatus, updateAppointment } = useData();
  const { showToast, confirm } = useToast();
  const allUsers = getAllUsers();
  const now = useNow();

  const [activeTab, setActiveTab] = useState<'proximas' | 'historico'>('proximas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tipo: 'Mostrar Propiedad',
    titulo: '',
    cliente: '',
    fecha: '',
    hora: '',
    asesoresIds: user?.id ? [user.id] : [],
  });

  // REGLA DE NEGOCIO (DT-04: normalize compartido desde searchEngine.ts):
  // - Asesor solo ve sus propias citas.
  // - Admin ve todas las citas de la agencia.
  // - Próximas: pendientes cuya fecha+hora aún NO ha pasado (orden ascendente).
  // - Histórico: completadas, canceladas o pendientes ya vencidas (orden descendente).
  const myNombre = normalize(user?.nombre ?? '');
  const citasVisibles = appointments
    .filter(cita => {
      const esMia = cita.asesores.some(a => normalize(a) === myNombre);
      if (!isAdmin && !esMia) return false;
      const pasada = isCitaPasada(cita, now);
      if (activeTab === 'proximas')  return cita.estado === 'Pendiente' && !pasada;
      if (activeTab === 'historico') return cita.estado !== 'Pendiente' || pasada;
      return true;
    })
    .sort((a, b) => activeTab === 'proximas'
      ? getCitaTime(a) - getCitaTime(b)
      : getCitaTime(b) - getCitaTime(a));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // LOG-04: handleSubmit async con try/catch; no cierra el modal si falla
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Si admin asignó asesores específicos, usarlos; si no, usar el usuario actual
    const asesoresAsignados = isAdmin
      ? formData.asesoresIds.map(id => allUsers.find(u => u.id === id)?.nombre).filter(Boolean) as string[]
      : [user?.nombre ?? 'Asesor'];

    if (asesoresAsignados.length === 0) {
      setSubmitError("Debes seleccionar al menos un asesor.");
      return;
    }

    // No se permiten citas en el pasado (validación en handler, además de min en inputs)
    const fechaError = validarFechaHoraCita(formData.fecha, formData.hora, Date.now());
    if (fechaError) {
      setSubmitError(fechaError);
      return;
    }

    setIsSubmitting(true);
    try {
      await addAppointment({
        tipo: formData.tipo,
        titulo: formData.titulo.trim(),
        cliente: formData.cliente.trim(),
        fecha: formData.fecha,
        hora: formData.hora,
        asesores: asesoresAsignados,
      });
      setIsModalOpen(false);
      setFormData({ tipo: 'Mostrar Propiedad', titulo: '', cliente: '', fecha: '', hora: '', asesoresIds: user?.id ? [user.id] : [] });
      showToast('¡Cita agendada! Tus cambios han sido guardados.');
    } catch (err: any) {
      console.error('Error al guardar cita (LOG-04):', err);
      setSubmitError(err?.message || 'Error al guardar la cita en el servidor. Revisa tu conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await updateAppointmentStatus(id, 'Completada');
      showToast('Cita marcada como completada.');
    } catch {
      showToast('No se pudo actualizar la cita. Inténtalo de nuevo.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '¿Eliminar esta cita?',
      message: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    try {
      await deleteAppointment(id);
      showToast('Cita eliminada correctamente.');
    } catch {
      showToast('No se pudo eliminar la cita. Inténtalo de nuevo.', 'error');
    }
  };

  // Estado para editar cita
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCitaId, setEditingCitaId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    tipo: 'Mostrar Propiedad',
    titulo: '',
    cliente: '',
    fecha: '',
    hora: '',
    asesoresIds: [] as string[],
  });
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Fecha/hora originales: solo se exige "no pasado" si el usuario reprograma la cita
  const [editOriginal, setEditOriginal] = useState({ fecha: '', hora: '' });
  const editReprogramada = editFormData.fecha !== editOriginal.fecha || editFormData.hora !== editOriginal.hora;

  // Límites para los selectores (bloquean fechas/horas pasadas)
  const minFecha = todayISO(now);
  const minHora = nowHHMM(now);

  const handleOpenEditModal = (cita: any) => {
    setEditingCitaId(cita.id);
    const matchedIds = allUsers
      .filter(u => cita.asesores.some((a: string) => normalize(a) === normalize(u.nombre)))
      .map(u => u.id);

    setEditFormData({
      tipo: cita.tipo,
      titulo: cita.titulo,
      cliente: cita.cliente,
      fecha: cita.fecha,
      hora: cita.hora,
      asesoresIds: matchedIds.length > 0 ? matchedIds : (user?.id ? [user.id] : []),
    });
    setEditOriginal({ fecha: cita.fecha, hora: cita.hora });
    setEditSubmitError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCitaId) return;
    setEditSubmitError(null);

    const asesoresAsignados = isAdmin
      ? editFormData.asesoresIds.map(id => allUsers.find(u => u.id === id)?.nombre).filter(Boolean) as string[]
      : [user?.nombre ?? 'Asesor'];

    if (asesoresAsignados.length === 0) {
      setEditSubmitError("Debes seleccionar al menos un asesor.");
      return;
    }

    if (editReprogramada) {
      const fechaError = validarFechaHoraCita(editFormData.fecha, editFormData.hora, Date.now());
      if (fechaError) {
        setEditSubmitError(fechaError);
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      await updateAppointment(editingCitaId, {
        tipo: editFormData.tipo,
        titulo: editFormData.titulo.trim(),
        cliente: editFormData.cliente.trim(),
        fecha: editFormData.fecha,
        hora: editFormData.hora,
        asesores: asesoresAsignados,
      });
      setIsEditModalOpen(false);
      setEditingCitaId(null);
      showToast('Tus cambios han sido guardados.');
    } catch (err: any) {
      console.error('Error al editar cita:', err);
      setEditSubmitError(err?.message || 'Error al guardar los cambios.');
    } finally {
      setIsSavingEdit(false);
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

      {/* TABS — indicador deslizante con layoutId (sin re-render brusco del fondo) */}
      <div className="px-4 py-4">
        <div className="relative flex bg-gray-200/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('proximas')}
            className={`relative flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'proximas' ? 'text-vinotinto' : 'text-gray-500'}`}
          >
            {activeTab === 'proximas' && (
              <motion.span layoutId="citas-tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative z-10">Próximas</span>
          </button>

          {/* HISTÓRICO: SOLO visible para ADMIN */}
          {isAdmin ? (
            <button
              onClick={() => setActiveTab('historico')}
              className={`relative flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'historico' ? 'text-vinotinto' : 'text-gray-500'}`}
            >
              {activeTab === 'historico' && (
                <motion.span layoutId="citas-tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
              )}
              <span className="relative z-10">Histórico</span>
            </button>
          ) : (
            <div className="flex-1 py-2.5 flex items-center justify-center gap-1.5 rounded-lg opacity-30 cursor-not-allowed" title="Solo para Administradores">
              <ShieldAlert size={13} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-500">Histórico</span>
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE CITAS
          FIX parpadeo: antes, al cambiar de tab, las tarjetas viejas hacían exit+layout
          mientras las nuevas entraban con stagger, y `transition-all` (CSS) peleaba con
          las transformaciones de framer-motion. Ahora la lista completa se reemplaza
          con un crossfade corto (mode="wait") y las tarjetas solo animan al eliminarse. */}
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="px-4 pb-28 space-y-4"
      >
        {citasVisibles.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 mt-4">
            <CalendarIcon className="mx-auto text-gray-300 mb-3" size={44} />
            <p className="text-gray-500 font-semibold">No hay citas en esta vista.</p>
            <p className="text-sm text-gray-400 mt-1">Toca el botón + para agendar una.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
          {citasVisibles.map((cita) => {
            const vencida = cita.estado === 'Pendiente' && isCitaPasada(cita, now);
            return (
            <motion.div 
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
              key={cita.id} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative overflow-hidden transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)]"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${TIPO_COLOR[cita.tipo] ?? 'bg-gray-400'}`}></div>

              <div className="pl-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {cita.tipo}
                  </span>
                  <span className={`text-xs font-bold ${vencida ? 'text-red-500' : cita.estado === 'Pendiente' ? 'text-amber-500' : cita.estado === 'Cancelada' ? 'text-gray-400' : 'text-green-600'}`}>
                    ● {vencida ? 'Vencida' : cita.estado}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-base mb-3 leading-snug">{cita.titulo}</h3>

                <div className="space-y-1.5 text-sm text-gray-500">
                  {cita.cliente?.trim() ? (
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-vinotinto/60 shrink-0" />
                      <span>Cliente: <span className="font-medium text-gray-700">{cita.cliente}</span></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <User size={14} className="text-gray-300 shrink-0" />
                      <span className="text-xs italic">Sin cliente asignado</span>
                    </div>
                  )}
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
                      // FIX UI#2 — Muestra todos los asesores de la cita, no solo "Registrada por mí"
                      <>Asesor(es): <span className="font-semibold text-gray-600">{cita.asesores.join(', ')}</span></>
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
                    {(isAdmin || cita.asesores.some(a => normalize(a) === myNombre)) && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(cita)}
                          className="flex items-center gap-1 text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition"
                          title="Editar cita"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(cita.id)}
                          className="flex items-center gap-1 text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition"
                          title="Eliminar cita"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })}
          </AnimatePresence>
        )}
      </motion.div>
      </AnimatePresence>

      {/* FAB */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom)+1rem)] right-5 w-14 h-14 bg-vinotinto text-white rounded-full flex items-center justify-center shadow-lg shadow-vinotinto/30 active:scale-90 transition-transform z-20"
      >
        <Plus size={28} />
      </button>

      {/* MODAL */}
      <AnimatePresence>
      {isModalOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="modal-container bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Agendar Cita</h2>
                <button onClick={() => { setIsModalOpen(false); setSubmitError(null); }} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form-content space-y-4">
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{submitError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cita</label>
                  <select name="tipo" value={formData.tipo} onChange={handleInputChange}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none font-medium text-gray-800">
                    <option value="Cita en Oficina">🏢 Cita en Oficina</option>
                    <option value="Mostrar Propiedad">🏡 Mostrar Propiedad</option>
                    <option value="Captar Propiedad">📝 Captar Propiedad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Propiedad o Asunto</label>
                  <input type="text" name="titulo" value={formData.titulo} onChange={handleInputChange} required
                    placeholder="Ej: Visita Villa Costa Azul"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Cliente <span className="text-gray-400 font-normal text-xs">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    name="cliente"
                    value={formData.cliente}
                    onChange={handleInputChange}
                    placeholder="Ej: María López (dejar vacío si no aplica)"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" name="fecha" value={formData.fecha} min={minFecha} onChange={handleInputChange} required
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none touch-manipulation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                    <input type="time" name="hora" value={formData.hora} min={formData.fecha === minFecha ? minHora : undefined} onChange={handleInputChange} required
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none touch-manipulation" />
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

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-xl font-bold shadow-lg shadow-vinotinto/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cita'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* MODAL DE EDICIÓN DE CITA */}
      <AnimatePresence>
      {isEditModalOpen && (
        <div className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="modal-container bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Edit2 size={20} className="text-vinotinto" />
                <h2 className="text-xl font-bold text-gray-800">Editar Cita</h2>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setEditSubmitError(null); }} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form-content space-y-4">
              {editSubmitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{editSubmitError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cita</label>
                <select
                  name="tipo"
                  value={editFormData.tipo}
                  onChange={e => setEditFormData({ ...editFormData, tipo: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none font-medium text-gray-800"
                >
                  <option value="Cita en Oficina">🏢 Cita en Oficina</option>
                  <option value="Mostrar Propiedad">🏡 Mostrar Propiedad</option>
                  <option value="Captar Propiedad">📝 Captar Propiedad</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Propiedad o Asunto</label>
                <input
                  type="text"
                  name="titulo"
                  value={editFormData.titulo}
                  onChange={e => setEditFormData({ ...editFormData, titulo: e.target.value })}
                  required
                  placeholder="Ej: Visita Villa Costa Azul"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente <span className="text-gray-400 font-normal text-xs">(Opcional)</span>
                </label>
                <input
                  type="text"
                  name="cliente"
                  value={editFormData.cliente}
                  onChange={e => setEditFormData({ ...editFormData, cliente: e.target.value })}
                  placeholder="Ej: María López (dejar vacío si no aplica)"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    value={editFormData.fecha}
                    min={minFecha}
                    onChange={e => setEditFormData({ ...editFormData, fecha: e.target.value })}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium touch-manipulation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input
                    type="time"
                    name="hora"
                    value={editFormData.hora}
                    min={editFormData.fecha === minFecha ? minHora : undefined}
                    onChange={e => setEditFormData({ ...editFormData, hora: e.target.value })}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium touch-manipulation"
                  />
                </div>
              </div>

              {/* Asesores */}
              {isAdmin ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Asignar Asesores</label>
                  <div className="space-y-2 border border-gray-200 p-3 rounded-xl max-h-40 overflow-y-auto bg-gray-50">
                    {allUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer p-1">
                        <input
                          type="checkbox"
                          checked={editFormData.asesoresIds.includes(u.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditFormData(prev => ({
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
                    Asignado a: <span className="font-bold">{user?.nombre}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 pb-1">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-xl font-bold shadow-md hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save size={16} />
                  {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}


