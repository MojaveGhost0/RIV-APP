'use client';

import { useState, useRef } from 'react';
import { useAuth, AuthUser, UserRole } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from 'next/navigation';
import {
  User, Shield, ChevronRight, LogOut, Home, Calendar, Phone,
  MessageCircle, Edit2, CheckCircle, X, Save, AlertCircle,
  Upload, RotateCcw, Sparkles, Image as ImageIcon, Users, Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants } from '../lib/motion';
import BrandLogo from '../components/BrandLogo';
import { DEFAULT_BRAND_CONFIG } from '../lib/brandConfig';

export default function Perfil() {
  const { user, isAdmin, logout, updateUserPhone, updateAgencyLogo, getAllUsers, addUser, updateUser, deleteUser } = useAuth();
  const { properties, appointments } = useData();
  const router = useRouter();

  const [isEditPhoneModalOpen, setIsEditPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Estados de Branding / Logo
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados de Gestión de Usuarios (Admin)
  const [isUserManageModalOpen, setIsUserManageModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AuthUser | null>(null);
  const [manageUserError, setManageUserError] = useState('');
  const [manageUserSuccess, setManageUserSuccess] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    nombre: '',
    email: '',
    password: '',
    rol: 'ASESOR' as UserRole,
  });

  const handleOpenManageUser = (existingUser?: AuthUser) => {
    setManageUserError('');
    setManageUserSuccess('');
    if (existingUser) {
      setUserToEdit(existingUser);
      setUserForm({
        username: existingUser.username,
        nombre: existingUser.nombre,
        email: existingUser.email,
        password: '', // Leave blank, only update if typed
        rol: existingUser.rol,
      });
    } else {
      setUserToEdit(null);
      setUserForm({
        username: '',
        nombre: '',
        email: '',
        password: '',
        rol: 'ASESOR',
      });
    }
    setIsUserManageModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setManageUserError('');
    setIsSavingUser(true);
    try {
      if (userToEdit) {
        // Edit
        const dataToUpdate: Partial<AuthUser> & { password?: string } = {
          username: userForm.username,
          nombre: userForm.nombre,
          email: userForm.email,
          rol: userForm.rol,
        };
        if (userForm.password) {
          dataToUpdate.password = userForm.password;
        }
        await updateUser(userToEdit.id, dataToUpdate);
        setManageUserSuccess('Usuario actualizado con éxito.');
      } else {
        // Add
        if (!userForm.password) {
          throw new Error('La contraseña es obligatoria para un usuario nuevo.');
        }
        await addUser(userForm);
        setManageUserSuccess('Usuario creado con éxito.');
      }
      setTimeout(() => {
        setIsUserManageModalOpen(false);
        setManageUserSuccess('');
      }, 1500);
    } catch (err: any) {
      setManageUserError(err?.message || 'Error al guardar el usuario.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === user?.id) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${name}?`)) {
      try {
        await deleteUser(id);
        alert('Usuario eliminado.');
      } catch (err: any) {
        alert(err?.message || 'Error eliminando el usuario.');
      }
    }
  };

  const misCaptaciones = properties.filter(p => p.captador === user?.nombre);
  const misVentas = misCaptaciones.filter(p => p.status === 'Vendida').length;
  const misCitasPendientes = appointments.filter(
    a => a.asesores.includes(user?.nombre ?? '') && a.estado === 'Pendiente'
  );

  const handleOpenEditPhone = () => {
    setPhoneInput(user?.telefono || '');
    setPhoneError('');
    setIsEditPhoneModalOpen(true);
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneInput.trim();
    if (clean.replace(/\D/g, '').length < 7) {
      setPhoneError('Por favor ingresa un número de teléfono válido (mínimo 7 dígitos).');
      return;
    }
    setIsSavingPhone(true);
    setPhoneError('');
    try {
      await updateUserPhone(clean);
      setIsEditPhoneModalOpen(false);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch (err: any) {
      setPhoneError(err?.message || 'Error al guardar el teléfono.');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo (SVG o PNG transparente)
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    if (!isSvg && !isPng) {
      setLogoFeedback({
        type: 'error',
        message: 'Formato no compatible. Por favor sube un archivo SVG o PNG con fondo transparente.'
      });
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setLogoFeedback({
        type: 'error',
        message: 'El archivo excede el tamaño máximo permitido (3 MB).'
      });
      return;
    }

    setIsUploadingLogo(true);
    setLogoFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        if (result) {
          await updateAgencyLogo(result);
          setLogoFeedback({
            type: 'success',
            message: '¡Logo corporativo / agencia actualizado con éxito en todo el sistema!'
          });
          setTimeout(() => setLogoFeedback(null), 4500);
        }
      } catch (err: any) {
        setLogoFeedback({
          type: 'error',
          message: err?.message || 'Error al guardar el logo.'
        });
      } finally {
        setIsUploadingLogo(false);
        if (logoFileInputRef.current) logoFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploadingLogo(false);
      setLogoFeedback({
        type: 'error',
        message: 'Error al leer el archivo de logo seleccionado.'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async () => {
    setIsUploadingLogo(true);
    try {
      await updateAgencyLogo('');
      setLogoFeedback({
        type: 'success',
        message: 'Se ha restablecido el logo oficial predeterminado (LOGO RIV MARGARITA PREMIER.svg).'
      });
      setTimeout(() => setLogoFeedback(null), 4000);
    } catch (err: any) {
      setLogoFeedback({
        type: 'error',
        message: 'Error al restablecer el logo.'
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

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
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-vinotinto/10 text-vinotinto' : 'bg-blue-50 text-blue-600'
              }`}>
                <Shield size={11} /> {user?.rol}
              </span>
              {user?.telefono && (
                <span className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Phone size={10} /> {user.telefono}
                </span>
              )}
            </div>
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

        {/* TELÉFONO DE CONTACTO DEL ASESOR */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-vinotinto" />
              <h3 className="text-sm font-bold text-gray-800">Teléfono Oficial de Contacto</h3>
            </div>
            <button
              onClick={handleOpenEditPhone}
              className="text-xs font-bold text-vinotinto hover:bg-vinotinto/5 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
            >
              <Edit2 size={13} /> {user?.telefono ? 'Modificar' : 'Agregar Teléfono'}
            </button>
          </div>

          {phoneSaved && (
            <div className="p-2.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle size={14} className="text-green-600 shrink-0" />
              <span>Teléfono guardado correctamente en tu perfil.</span>
            </div>
          )}

          {user?.telefono ? (
            <div className="bg-gray-50 p-3.5 rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-gray-400 font-medium">Línea directa para clientes e inmuebles captados</p>
                <p className="text-base font-black text-gray-900 font-mono tracking-wide mt-0.5">{user.telefono}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`https://wa.me/${user.telefono.replace(/\D/g, '').startsWith('0') ? '58' + user.telefono.replace(/\D/g, '').slice(1) : user.telefono.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1 transition active:scale-95"
                  title="Abrir chat en WhatsApp"
                >
                  <MessageCircle size={13} /> WhatsApp
                </a>
                <a
                  href={`tel:${user.telefono}`}
                  className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-1 transition active:scale-95"
                  title="Realizar llamada de prueba"
                >
                  <Phone size={13} /> Llamar
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-2">
              <div>
                <p className="font-bold">Aún no tienes registrado tu número de teléfono.</p>
                <p className="text-amber-700 mt-0.5">Es necesario para que tus clientes y colegas puedan contactarte directamente por WhatsApp en tus captaciones.</p>
              </div>
              <button
                onClick={handleOpenEditPhone}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shrink-0 transition shadow-sm"
              >
                Registrar
              </button>
            </div>
          )}
        </motion.div>

        {/* BRANDING Y GESTIÓN DE LOGO CORPORATIVO */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-vinotinto/10 flex items-center justify-center text-vinotinto">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Identidad Corporativa & Logo</h3>
                <p className="text-[11px] text-gray-400">Branding global para fichas, catálogo, PDFs y redes</p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              user?.agencyLogo 
                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {user?.agencyLogo ? 'Logo Franquicia' : 'Logo Oficial RIV'}
            </span>
          </div>

          {/* PREVIEW DEL LOGO ACTUAL */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-center min-h-[95px] shadow-inner relative overflow-hidden group">
            <div className="absolute top-2 left-3 text-[9px] font-mono uppercase tracking-widest text-white/40">
              Vista previa activa
            </div>
            <BrandLogo size="md" className="z-10 transition-transform duration-300 group-hover:scale-105" />
          </div>

          {logoFeedback && (
            <div className={`p-2.5 text-xs rounded-xl flex items-center gap-2 ${
              logoFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {logoFeedback.type === 'success' ? (
                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={14} className="text-red-600 shrink-0" />
              )}
              <span>{logoFeedback.message}</span>
            </div>
          )}

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <input
              ref={logoFileInputRef}
              type="file"
              accept=".svg,.png,image/svg+xml,image/png"
              className="hidden"
              onChange={handleLogoFileSelect}
            />
            <button
              onClick={() => logoFileInputRef.current?.click()}
              disabled={isUploadingLogo}
              className="flex-1 py-2.5 px-3 bg-vinotinto text-white rounded-xl text-xs font-bold hover:bg-[#a60029] active:scale-95 transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <Upload size={13} />
              {isUploadingLogo ? 'Guardando...' : 'Cargar Logo Propio (PNG / SVG)'}
            </button>

            {user?.agencyLogo && (
              <button
                onClick={handleResetLogo}
                disabled={isUploadingLogo}
                className="py-2.5 px-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
                title="Volver al logo oficial de RIV Margarita Premier"
              >
                <RotateCcw size={13} />
                Restablecer RIV
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 leading-normal">
            Acepta SVG vectorial oficial o PNG transparente (máx. 3MB). Este logo se reflejará automáticamente en la barra superior, fichas técnicas PDF, plantillas de Instagram Stories / Feed y marcas de agua de videos.
          </p>
        </motion.div>

        {/* GESTIÓN DE USUARIOS (SOLO ADMIN) */}
        {isAdmin && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Gestión de Equipo</h3>
                  <p className="text-[11px] text-gray-400">{getAllUsers().length} usuarios registrados</p>
                </div>
              </div>
              <button
                onClick={() => handleOpenManageUser()}
                className="text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow-sm"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>

            <div className="mt-3 divide-y divide-gray-50 border border-gray-50 rounded-xl overflow-hidden">
              {getAllUsers().map(u => (
                <div key={u.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      {u.nombre}
                      {u.rol === 'ADMIN' && <Shield size={12} className="text-vinotinto" />}
                    </p>
                    <p className="text-xs text-gray-500">{u.username} • {u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenManageUser(u)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Editar usuario"
                    >
                      <Edit2 size={14} />
                    </button>
                    {u.id !== user?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.nombre)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

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

      {/* MODAL EDITAR TELÉFONO */}
      <AnimatePresence>
        {isEditPhoneModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Phone size={18} className="text-vinotinto" />
                  <h3 className="text-base font-bold text-gray-900">Teléfono del Asesor</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditPhoneModalOpen(false)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {phoneError && (
                <div className="p-2.5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0 text-red-500" />
                  <span>{phoneError}</span>
                </div>
              )}

              <form onSubmit={handleSavePhone} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Número de Teléfono (WhatsApp / Llamadas)
                  </label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    placeholder="Ej: 0414-1234567 o +58 414 1234567"
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-mono font-bold"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Este número aparecerá en tus inmuebles captados para que clientes y asesores te contacten directamente.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditPhoneModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPhone}
                    className="flex-[2] py-2.5 bg-vinotinto text-white rounded-xl font-bold hover:bg-[#a60029] flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 transition text-xs"
                  >
                    <Save size={14} />
                    {isSavingPhone ? 'Guardando...' : 'Guardar Teléfono'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        {/* MODAL GESTION DE USUARIO */}
      <AnimatePresence>
        {isUserManageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl my-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    {userToEdit ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserManageModalOpen(false)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {manageUserError && (
                <div className="p-2.5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0 text-red-500" />
                  <span>{manageUserError}</span>
                </div>
              )}
              {manageUserSuccess && (
                <div className="p-2.5 mb-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-1.5">
                  <CheckCircle size={14} className="shrink-0 text-green-500" />
                  <span>{manageUserSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveUser} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={userForm.nombre}
                      onChange={e => setUserForm({ ...userForm, nombre: e.target.value })}
                      required
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Username (Login)</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                      required
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                    required
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Rol</label>
                    <select
                      value={userForm.rol}
                      onChange={e => setUserForm({ ...userForm, rol: e.target.value as UserRole })}
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm bg-white"
                    >
                      <option value="ASESOR">ASESOR</option>
                      <option value="ADMIN">ADMIN (Acceso Total)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Contraseña {userToEdit && '(Opcional)'}</label>
                    <input
                      type="text"
                      value={userForm.password}
                      onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                      required={!userToEdit}
                      placeholder={userToEdit ? 'Dejar en blanco para no cambiar' : 'Requerida'}
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsUserManageModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUser}
                    className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 transition text-xs"
                  >
                    <Save size={14} />
                    {isSavingUser ? 'Guardando...' : 'Guardar Usuario'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

