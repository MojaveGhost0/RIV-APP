'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Bed, Bath, Maximize, User, ChevronLeft, ChevronRight,
  Share2, Trash2, ShieldAlert, Download, CheckCircle, Phone, MessageCircle,
  CircleDollarSign, CreditCard, Edit3, X, Save, AlertTriangle, Camera,
  UploadCloud, Loader2, Star, ImagePlus, ExternalLink, Map,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import ExportModal from '../../components/ExportModal';
import { useAuth } from '../../context/AuthContext';
import { containerVariants, itemVariants } from '../../lib/motion';
import { normalize } from '../../lib/searchEngine';
import { uploadToCloudinary } from '../../lib/cloudinary';
import BrandLogo from '../../components/BrandLogo';

const STATUS_OPTIONS = ['Activa', 'Suspendida', 'Vendida'];

const STATUS_STYLE: Record<string, string> = {
  'Activa':     'bg-green-100 text-green-700 border-green-200',
  'Vendida':    'bg-gray-100 text-gray-600 border-gray-200',
  'Suspendida': 'bg-amber-100 text-amber-700 border-amber-200',
};

export default function InmuebleDetalle({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { properties, deleteProperty, updatePropertyStatus, updateProperty, crmLogs, updateCrmLog } = useData();
  const { user, isAdmin, getAdvisorPhone } = useAuth();

  const property = properties.find(p => p.id === id);
  const captadorPhone = property?.captador ? getAdvisorPhone(property.captador) : undefined;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const [statusChanged, setStatusChanged] = useState(false);

  // Control de permisos: Admin puede editar todo; usuario normal solo si es el captador
  const myNombre = normalize(user?.nombre ?? '');
  const isCaptador = property?.captador ? normalize(property.captador) === myNombre : false;
  const canManageProperty = isAdmin || isCaptador;

  // Estado del Modal de Edición de Inmueble
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  
  // Fotos en edición
  const [editImages, setEditImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editFormData, setEditFormData] = useState({
    title: '',
    price: '',
    location: '',
    mapsUrl: '',
    beds: '',
    baths: '',
    sqm: '',
    description: '',
    propietarioNombre: '',
    propietarioTelefono: '',
    formasNegociacion: '',
    metodosPago: '',
  });

  if (!property) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <p className="text-3xl mb-3">🏠</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Inmueble no encontrado</h2>
        <p className="text-sm text-gray-500 mb-6">Este inmueble no existe o fue eliminado.</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2.5 bg-vinotinto text-white rounded-xl font-bold"
        >
          <ArrowLeft size={16} /> Volver al Inventario
        </button>
      </div>
    );
  }

  const allImages = [property.image, ...(property.images ?? [])].filter(
    (img, i, arr) => img && arr.indexOf(img) === i
  );

  const prevImage = () => setActiveImageIndex(i => (i - 1 + allImages.length) % allImages.length);
  const nextImage = () => setActiveImageIndex(i => (i + 1) % allImages.length);

  const handleDelete = () => {
    if (confirm(`¿Eliminar "${property.title}"? Esta acción no se puede deshacer.`)) {
      deleteProperty(property.id);
      router.replace('/inventario');
    }
  };

  const handleStatusChange = (newStatus: string) => {
    updatePropertyStatus(property.id, newStatus);
    setStatusChanged(true);
    setTimeout(() => setStatusChanged(false), 2000);
  };

  const handleOpenEditModal = () => {
    setEditFormData({
      title: property.title,
      price: String(property.price),
      location: property.location,
      mapsUrl: property.mapsUrl || '',
      beds: String(property.beds),
      baths: String(property.baths),
      sqm: String(property.sqm),
      description: property.description,
      propietarioNombre: property.propietarioNombre || '',
      propietarioTelefono: property.propietarioTelefono || '',
      formasNegociacion: property.formasNegociacion || '',
      metodosPago: property.metodosPago || '',
    });

    const initialImages = [property.image, ...(property.images ?? [])].filter(
      (img, i, arr) => Boolean(img) && arr.indexOf(img) === i
    ) as string[];
    setEditImages(initialImages);
    setUploadError(null);
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setEditImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetCoverPhoto = (indexToCover: number) => {
    setEditImages(prev => {
      const target = prev[indexToCover];
      const remaining = prev.filter((_, idx) => idx !== indexToCover);
      return [target, ...remaining];
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploadingImages(true);

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setUploadError('Por favor selecciona archivos de imagen válidos (PNG, JPG, WEBP).');
      setIsUploadingImages(false);
      return;
    }

    try {
      const uploadPromises = validFiles.map(file => uploadToCloudinary(file));
      const newUrls = await Promise.all(uploadPromises);
      setEditImages(prev => [...prev, ...newUrls.filter(Boolean)]);
    } catch (err: any) {
      console.error('Error al subir imágenes:', err);
      setUploadError(err?.message || 'Error al subir una o más imágenes a Cloudinary.');
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.title.trim() || !editFormData.location.trim() || !editFormData.price) {
      setEditError('Título, precio y ubicación son requeridos.');
      return;
    }

    if (editImages.length === 0) {
      setEditError('El inmueble debe tener al menos una fotografía.');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      const newTitle = editFormData.title.trim();
      const oldTitle = property.title;

      await updateProperty(property.id, {
        title: newTitle,
        price: Number(editFormData.price.replace(/\D/g, '')) || property.price,
        location: editFormData.location.trim(),
        mapsUrl: editFormData.mapsUrl.trim() || undefined,
        beds: Number(editFormData.beds) || 0,
        baths: Number(editFormData.baths) || 0,
        sqm: Number(editFormData.sqm) || 0,
        description: editFormData.description.trim(),
        image: editImages[0] || '',
        images: editImages,
        propietarioNombre: editFormData.propietarioNombre.trim(),
        propietarioTelefono: editFormData.propietarioTelefono.trim(),
        formasNegociacion: editFormData.formasNegociacion.trim(),
        metodosPago: editFormData.metodosPago.trim(),
      });

      // Si el título cambió, sincronizar notas del CRM para evitar discrepancias
      if (oldTitle && newTitle && oldTitle !== newTitle && crmLogs && updateCrmLog) {
        const matchingLogs = crmLogs.filter(log =>
          normalize(log.notas).includes(normalize(oldTitle))
        );
        for (const log of matchingLogs) {
          const updatedNotes = log.notas.replace(new RegExp(oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), newTitle);
          try {
            await updateCrmLog(log.id, { notas: updatedNotes });
          } catch (logErr) {
            console.warn('Aviso: no se pudo actualizar log del CRM con nuevo título:', logErr);
          }
        }
      }

      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Error al editar propiedad:', err);
      setEditError(err?.message || 'Error al guardar los cambios.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleShare = async () => {
    const text = `🏠 ${property.title}\n📍 ${property.location}\n💰 $${property.price.toLocaleString()} USD\n🛏 ${property.beds} hab · 🚿 ${property.baths} baños · 📐 ${property.sqm}m²`;
    try {
      if (navigator.share) {
        await navigator.share({ title: property.title, text });
      } else {
        // FIX handleShare — navigator.clipboard requiere HTTPS o localhost.
        // Envuelto en try/catch para evitar excepción no capturada en HTTP/dev.
        await navigator.clipboard.writeText(text);
        alert('¡Información copiada al portapapeles!');
      }
    } catch {
      // Fallback manual si la API de clipboard no está disponible
      alert('No se pudo compartir. Copia manualmente:\n\n' + text);
    }
  };

  const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23f3f4f6\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%239ca3af\' font-size=\'48\'%3E🏠%3C/text%3E%3C/svg%3E';

  return (
    <div className="bg-white min-h-[100dvh]">

      {/* GALERÍA DE FOTOS */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full h-72 bg-gray-200"
      >
        <img
          src={imgError[activeImageIndex] ? PLACEHOLDER : allImages[activeImageIndex]}
          alt={`Foto ${activeImageIndex + 1} de ${property.title}`}
          className="w-full h-full object-cover"
          onError={() => setImgError(prev => ({ ...prev, [activeImageIndex]: true }))}
        />

        {/* Overlay gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

        {/* Botón atrás y Logo */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-black/35 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 flex items-center">
            <BrandLogo size="xs" variant="light" />
          </div>
        </div>

        {/* Botón compartir */}
        <button
          onClick={handleShare}
          className="absolute top-4 right-16 w-10 h-10 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition"
        >
          <Share2 size={18} />
        </button>

        {/* Botón exportar */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="absolute top-4 right-4 w-10 h-10 bg-vinotinto/90 backdrop-blur-sm border border-vinotinto/30 rounded-full flex items-center justify-center text-white hover:bg-vinotinto transition shadow-md"
        >
          <Download size={18} />
        </button>

        {/* Navegación de imágenes */}
        {allImages.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/50 transition">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/50 transition">
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Indicadores de foto */}
        {allImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImageIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === activeImageIndex ? 'bg-white w-5' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}

        {/* Contador de fotos */}
        <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full">
          {activeImageIndex + 1}/{allImages.length}
        </div>
      </motion.div>

      {/* THUMBNAILS */}
      {allImages.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide bg-gray-50 border-b border-gray-100">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImageIndex(i)}
              className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeImageIndex ? 'border-vinotinto shadow-md' : 'border-transparent opacity-60'
              }`}
            >
              <img
                src={imgError[i] ? PLACEHOLDER : img}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(prev => ({ ...prev, [i]: true }))}
              />
            </button>
          ))}
        </div>
      )}

      {/* CONTENIDO */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-5 pt-5 pb-28 space-y-5"
      >

        {/* Título y precio */}
        <motion.div variants={itemVariants}>
          <div className="flex justify-between items-start gap-2 mb-2">
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight flex-1">{property.title}</h1>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 mt-1 border ${STATUS_STYLE[property.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {property.status}
            </span>
          </div>
          <p className="text-3xl font-black text-vinotinto">${property.price.toLocaleString()} <span className="text-base font-semibold text-gray-400">USD</span></p>
        </motion.div>

        {/* Ubicación */}
        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <MapPin size={16} className="text-vinotinto shrink-0" />
            <p className="text-sm">{property.location}</p>
          </div>
          <a
            href={
              property.mapsUrl?.trim()
                ? property.mapsUrl.trim()
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.location + ', Venezuela')}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-600 rounded-xl font-bold text-sm transition-all active:scale-95 group"
          >
            <Map size={16} className="group-hover:scale-110 transition-transform" />
            {property.mapsUrl?.trim() ? 'Ver ubicación exacta en Google Maps' : 'Ver en Google Maps'}
            <ExternalLink size={13} className="opacity-60" />
          </a>
        </motion.div>

        {/* Características */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          {[
            { icon: <Bed size={20} className="text-vinotinto" />, value: property.beds, label: 'Habitaciones' },
            { icon: <Bath size={20} className="text-vinotinto" />, value: property.baths, label: 'Baños' },
            { icon: <Maximize size={20} className="text-vinotinto" />, value: `${property.sqm}m²`, label: 'Área' },
          ].map((f, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
              <div className="flex justify-center mb-1">{f.icon}</div>
              <p className="text-xl font-extrabold text-gray-800">{f.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{f.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Descripción */}
        <motion.div variants={itemVariants}>
          <h2 className="text-base font-bold text-gray-800 mb-2">Descripción</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{property.description}</p>
        </motion.div>

        {/* Comodidades */}
        {property.amenities && property.amenities.length > 0 && (
          <motion.div variants={itemVariants}>
            <h2 className="text-base font-bold text-gray-800 mb-3">Comodidades</h2>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map(amenity => (
                <span key={amenity} className="px-3 py-1 bg-vinotinto/5 text-vinotinto border border-vinotinto/10 rounded-full text-xs font-semibold">
                  {amenity}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Captador */}
        <motion.div variants={itemVariants} className="bg-vinotinto/5 border border-vinotinto/10 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vinotinto flex items-center justify-center shrink-0 shadow-sm">
              <User size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Asesor Captador</p>
              <p className="font-bold text-gray-800">{property.captador}</p>
              {captadorPhone && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-medium font-mono">
                  <Phone size={11} className="text-vinotinto" /> {captadorPhone}
                </p>
              )}
            </div>
          </div>
          {captadorPhone && (
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`https://wa.me/${captadorPhone.replace(/\D/g, '').startsWith('0') ? '58' + captadorPhone.replace(/\D/g, '').slice(1) : captadorPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1 active:scale-95"
                title="Contactar asesor por WhatsApp"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
              <a
                href={`tel:${captadorPhone}`}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition active:scale-95"
                title="Llamar al asesor"
              >
                <Phone size={14} />
              </a>
            </div>
          )}
        </motion.div>

        {/* Datos del Propietario y Negociación */}
        {(property.propietarioNombre || property.propietarioTelefono || property.formasNegociacion || property.metodosPago) && (
          <motion.div variants={itemVariants} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-vinotinto" /> Información de Negociación y Propietario
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {property.propietarioNombre && (
                <div className="bg-gray-50 p-2.5 rounded-xl">
                  <span className="text-gray-400 block mb-0.5 font-medium">Propietario</span>
                  <span className="font-bold text-gray-800 text-sm">{property.propietarioNombre}</span>
                </div>
              )}

              {property.propietarioTelefono && (
                <div className="bg-gray-50 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 block mb-0.5 font-medium">Teléfono de Contacto</span>
                    <span className="font-bold text-gray-800">{property.propietarioTelefono}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`https://wa.me/${property.propietarioTelefono.replace(/\D/g, '').startsWith('0') ? '58' + property.propietarioTelefono.replace(/\D/g, '').slice(1) : property.propietarioTelefono.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm transition"
                      title="Escribir por WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </a>
                    <a
                      href={`tel:${property.propietarioTelefono}`}
                      className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
                      title="Llamar"
                    >
                      <Phone size={15} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {property.formasNegociacion && (
              <div className="bg-gray-50 p-2.5 rounded-xl text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1 mb-1">
                  <CircleDollarSign size={13} className="text-vinotinto" /> Formas de Negociación
                </span>
                <p className="font-semibold text-gray-800 leading-relaxed">{property.formasNegociacion}</p>
              </div>
            )}

            {property.metodosPago && (
              <div className="bg-gray-50 p-2.5 rounded-xl text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1 mb-1">
                  <CreditCard size={13} className="text-emerald-700" /> Métodos de Pago Aceptados
                </span>
                <p className="font-semibold text-gray-800 leading-relaxed">{property.metodosPago}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Panel de Gestión (Admin o Asesor Captador) */}
        {canManageProperty && (
          <motion.div variants={itemVariants} className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} className={isAdmin ? "text-vinotinto" : "text-emerald-600"} />
                {isAdmin ? 'Panel de Gestión (Admin)' : 'Gestión de Mi Inmueble Captado'}
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-vinotinto/10 text-vinotinto' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isAdmin ? 'Control Total Admin' : 'Tu captación'}
              </span>
            </div>

            {/* CAMBIAR ESTADO */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Cambiar Estado del Inmueble</p>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      property.status === s
                        ? STATUS_STYLE[s] + ' shadow-sm'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {statusChanged && (
                <div className="flex items-center gap-1.5 mt-2 text-green-600 text-xs font-semibold">
                  <CheckCircle size={13} /> Estado actualizado correctamente
                </div>
              )}
            </div>

            {/* BOTÓN EDITAR */}
            <button
              onClick={handleOpenEditModal}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-vinotinto/30 bg-vinotinto/5 text-vinotinto font-bold hover:bg-vinotinto/10 active:scale-95 transition-all text-sm"
            >
              <Edit3 size={16} />
              Editar Datos del Inmueble
            </button>

            {/* ELIMINAR */}
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-500 font-bold hover:bg-red-100 active:scale-95 transition-all text-sm"
            >
              <Trash2 size={16} />
              Eliminar Inmueble
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* MODAL DE EDICIÓN DE INMUEBLE */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Edit3 size={20} className="text-vinotinto" />
                  <h2 className="text-lg font-bold text-gray-900">Editar Inmueble</h2>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {editError && (
                <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-red-500" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                {/* ── GESTIÓN DE FOTOGRAFÍAS ── */}
                <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Camera size={14} className="text-vinotinto" /> Fotografías ({editImages.length})
                    </label>
                    <span className="text-[10px] text-gray-400">
                      La primera foto es la portada
                    </span>
                  </div>

                  {uploadError && (
                    <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 text-red-500" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Grid de Fotos Existentes */}
                  {editImages.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {editImages.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white aspect-square shadow-sm">
                          <img
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {idx === 0 ? (
                            <span className="absolute top-1 left-1 bg-vinotinto text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              Portada
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCoverPhoto(idx)}
                              title="Establecer como portada"
                              className="absolute top-1 left-1 bg-black/60 hover:bg-dorado hover:text-gray-900 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow"
                            >
                              <Star size={11} />
                            </button>
                          )}

                          {/* Botón Borrar Foto */}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            title="Eliminar foto"
                            className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-700 text-white p-1 rounded-md transition shadow"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón para Añadir/Subir Fotos */}
                  <div>
                    <label className={`w-full border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                      isUploadingImages
                        ? 'border-vinotinto/40 bg-vinotinto/5 pointer-events-none'
                        : 'border-gray-200 hover:border-vinotinto hover:bg-vinotinto/5 bg-white'
                    }`}>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleFilesSelected}
                        disabled={isUploadingImages}
                      />
                      {isUploadingImages ? (
                        <div className="flex items-center gap-2 text-vinotinto font-bold text-xs py-1">
                          <Loader2 size={16} className="animate-spin" />
                          <span>Subiendo imágenes a la nube...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-600 font-semibold text-xs py-1">
                          <UploadCloud size={16} className="text-vinotinto" />
                          <span>Añadir o subir más fotos</span>
                          <span className="text-[10px] text-gray-400 font-normal">(PNG, JPG, WEBP)</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Título del Inmueble *</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                    required
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Precio (USD) *</label>
                    <input
                      type="text"
                      value={editFormData.price}
                      onChange={e => setEditFormData({ ...editFormData, price: e.target.value })}
                      required
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-black text-vinotinto"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Área (m²)</label>
                    <input
                      type="number"
                      value={editFormData.sqm}
                      onChange={e => setEditFormData({ ...editFormData, sqm: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Ubicación *</label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={e => setEditFormData({ ...editFormData, location: e.target.value })}
                    required
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                  />
                </div>

                {/* URL de Google Maps */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Map size={13} className="text-blue-500" />
                    Enlace de Google Maps
                    <span className="text-gray-400 font-normal text-[10px] ml-1">(opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={editFormData.mapsUrl}
                    onChange={e => setEditFormData({ ...editFormData, mapsUrl: e.target.value })}
                    placeholder="https://maps.app.goo.gl/..."
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 outline-none text-sm font-mono"
                  />
                  {editFormData.mapsUrl.trim() && (
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                        ✓ Enlace personalizado guardado
                      </p>
                      <a
                        href={editFormData.mapsUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 font-bold underline underline-offset-2 hover:text-blue-700"
                      >
                        Verificar enlace →
                      </a>
                    </div>
                  )}
                  {!editFormData.mapsUrl.trim() && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Si no se ingresa, se usará la búsqueda automática por nombre de zona.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Habitaciones</label>
                    <input
                      type="number"
                      value={editFormData.beds}
                      onChange={e => setEditFormData({ ...editFormData, beds: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Baños</label>
                    <input
                      type="number"
                      value={editFormData.baths}
                      onChange={e => setEditFormData({ ...editFormData, baths: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Descripción</label>
                  <textarea
                    rows={3}
                    value={editFormData.description}
                    onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm leading-relaxed"
                  />
                </div>

                {/* Datos Propietario y Negociación */}
                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <p className="font-bold text-gray-500 uppercase tracking-wider text-[11px]">
                    Datos del Propietario y Negociación
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Nombre Propietario</label>
                      <input
                        type="text"
                        value={editFormData.propietarioNombre}
                        onChange={e => setEditFormData({ ...editFormData, propietarioNombre: e.target.value })}
                        className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={editFormData.propietarioTelefono}
                        onChange={e => setEditFormData({ ...editFormData, propietarioTelefono: e.target.value })}
                        className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Formas de Negociación</label>
                    <input
                      type="text"
                      value={editFormData.formasNegociacion}
                      onChange={e => setEditFormData({ ...editFormData, formasNegociacion: e.target.value })}
                      placeholder="Ej: Precio negociable, acepta financiamiento..."
                      className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Métodos de Pago Aceptados</label>
                    <input
                      type="text"
                      value={editFormData.metodosPago}
                      onChange={e => setEditFormData({ ...editFormData, metodosPago: e.target.value })}
                      placeholder="Ej: Efectivo USD, Zelle, Transferencia..."
                      className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex-[2] py-2.5 bg-vinotinto text-white rounded-xl font-bold hover:bg-[#a60029] flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 transition"
                  >
                    <Save size={15} />
                    {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ExportModal
        property={property}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
