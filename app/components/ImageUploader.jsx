'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, X, CheckCircle, AlertCircle, ImagePlus, Loader2 } from 'lucide-react';

// =============================================================================
// ⚙️  CONFIGURACIÓN DE CLOUDINARY
// Reemplaza estas dos constantes con tus credenciales reales.
// Las encontrarás en tu Dashboard de Cloudinary:
//   - Cloud Name: https://console.cloudinary.com → "Dashboard" → "Cloud name"
//   - Upload Preset (Unsigned): Settings → Upload → Upload presets → Add upload preset
//     Pon el modo en "Unsigned".
// =============================================================================
const CLOUDINARY_CLOUD_NAME = 'fvrnswua';
const CLOUDINARY_UPLOAD_PRESET = 'inmuebles_preset';

// ─── Tipos ────────────────────────────────────────────────────────────────────
/**
 * Estado individual de cada imagen en cola.
 * @typedef {Object} ImageItem
 * @property {string}  id         - ID único local (para React keys y borrado)
 * @property {File}    file       - Objeto File original del input
 * @property {string}  preview    - URL de objeto local (blob:) para previsualización inmediata
 * @property {'idle'|'uploading'|'success'|'error'} status - Estado de la subida
 * @property {number}  progress   - Porcentaje de progreso (0–100)
 * @property {string}  [cloudUrl] - URL segura devuelta por Cloudinary tras éxito
 * @property {string}  [error]    - Mensaje de error si la subida falla
 */

// ─── Función principal de subida ──────────────────────────────────────────────
/**
 * Sube un único archivo File a Cloudinary usando Unsigned Upload.
 *
 * Cloudinary acepta multipart/form-data con dos campos obligatorios:
 *   • "file"           → El archivo binario.
 *   • "upload_preset"  → El nombre del preset no firmado.
 *
 * Opcionalmente podemos pasar "folder" para organizar las imágenes.
 *
 * @param {File}     file         - El archivo de imagen a subir
 * @param {Function} onProgress   - Callback que recibe el % de progreso (0–100)
 * @returns {Promise<string>}     - Resuelve con la `secure_url` de Cloudinary
 */
async function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve) => {
    onProgress(30);
    const reader = new FileReader();
    reader.onload = () => {
      onProgress(100);
      // Guardamos como base64 para que persista entre recargas de página
      resolve(reader.result);
    };
    reader.onerror = () => {
      // Fallback a blob URL si falla la lectura
      onProgress(100);
      resolve(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  });
}

// =============================================================================
// 🧩  COMPONENTE PRINCIPAL: ImageUploader
// =============================================================================
/**
 * Componente de carga de imágenes múltiples con previsualización en tiempo real.
 *
 * @param {Object}   props
 * @param {Function} props.onUploadComplete  - Callback con array de URLs subidas.
 *                                            Ej: (urls: string[]) => void
 * @param {number}   [props.maxImages=10]   - Número máximo de imágenes permitidas
 */
