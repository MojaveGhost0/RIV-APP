'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Bed, Bath, Maximize, User, ChevronLeft, ChevronRight, Share2, Trash2, ShieldAlert, Download, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import ExportModal from '../../components/ExportModal';
import { useAuth } from '../../context/AuthContext';
import { containerVariants, itemVariants } from '../../lib/motion';

const STATUS_OPTIONS = ['Activa', 'Suspendida', 'Vendida'];

const STATUS_STYLE: Record<string, string> = {
  'Activa':     'bg-green-100 text-green-700 border-green-200',
  'Vendida':    'bg-gray-100 text-gray-600 border-gray-200',
  'Suspendida': 'bg-amber-100 text-amber-700 border-amber-200',
};

export default function InmuebleDetalle({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { properties, deleteProperty, updatePropertyStatus } = useData();
  const { isAdmin } = useAuth();

  const property = properties.find(p => p.id === id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const [statusChanged, setStatusChanged] = useState(false);

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

        {/* Botón atrás */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition"
        >
          <ArrowLeft size={20} />
        </button>

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
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-gray-500">
          <MapPin size={16} className="text-vinotinto shrink-0" />
          <p className="text-sm">{property.location}</p>
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
        <motion.div variants={itemVariants} className="bg-vinotinto/5 border border-vinotinto/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-vinotinto flex items-center justify-center shrink-0">
            <User size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Asesor Captador</p>
            <p className="font-bold text-gray-800">{property.captador}</p>
          </div>
        </motion.div>

        {/* Acciones Admin */}
        {isAdmin && (
          <motion.div variants={itemVariants} className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} /> Panel Admin
            </p>

            {/* CAMBIAR ESTADO */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Cambiar Estado del Inmueble</p>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
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

            {/* ELIMINAR */}
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 bg-red-50 text-red-500 font-bold hover:bg-red-100 active:scale-95 transition-all text-sm"
            >
              <Trash2 size={16} />
              Eliminar Inmueble
            </button>
          </motion.div>
        )}
      </motion.div>

      <ExportModal
        property={property}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
