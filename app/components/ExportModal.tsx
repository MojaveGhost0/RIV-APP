'use client';

import { useRef, useState, useCallback } from 'react';
import {
  X, FileText, Instagram, MessageCircle, Video,
  MapPin, Bed, Bath, Maximize, User, ArrowLeft,
  Download, ChevronRight, Star, Sparkles, Check,
  Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { Property } from '../context/DataContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type FormatType = 'pdf' | 'instagram' | 'whatsapp' | 'video';
type TemplateType = 'A' | 'B';
type Step = 'format' | 'template' | 'export';

interface ExportModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 0 });

// ─── FORMAT CONFIG ─────────────────────────────────────────────────────────────
const FORMAT_CONFIG = {
  pdf: {
    label: 'Ficha Técnica PDF',
    description: 'Documento profesional para enviar a clientes',
    icon: FileText,
    color: 'from-red-500 to-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    templateA: { name: 'Clásica', desc: 'Blanco · Profesional' },
    templateB: { name: 'Lujosa', desc: 'Oscura · Premium Gold' },
  },
  instagram: {
    label: 'Historia Instagram',
    description: 'Formato vertical 9:16 para stories y TikTok',
    icon: Instagram,
    color: 'from-pink-500 via-purple-500 to-yellow-400',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-600',
    templateA: { name: 'Oscura', desc: 'Foto fondo · Vinotinto' },
    templateB: { name: 'Minimalista', desc: 'Foto top · Panel blanco' },
  },
  whatsapp: {
    label: 'Imagen WhatsApp',
    description: 'Cuadrada 1:1 con texto pre-listo para enviar',
    icon: MessageCircle,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-600',
    templateA: { name: 'Full Foto', desc: 'Foto fondo · Overlay oscuro' },
    templateB: { name: 'Panel Premium', desc: 'Foto + Tarjetas de datos' },
  },
  video: {
    label: 'Video Slideshow',
    description: 'Video con transiciones entre todas las fotos',
    icon: Video,
    color: 'from-violet-500 to-indigo-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-600',
    templateA: { name: '', desc: '' },
    templateB: { name: '', desc: '' },
  },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ExportModal({ property, isOpen, onClose }: ExportModalProps) {
  const [step, setStep] = useState<Step>('format');
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('A');
  const [isExporting, setIsExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [done, setDone] = useState(false);

  // Refs for all 6 templates (PDF-A, PDF-B, IG-A, IG-B, WA-A, WA-B)
  const pdfARef = useRef<HTMLDivElement>(null);
  const pdfBRef = useRef<HTMLDivElement>(null);
  const igARef  = useRef<HTMLDivElement>(null);
  const igBRef  = useRef<HTMLDivElement>(null);
  const waARef  = useRef<HTMLDivElement>(null);
  const waBRef  = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const allImages = [property.image, ...(property.images ?? [])].filter(
    (img, i, arr) => img && arr.indexOf(img) === i
  ) as string[];

  const getRef = () => {
    if (selectedFormat === 'pdf')       return selectedTemplate === 'A' ? pdfARef : pdfBRef;
    if (selectedFormat === 'instagram') return selectedTemplate === 'A' ? igARef  : igBRef;
    if (selectedFormat === 'whatsapp')  return selectedTemplate === 'A' ? waARef  : waBRef;
    return null;
  };

  const handleClose = () => {
    setStep('format');
    setSelectedFormat(null);
    setSelectedTemplate('A');
    setDone(false);
    onClose();
  };

  const handleSelectFormat = (format: FormatType) => {
    setSelectedFormat(format);
    setSelectedTemplate('A');
    setDone(false);
    if (format === 'video') {
      setStep('export');
    } else {
      setStep('template');
    }
  };

  const handleExport = async () => {
    if (selectedFormat === 'video') {
      await generateVideo();
      return;
    }
    const ref = getRef();
    if (!ref?.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      if (selectedFormat === 'pdf') {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(`${property.title.replace(/\s/g, '_')}_Ficha.pdf`);
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.href = imgData;
        const suffix = selectedFormat === 'instagram' ? 'Historia_IG' : 'WhatsApp';
        link.download = `${property.title.replace(/\s/g, '_')}_${suffix}_Plantilla${selectedTemplate}.jpg`;
        link.click();

        if (selectedFormat === 'whatsapp') {
          const text = buildWAText();
          setTimeout(() => { window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`; }, 600);
        }
      }
      setDone(true);
    } catch (e) {
      console.error(e);
      alert('Error al exportar. Intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  const buildWAText = () => {
    const amenities = property.amenities?.length ? `\n✨ ${property.amenities.join(', ')}` : '';
    return `🏠 *${property.title}*\n📍 ${property.location}\n💰 *$${fmt(property.price)} USD*\n🛏 ${property.beds} hab · 🚿 ${property.baths} baños · 📐 ${property.sqm}m²${amenities}\n\nAsesor: *${property.captador}*`;
  };

  const generateVideo = async () => {
    setIsExporting(true);
    setVideoProgress(0);
    try {
      const SIZE = 1080;
      const FPS = 30;
      const SLIDE_FRAMES = FPS * 3;     // 3s por imagen
      const FADE_FRAMES  = Math.floor(FPS * 0.6); // 0.6s fade

      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;

      // Cargar imágenes
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });

      const imgs = await Promise.all(allImages.map(loadImg));
      const totalFrames = imgs.length * SLIDE_FRAMES;

      // Configurar MediaRecorder
      const stream = canvas.captureStream(FPS);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8_000_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${property.title.replace(/\s/g, '_')}_Slideshow.webm`;
          link.click();
          URL.revokeObjectURL(url);
          resolve();
        };

        recorder.start();
        let frame = 0;

        const drawFrame = () => {
          if (frame >= totalFrames) {
            recorder.stop();
            return;
          }

          const slideIdx = Math.floor(frame / SLIDE_FRAMES);
          const frameInSlide = frame % SLIDE_FRAMES;
          const currentImg = imgs[slideIdx];
          const nextImg = imgs[(slideIdx + 1) % imgs.length];

          // Calcular opacidad del fade
          let alpha = 1;
          if (frameInSlide >= SLIDE_FRAMES - FADE_FRAMES) {
            alpha = 1 - (frameInSlide - (SLIDE_FRAMES - FADE_FRAMES)) / FADE_FRAMES;
          }

          // Dibujar imagen actual (cover fill)
          const drawCover = (img: HTMLImageElement, a: number) => {
            ctx.globalAlpha = a;
            const scale = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            const x = (SIZE - w) / 2;
            const y = (SIZE - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            ctx.globalAlpha = 1;
          };

          // Fondo negro
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, SIZE, SIZE);
          drawCover(currentImg, 1);

          // Fade to next
          if (alpha < 1 && frameInSlide >= SLIDE_FRAMES - FADE_FRAMES) {
            drawCover(nextImg, 1 - alpha);
          }

          // Overlay gradiente
          const grad = ctx.createLinearGradient(0, SIZE * 0.5, 0, SIZE);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.82)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, SIZE, SIZE);

          // Badge vinotinto
          ctx.fillStyle = '#800020';
          const bW = 220, bH = 52, bX = 48, bY = SIZE - 240;
          roundRect(ctx, bX, bY, bW, bH, 26);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 26px system-ui';
          ctx.textBaseline = 'middle';
          ctx.fillText('RIV Inmobiliaria', bX + 20, bY + bH / 2);

          // Precio
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 72px system-ui';
          ctx.fillText(`$${fmt(property.price)}`, 48, SIZE - 160);

          // Título
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '38px system-ui';
          const title = property.title.length > 38 ? property.title.slice(0, 36) + '…' : property.title;
          ctx.fillText(title, 48, SIZE - 90);

          // Ubicación
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '28px system-ui';
          ctx.fillText(`📍 ${property.location}`, 48, SIZE - 48);

          setVideoProgress(Math.round((frame / totalFrames) * 100));
          frame++;
          requestAnimationFrame(drawFrame);
        };

        drawFrame();
      });

      setDone(true);
    } catch (e) {
      console.error(e);
      alert('Error al generar el video. Tu navegador debe soportar MediaRecorder (Chrome/Edge).');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* MODAL OVERLAY */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
              style={{ maxHeight: '92dvh', overflowY: 'auto' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {step !== 'format' && (
                    <button
                      onClick={() => { setStep(step === 'export' && selectedFormat !== 'video' ? 'template' : 'format'); setDone(false); }}
                      className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 mr-1 transition"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900">Exportar Inmueble</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {step === 'format' && 'Elige el canal de exportación'}
                      {step === 'template' && 'Elige tu plantilla'}
                      {step === 'export' && 'Listo para descargar'}
                    </p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5">
                <AnimatePresence mode="wait">

                  {/* ─── STEP 1: FORMATO ──────────────────────────── */}
                  {step === 'format' && (
                    <motion.div key="format" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                      {(Object.entries(FORMAT_CONFIG) as [FormatType, typeof FORMAT_CONFIG.pdf][]).map(([key, conf]) => {
                        const Icon = conf.icon;
                        return (
                          <motion.button
                            key={key}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelectFormat(key)}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all group text-left"
                          >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${conf.color} flex items-center justify-center shrink-0 shadow-sm`}>
                              <Icon size={22} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 text-sm">{conf.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{conf.description}</p>
                              {key !== 'video' && (
                                <div className="flex gap-1.5 mt-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.bg} ${conf.text} border ${conf.border}`}>Plantilla A</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.bg} ${conf.text} border ${conf.border}`}>Plantilla B</span>
                                </div>
                              )}
                              {key === 'video' && allImages.length < 2 && (
                                <p className="text-[10px] text-amber-500 mt-1 font-semibold">⚠️ Más impacto con varias fotos</p>
                              )}
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 transition shrink-0" />
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* ─── STEP 2: PLANTILLA ─────────────────────────── */}
                  {step === 'template' && selectedFormat && selectedFormat !== 'video' && (
                    <motion.div key="template" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      <p className="text-sm font-semibold text-gray-600 mb-1">Selecciona una plantilla</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['A', 'B'] as TemplateType[]).map((t) => {
                          const conf = FORMAT_CONFIG[selectedFormat];
                          const tData = t === 'A' ? conf.templateA : conf.templateB;
                          return (
                            <motion.button
                              key={t}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setSelectedTemplate(t)}
                              className={`relative p-4 rounded-2xl border-2 transition-all text-left ${
                                selectedTemplate === t
                                  ? `border-vinotinto bg-vinotinto/5 shadow-md`
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              {selectedTemplate === t && (
                                <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-vinotinto rounded-full flex items-center justify-center">
                                  <Check size={11} className="text-white" strokeWidth={3} />
                                </div>
                              )}
                              {/* Mini preview visual */}
                              <TemplateThumbnail format={selectedFormat} template={t} property={property} />
                              <p className="text-sm font-bold text-gray-800 mt-3">{tData.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{tData.desc}</p>
                            </motion.button>
                          );
                        })}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setStep('export')}
                        className="w-full py-4 bg-gradient-to-r from-vinotinto to-[#a60029] text-white rounded-2xl font-bold shadow-lg shadow-vinotinto/25 flex items-center justify-center gap-2 mt-2"
                      >
                        <Sparkles size={16} />
                        Usar Plantilla {selectedTemplate}
                      </motion.button>
                    </motion.div>
                  )}

                  {/* ─── STEP 3: EXPORT ─────────────────────────────── */}
                  {step === 'export' && selectedFormat && (
                    <motion.div key="export" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                      {/* Info card */}
                      <div className={`rounded-2xl p-4 border ${FORMAT_CONFIG[selectedFormat].border} ${FORMAT_CONFIG[selectedFormat].bg}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${FORMAT_CONFIG[selectedFormat].color} flex items-center justify-center shrink-0`}>
                            {(() => { const I = FORMAT_CONFIG[selectedFormat].icon; return <I size={20} className="text-white" />; })()}
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${FORMAT_CONFIG[selectedFormat].text}`}>{FORMAT_CONFIG[selectedFormat].label}</p>
                            {selectedFormat !== 'video' && <p className="text-xs text-gray-500">Plantilla {selectedTemplate} · {selectedTemplate === 'A' ? FORMAT_CONFIG[selectedFormat].templateA.name : FORMAT_CONFIG[selectedFormat].templateB.name}</p>}
                            {selectedFormat === 'video' && <p className="text-xs text-gray-500">{allImages.length} foto(s) · ~{allImages.length * 3}s de duración</p>}
                          </div>
                        </div>
                      </div>

                      {/* Property summary */}
                      <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
                        <img src={property.image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{property.title}</p>
                          <p className="text-xs text-gray-400 truncate">{property.location}</p>
                          <p className="text-sm font-extrabold text-vinotinto mt-0.5">${fmt(property.price)} USD</p>
                        </div>
                      </div>

                      {/* Video progress */}
                      {selectedFormat === 'video' && isExporting && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-semibold text-gray-600">
                            <span>Generando video…</span>
                            <span>{videoProgress}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                              initial={{ width: '0%' }}
                              animate={{ width: `${videoProgress}%` }}
                              transition={{ ease: 'linear' }}
                            />
                          </div>
                          <p className="text-[11px] text-gray-400 text-center">Por favor, no cierres esta pantalla</p>
                        </div>
                      )}

                      {/* Success */}
                      {done && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3"
                        >
                          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                            <Check size={20} className="text-green-600" strokeWidth={3} />
                          </div>
                          <div>
                            <p className="font-bold text-green-700 text-sm">¡Descargado con éxito!</p>
                            <p className="text-xs text-green-600 mt-0.5">El archivo fue guardado en tu dispositivo</p>
                          </div>
                        </motion.div>
                      )}

                      {/* Download button */}
                      <motion.button
                        whileHover={{ scale: done ? 1 : 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                          done
                            ? 'bg-green-500 text-white shadow-green-500/25'
                            : 'bg-gradient-to-r from-vinotinto to-[#a60029] text-white shadow-vinotinto/25 disabled:opacity-60'
                        }`}
                      >
                        {isExporting
                          ? <><Loader2 size={18} className="animate-spin" /> Generando…</>
                          : done
                          ? <><Check size={18} /> Descargar de nuevo</>
                          : <><Download size={18} /> Descargar</>
                        }
                      </motion.button>

                      {selectedFormat === 'video' && (
                        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                          El video se genera en formato <strong>.webm</strong> compatible con Chrome y Edge.
                          Puedes convertirlo a MP4 con cualquier conversor online gratuito.
                        </p>
                      )}
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        ─── HIDDEN TEMPLATES ─────────────────────────────────────────────────
        FIX: Deben estar fuera del viewport pero tener dimensiones reales
        para que html2canvas las renderice correctamente.
        NUNCA usar display:none, h-0, w-0 ni overflow:hidden.
      */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', top: '-99999px', left: '-99999px', visibility: 'hidden', pointerEvents: 'none', zIndex: -1 }}
      >
        {/* ── PDF – Plantilla A: Clásica ──────────────────────────────────── */}
        <div ref={pdfARef} style={{ width: '794px', minHeight: '1123px', background: '#fff', padding: '60px', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '4px solid #800020', paddingBottom: '24px', marginBottom: '40px' }}>
            <div>
              <div style={{ background: '#800020', color: '#fff', display: 'inline-block', padding: '6px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 800, letterSpacing: '2px', marginBottom: '12px' }}>FICHA TÉCNICA</div>
              <h1 style={{ fontSize: '40px', fontWeight: 900, color: '#111', margin: 0, lineHeight: 1.15 }}>{property.title}</h1>
              <p style={{ color: '#6B7280', marginTop: '8px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>📍 {property.location}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '38px', fontWeight: 900, color: '#800020', margin: 0 }}>${fmt(property.price)}</p>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: '4px 0 0' }}>USD</p>
            </div>
          </div>
          {/* Foto */}
          <img src={property.image} crossOrigin="anonymous" style={{ width: '100%', height: '380px', objectFit: 'cover', borderRadius: '20px', marginBottom: '36px' }} alt="" />
          {/* Specs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '36px' }}>
            {[
              { label: 'Habitaciones', value: property.beds, emoji: '🛏' },
              { label: 'Baños', value: property.baths, emoji: '🚿' },
              { label: 'Área Total', value: `${property.sqm} m²`, emoji: '📐' },
            ].map(s => (
              <div key={s.label} style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '28px', margin: '0 0 6px' }}>{s.emoji}</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#111', margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0' }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* Descripción */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111', marginBottom: '12px' }}>Descripción</h2>
            <p style={{ color: '#6B7280', fontSize: '16px', lineHeight: 1.7 }}>{property.description}</p>
            {property.amenities && property.amenities.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111', marginBottom: '12px' }}>Comodidades</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {property.amenities.map(a => (
                    <span key={a} style={{ background: '#FFF1F4', color: '#800020', border: '1px solid #FECDD3', borderRadius: '999px', padding: '6px 16px', fontSize: '14px', fontWeight: 600 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Footer */}
          <div style={{ marginTop: '36px', borderTop: '1px solid #E5E7EB', paddingTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', background: '#F9FAFB', borderRadius: '16px', padding: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#800020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 800, flexShrink: 0 }}>
              {property.captador.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Asesor Captador</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#111', margin: '2px 0 0' }}>{property.captador}</p>
            </div>
          </div>
        </div>

        {/* ── PDF – Plantilla B: Lujosa ───────────────────────────────────── */}
        <div ref={pdfBRef} style={{ width: '794px', minHeight: '1123px', background: '#0F0F0F', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          {/* Hero */}
          <div style={{ position: 'relative', height: '480px', overflow: 'hidden' }}>
            <img src={property.image} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} alt="" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.85))' }} />
            <div style={{ position: 'absolute', bottom: 40, left: 60, right: 60 }}>
              <div style={{ background: '#D4AF37', color: '#000', display: 'inline-block', padding: '6px 20px', borderRadius: '999px', fontSize: '12px', fontWeight: 900, letterSpacing: '3px', marginBottom: '16px' }}>PREMIUM LISTING</div>
              <h1 style={{ fontSize: '44px', fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1 }}>{property.title}</h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '10px', fontSize: '16px' }}>📍 {property.location}</p>
            </div>
          </div>
          {/* Body */}
          <div style={{ padding: '50px 60px', flex: 1 }}>
            {/* Precio */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '30px' }}>
              <div>
                <p style={{ color: '#D4AF37', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', margin: 0 }}>PRECIO DE VENTA</p>
                <p style={{ color: '#fff', fontSize: '48px', fontWeight: 900, margin: '6px 0 0' }}>${fmt(property.price)} <span style={{ fontSize: '18px', fontWeight: 400, color: '#9CA3AF' }}>USD</span></p>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                {[
                  { v: property.beds, l: 'Hab' },
                  { v: property.baths, l: 'Baños' },
                  { v: `${property.sqm}m²`, l: 'Área' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <p style={{ color: '#D4AF37', fontSize: '30px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                    <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Descripción */}
            <h2 style={{ color: '#D4AF37', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', margin: '0 0 12px' }}>DESCRIPCIÓN</h2>
            <p style={{ color: '#D1D5DB', fontSize: '16px', lineHeight: 1.8, margin: 0 }}>{property.description}</p>
            {property.amenities && property.amenities.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h2 style={{ color: '#D4AF37', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', margin: '0 0 16px' }}>COMODIDADES</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {property.amenities.map(a => (
                    <span key={a} style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '999px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Footer dorado */}
          <div style={{ background: '#D4AF37', padding: '28px 60px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '20px', fontWeight: 900, flexShrink: 0 }}>
              {property.captador.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.5)', margin: 0, letterSpacing: '1px' }}>ASESOR</p>
              <p style={{ fontSize: '20px', fontWeight: 900, color: '#000', margin: '2px 0 0' }}>{property.captador}</p>
            </div>
          </div>
        </div>

        {/* ── Instagram – Plantilla A: Oscura Vinotinto ───────────────────── */}
        <div ref={igARef} style={{ position: 'relative', width: '1080px', height: '1920px', background: '#111', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
          <img src={property.image} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} alt="" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.1) 100%)' }} />
          {/* Top brand */}
          <div style={{ position: 'absolute', top: 80, left: 80, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: '#800020', padding: '14px 32px', borderRadius: '999px' }}>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: '28px', margin: 0, letterSpacing: '2px' }}>RIV</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', padding: '14px 24px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '22px', margin: 0 }}>Nuevo Ingreso ✨</p>
            </div>
          </div>
          {/* Content bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '80px' }}>
            <div style={{ background: '#800020', display: 'inline-block', padding: '10px 28px', borderRadius: '999px', marginBottom: '28px' }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: '24px', margin: 0 }}>{property.propertyType ?? 'Inmueble'}</p>
            </div>
            <h1 style={{ fontSize: '80px', fontWeight: 900, color: '#fff', margin: '0 0 16px', lineHeight: 1.05 }}>{property.title}</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '36px', margin: '0 0 48px', display: 'flex', alignItems: 'center', gap: '12px' }}>📍 {property.location}</p>
            <p style={{ fontSize: '110px', fontWeight: 900, color: '#fff', margin: '0 0 48px', lineHeight: 1 }}>${fmt(property.price)}</p>
            {/* Specs */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '56px' }}>
              {[
                { v: property.beds, l: 'Habitaciones' },
                { v: property.baths, l: 'Baños' },
                { v: `${property.sqm}m²`, l: 'Área' },
              ].map(s => (
                <div key={s.l} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: '28px', padding: '28px 20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <p style={{ color: '#fff', fontSize: '52px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '24px', margin: '8px 0 0' }}>{s.l}</p>
                </div>
              ))}
            </div>
            {/* Asesor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: '#fff', borderRadius: '32px', padding: '28px 36px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#800020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '32px', fontWeight: 900, flexShrink: 0 }}>
                {property.captador.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '24px', margin: 0 }}>Contáctame:</p>
                <p style={{ color: '#111', fontSize: '36px', fontWeight: 900, margin: '4px 0 0' }}>{property.captador}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Instagram – Plantilla B: Minimalista ─────────────────────────── */}
        <div ref={igBRef} style={{ position: 'relative', width: '1080px', height: '1920px', background: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Foto top 60% */}
          <div style={{ position: 'relative', height: '1150px', overflow: 'hidden', flexShrink: 0 }}>
            <img src={property.image} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(255,255,255,0))' }} />
            {/* Brand top */}
            <div style={{ position: 'absolute', top: 70, left: 70, background: 'rgba(255,255,255,0.95)', borderRadius: '999px', padding: '14px 32px', backdropFilter: 'blur(10px)' }}>
              <p style={{ color: '#800020', fontWeight: 900, fontSize: '28px', margin: 0, letterSpacing: '2px' }}>RIV Inmobiliaria</p>
            </div>
            {/* Price chip */}
            <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, transparent, #fff)' }} />
          </div>
          {/* Panel blanco */}
          <div style={{ flex: 1, padding: '48px 80px 80px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#800020', fontSize: '22px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '1px' }}>{property.propertyType ?? 'Inmueble'} en Venta</p>
                <h1 style={{ fontSize: '64px', fontWeight: 900, color: '#111', margin: 0, lineHeight: 1.1 }}>{property.title}</h1>
                <p style={{ color: '#9CA3AF', fontSize: '28px', margin: '12px 0 0' }}>📍 {property.location}</p>
              </div>
            </div>
            <p style={{ fontSize: '88px', fontWeight: 900, color: '#800020', margin: '0 0 40px', lineHeight: 1 }}>${fmt(property.price)} <span style={{ fontSize: '32px', color: '#9CA3AF', fontWeight: 400 }}>USD</span></p>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
              {[
                { v: property.beds, l: 'Hab', emoji: '🛏' },
                { v: property.baths, l: 'Baños', emoji: '🚿' },
                { v: `${property.sqm}`, l: 'm²', emoji: '📐' },
              ].map(s => (
                <div key={s.l} style={{ flex: 1, background: '#F9FAFB', borderRadius: '24px', padding: '24px 16px', textAlign: 'center', border: '1px solid #F3F4F6' }}>
                  <p style={{ fontSize: '40px', margin: '0 0 4px' }}>{s.emoji}</p>
                  <p style={{ color: '#111', fontSize: '44px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '22px', margin: '4px 0 0' }}>{s.l}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: 'auto', borderTop: '1px solid #F3F4F6', paddingTop: '36px' }}>
              <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: '#800020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '28px', fontWeight: 900, flexShrink: 0 }}>
                {property.captador.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '20px', margin: 0 }}>Asesor</p>
                <p style={{ color: '#111', fontSize: '30px', fontWeight: 900, margin: '2px 0 0' }}>{property.captador}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── WhatsApp – Plantilla A: Full Foto ─────────────────────────────── */}
        <div ref={waARef} style={{ position: 'relative', width: '1080px', height: '1080px', background: '#000', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
          <img src={property.image} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} alt="" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(128,0,32,0.6) 0%, rgba(0,0,0,0.8) 100%)' }} />
          {/* Top */}
          <div style={{ position: 'absolute', top: 56, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px', padding: '10px 24px' }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: '22px', margin: 0 }}>RIV Inmobiliaria</p>
            </div>
            <div style={{ background: '#800020', borderRadius: '16px', padding: '10px 24px' }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: '22px', margin: 0 }}>En Venta</p>
            </div>
          </div>
          {/* Bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '56px' }}>
            <h1 style={{ fontSize: '68px', fontWeight: 900, color: '#fff', margin: '0 0 12px', lineHeight: 1.1 }}>{property.title}</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '28px', margin: '0 0 28px' }}>📍 {property.location}</p>
            <p style={{ fontSize: '84px', fontWeight: 900, color: '#fff', margin: '0 0 36px', lineHeight: 1 }}>${fmt(property.price)} <span style={{ fontSize: '28px', fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>USD</span></p>
            <div style={{ display: 'flex', gap: '18px' }}>
              {[
                { v: property.beds, l: 'Hab' },
                { v: property.baths, l: 'Baños' },
                { v: `${property.sqm}m²`, l: 'Área' },
                { v: property.captador.split(' ')[0], l: 'Asesor' },
              ].map(s => (
                <div key={s.l} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', borderRadius: '20px', padding: '20px 14px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <p style={{ color: '#fff', fontSize: '32px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '18px', margin: '6px 0 0' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── WhatsApp – Plantilla B: Panel Premium ─────────────────────────── */}
        <div ref={waBRef} style={{ width: '1080px', height: '1080px', background: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Foto top 52% */}
          <div style={{ position: 'relative', height: '560px', overflow: 'hidden', flexShrink: 0 }}>
            <img src={property.image} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            {/* Badge */}
            <div style={{ position: 'absolute', top: 32, left: 32, background: '#800020', borderRadius: '999px', padding: '10px 28px' }}>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: '22px', margin: 0 }}>RIV Inmobiliaria</p>
            </div>
            <div style={{ position: 'absolute', top: 32, right: 32, background: 'rgba(255,255,255,0.9)', borderRadius: '999px', padding: '10px 28px' }}>
              <p style={{ color: '#800020', fontWeight: 900, fontSize: '22px', margin: 0 }}>En Venta</p>
            </div>
          </div>
          {/* Panel */}
          <div style={{ flex: 1, padding: '36px 56px 40px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ flex: 1, paddingRight: '20px' }}>
                <h1 style={{ fontSize: '46px', fontWeight: 900, color: '#111', margin: 0, lineHeight: 1.1 }}>{property.title}</h1>
                <p style={{ color: '#9CA3AF', fontSize: '22px', margin: '8px 0 0' }}>📍 {property.location}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '48px', fontWeight: 900, color: '#800020', margin: 0, lineHeight: 1 }}>${fmt(property.price)}</p>
                <p style={{ color: '#9CA3AF', fontSize: '18px', margin: '4px 0 0' }}>USD</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', flex: 1 }}>
              {[
                { v: property.beds, l: 'Habitaciones', emoji: '🛏' },
                { v: property.baths, l: 'Baños', emoji: '🚿' },
                { v: `${property.sqm}m²`, l: 'Área', emoji: '📐' },
              ].map(s => (
                <div key={s.l} style={{ background: '#F9FAFB', border: '2px solid #F3F4F6', borderRadius: '20px', padding: '20px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: '32px', margin: '0 0 4px' }}>{s.emoji}</p>
                  <p style={{ color: '#111', fontSize: '38px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '16px', margin: '4px 0 0' }}>{s.l}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '2px solid #F3F4F6', paddingTop: '24px', marginTop: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#800020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 900, flexShrink: 0 }}>
                {property.captador.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '16px', margin: 0 }}>Asesor</p>
                <p style={{ color: '#111', fontSize: '24px', fontWeight: 800, margin: '2px 0 0' }}>{property.captador}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Template Thumbnail Component ─────────────────────────────────────────────
function TemplateThumbnail({ format, template, property }: { format: FormatType; template: TemplateType; property: Property }) {
  const isB = template === 'B';

  if (format === 'pdf') {
    return isB ? (
      <div style={{ width: '100%', aspectRatio: '0.77', background: '#0F0F0F', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '55%', objectFit: 'cover', opacity: 0.7 }} alt="" />
        <div style={{ padding: '8px', background: '#0F0F0F' }}>
          <div style={{ width: '60%', height: '6px', background: '#D4AF37', borderRadius: '3px', marginBottom: '5px' }} />
          <div style={{ width: '90%', height: '4px', background: '#333', borderRadius: '3px', marginBottom: '3px' }} />
          <div style={{ width: '75%', height: '4px', background: '#333', borderRadius: '3px', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: '16px', background: '#1A1A1A', borderRadius: '4px', border: '1px solid #D4AF37' }} />)}
          </div>
        </div>
      </div>
    ) : (
      <div style={{ width: '100%', aspectRatio: '0.77', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #F3F4F6', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '48%', objectFit: 'cover' }} alt="" />
        <div style={{ padding: '8px' }}>
          <div style={{ width: '50%', height: '5px', background: '#800020', borderRadius: '3px', marginBottom: '4px' }} />
          <div style={{ width: '85%', height: '4px', background: '#EEE', borderRadius: '3px', marginBottom: '3px' }} />
          <div style={{ width: '65%', height: '4px', background: '#EEE', borderRadius: '3px', marginBottom: '7px' }} />
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: '16px', background: '#F9FAFB', borderRadius: '4px', border: '1px solid #EEE' }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (format === 'instagram') {
    return isB ? (
      <div style={{ width: '100%', aspectRatio: '0.56', background: '#fff', borderRadius: '10px', overflow: 'hidden', fontSize: 0, display: 'flex', flexDirection: 'column' }}>
        <img src={property.image} style={{ width: '100%', height: '60%', objectFit: 'cover' }} alt="" />
        <div style={{ flex: 1, padding: '6px', background: '#fff' }}>
          <div style={{ width: '55%', height: '5px', background: '#800020', borderRadius: '3px', marginBottom: '4px' }} />
          <div style={{ width: '80%', height: '9px', background: '#111', borderRadius: '3px', marginBottom: '4px', fontWeight: 900 }} />
          <div style={{ width: '60%', height: '4px', background: '#EEE', borderRadius: '3px', marginBottom: '5px' }} />
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: '14px', background: '#F9FAFB', borderRadius: '4px', border: '1px solid #EEE' }} />)}
          </div>
        </div>
      </div>
    ) : (
      <div style={{ width: '100%', aspectRatio: '0.56', background: '#111', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65, position: 'absolute', inset: 0 }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 40%, transparent 100%)' }} />
        <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px' }}>
          <div style={{ width: '40%', height: '8px', background: '#800020', borderRadius: '4px', marginBottom: '4px' }} />
          <div style={{ width: '75%', height: '5px', background: '#fff', borderRadius: '3px', marginBottom: '3px' }} />
          <div style={{ width: '55%', height: '4px', background: 'rgba(255,255,255,0.5)', borderRadius: '3px' }} />
        </div>
      </div>
    );
  }

  if (format === 'whatsapp') {
    return isB ? (
      <div style={{ width: '100%', aspectRatio: '1', background: '#fff', borderRadius: '10px', overflow: 'hidden', fontSize: 0, display: 'flex', flexDirection: 'column', border: '1px solid #EEE' }}>
        <img src={property.image} style={{ width: '100%', height: '52%', objectFit: 'cover' }} alt="" />
        <div style={{ flex: 1, padding: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ width: '55%', height: '8px', background: '#111', borderRadius: '3px' }} />
            <div style={{ width: '25%', height: '8px', background: '#800020', borderRadius: '3px' }} />
          </div>
          <div style={{ width: '70%', height: '4px', background: '#EEE', borderRadius: '3px', marginBottom: '5px' }} />
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: '18px', background: '#F9FAFB', borderRadius: '4px', border: '1px solid #EEE' }} />)}
          </div>
        </div>
      </div>
    ) : (
      <div style={{ width: '100%', aspectRatio: '1', background: '#111', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65, position: 'absolute' }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(128,0,32,0.5) 0%, rgba(0,0,0,0.75) 100%)' }} />
        <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px' }}>
          <div style={{ width: '70%', height: '8px', background: '#fff', borderRadius: '4px', marginBottom: '4px' }} />
          <div style={{ width: '50%', height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '3px', marginBottom: '6px' }} />
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: '16px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px' }} />)}
          </div>
        </div>
      </div>
    );
  }

  return <div style={{ width: '100%', aspectRatio: '1', background: '#EEE', borderRadius: '10px' }} />;
}

// ─── Canvas Helper ─────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