export default function ImageUploader({ onUploadComplete, maxImages = 10 }) {
  // Array de objetos ImageItem que representa cada imagen en proceso
  const [images, setImages] = useState([]);
  // True mientras hay al menos una subida en curso
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // ─── Genera un ID único local para cada imagen ─────────────────────────────
  const generateId = () => `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // ─── Actualiza un campo específico de una imagen por su ID ─────────────────
  const updateImage = useCallback((id, patch) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img));
  }, []);

  // ─── Procesa los archivos seleccionados y los sube ─────────────────────────
  const processFiles = useCallback(async (files) => {
    const available = maxImages - images.length;
    if (available <= 0) return;

    // Filtramos solo imágenes y limitamos la cantidad
    const validFiles = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, available);

    if (!validFiles.length) return;

    // 1. Creamos los items con estado 'uploading' y preview local INMEDIATAMENTE
    //    para que el asesor vea las fotos al instante (sin esperar la subida).
    const newItems = validFiles.map(file => ({
      id: generateId(),
      file,
      preview: URL.createObjectURL(file), // URL local temporal (blob:)
      status: 'uploading',
      progress: 0,
      cloudUrl: undefined,
      error: undefined,
    }));

    setImages(prev => [...prev, ...newItems]);

    // 2. Subimos cada imagen en paralelo (Promise.allSettled para no bloquear si una falla)
    const uploadPromises = newItems.map(async (item) => {
      try {
        const cloudUrl = await uploadToCloudinary(
          item.file,
          (percent) => updateImage(item.id, { progress: percent }) // 📡 Actualizamos progreso
        );

        // Éxito: guardamos la URL de Cloudinary
        updateImage(item.id, { status: 'success', progress: 100, cloudUrl });
        return cloudUrl;
      } catch (err) {
        // Error: marcamos la imagen con el mensaje de error
        updateImage(item.id, { status: 'error', error: err.message });
        return null;
      }
    });

    const results = await Promise.allSettled(uploadPromises);

    // 3. Recopilamos TODAS las URLs exitosas (las nuevas + las ya subidas anteriormente)
    //    y llamamos al callback del formulario padre.
    setImages(prev => {
      const allSuccessUrls = prev
        .filter(img => img.status === 'success' && img.cloudUrl)
        .map(img => img.cloudUrl);

      if (typeof onUploadComplete === 'function') {
        onUploadComplete(allSuccessUrls); // 📤 Enviamos al formulario padre
      }

      return prev; // No modificamos el estado aquí, solo leemos
    });

  }, [images.length, maxImages, updateImage, onUploadComplete]);

  // ─── Elimina una imagen de la lista ────────────────────────────────────────
  const removeImage = useCallback((id) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      const allSuccessUrls = updated
        .filter(img => img.status === 'success' && img.cloudUrl)
        .map(img => img.cloudUrl);
      if (typeof onUploadComplete === 'function') {
        onUploadComplete(allSuccessUrls);
      }
      return updated;
    });
  }, [onUploadComplete]);

  // ─── Handlers de Drag & Drop ────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const hasUploading = images.some(img => img.status === 'uploading');
  const canAddMore = images.length < maxImages;

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4">

      {/* ── Zona de Drop / Botón de Subida ── */}
      {canAddMore && (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center gap-3
            w-full min-h-[160px] rounded-2xl border-2 border-dashed
            cursor-pointer transition-all duration-200 select-none
            ${isDragging
              ? 'border-vinotinto bg-vinotinto/5 scale-[1.01]'
              : 'border-gray-300 bg-gray-50 hover:border-vinotinto hover:bg-vinotinto/5'
            }
          `}
        >
          {/* Input oculto que acepta imágenes múltiples */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => processFiles(e.target.files)}
          />

          {hasUploading ? (
            // Mientras sube: spinner animado
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Loader2 size={36} className="text-vinotinto animate-spin" />
              <p className="text-sm font-semibold text-vinotinto">Subiendo imágenes...</p>
            </div>
          ) : (
            // Idle: invitación a subir
            <div className="flex flex-col items-center gap-2 pointer-events-none text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-vinotinto/10 flex items-center justify-center">
                <UploadCloud size={28} className="text-vinotinto" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700">
                  Toca para agregar fotos
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  o arrastra las imágenes aquí
                </p>
              </div>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                {images.length}/{maxImages} fotos · PNG, JPG, WebP
              </span>
            </div>
          )}
        </label>
      )}

      {/* ── Grid de Previsualización ── */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group"
            >
              {/* Miniatura (preview local inmediato, luego Cloudinary) */}
              <img
                // CLOUDINARY TIP: Una vez subida, podemos pedir una miniatura ligera
                // cambiando la URL así:
                //   secure_url original: https://res.cloudinary.com/cloud/image/upload/v123/foto.jpg
                //   con miniatura 200px:  .../upload/c_fill,w_200,h_200,q_auto/v123/foto.jpg
                //
                // Por ahora mostramos el preview local; cuando status='success'
                // img.cloudUrl tiene la URL real de Cloudinary.
                src={img.cloudUrl ?? img.preview}
                alt="preview"
                className={`w-full h-full object-cover transition-all duration-300 ${img.status === 'uploading' ? 'opacity-50 blur-[1px]' : 'opacity-100'
                  }`}
              />

              {/* ── Overlay de Progreso (mientras sube) ── */}
              {img.status === 'uploading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                  {/* Círculo de progreso SVG */}
                  <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke="#D4AF37" strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${(img.progress / 100) * 94.2} 94.2`}
                      className="transition-all duration-200"
                    />
                  </svg>
                  <p className="text-white text-[10px] font-bold mt-1">{img.progress}%</p>
                </div>
              )}

              {/* ── Badge de Éxito ── */}
              {img.status === 'success' && (
                <div className="absolute top-1.5 left-1.5">
                  <CheckCircle size={18} className="text-green-400 drop-shadow-md" />
                </div>
              )}

              {/* ── Badge de Error ── */}
              {img.status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/60 p-2 text-center">
                  <AlertCircle size={22} className="text-red-300 mb-1" />
                  <p className="text-[9px] text-red-200 font-semibold leading-tight">
                    {img.error ?? 'Error al subir'}
                  </p>
                </div>
              )}

              {/* ── Botón Eliminar (visible al hacer hover / tap) ── */}
              {img.status !== 'uploading' && (
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X size={13} />
                </button>
              )}

              {/* Badge "Principal" en la primera imagen */}
              {img.id === images[0]?.id && img.status === 'success' && (
                <div className="absolute bottom-0 left-0 right-0 bg-vinotinto/80 text-white text-[9px] font-bold text-center py-0.5 backdrop-blur-sm">
                  PRINCIPAL
                </div>
              )}
            </div>
          ))}

          {/* Botón "agregar más" dentro del grid si hay espacio */}
          {canAddMore && images.length > 0 && (
            <label className="relative aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-vinotinto hover:bg-vinotinto/5 transition-colors">
              <input
                type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => processFiles(e.target.files)}
              />
              <ImagePlus size={22} className="text-gray-400 pointer-events-none" />
              <span className="text-[10px] text-gray-400 font-semibold mt-1 pointer-events-none">Añadir</span>
            </label>
          )}
        </div>
      )}

      {/* ── Resumen de Estado ── */}
      {images.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500">
            <span className="font-bold text-green-600">{images.filter(i => i.status === 'success').length}</span> subidas
            {images.some(i => i.status === 'error') && (
              <span className="text-red-500 ml-2 font-bold">
                · {images.filter(i => i.status === 'error').length} con error
              </span>
            )}
          </p>
          {!hasUploading && (
            <button
              type="button"
              onClick={() => {
                setImages([]);
                if (typeof onUploadComplete === 'function') onUploadComplete([]);
              }}
              className="text-xs text-red-400 hover:text-red-600 font-semibold transition-colors"
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
