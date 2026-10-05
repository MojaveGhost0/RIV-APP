'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  X, FileText, Instagram, MessageCircle, Video,
  MapPin, Bed, Bath, Maximize, Ruler, Smartphone, User, ArrowLeft,
  Download, ChevronRight, Star, Sparkles, Check,
  Loader2, Copy, Share2, ExternalLink
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { Property } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BrandLogo from './BrandLogo';
import { DEFAULT_BRAND_LOGO } from '../lib/brandConfig';

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

async function urlToBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 1080;
        c.height = img.naturalHeight || 720;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/jpeg', 0.95));
          return;
        }
      } catch (err) {
        console.warn('Canvas toDataURL failed in urlToBase64:', err);
      }
      resolve(url);
    };
    img.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = fallback.naturalWidth || 1080;
          c.height = fallback.naturalHeight || 720;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(fallback, 0, 0);
            resolve(c.toDataURL('image/jpeg', 0.95));
            return;
          }
        } catch {
          // ignore
        }
        resolve(url);
      };
      fallback.onerror = () => resolve(url);
      fallback.src = url;
    };
    img.src = url;
  });
}

/** Convierte un HTMLCanvasElement en un objeto File y Blob de forma cross-browser */
async function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<{ file: File; blob: Blob }> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], filename, { type: 'image/png' });
        resolve({ file, blob });
      } else {
        // Respaldo para browsers antiguos
        const dataUrl = canvas.toDataURL('image/png');
        const byteString = atob(dataUrl.split(',')[1]);
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const fallbackBlob = new Blob([ab], { type: mimeString });
        const file = new File([fallbackBlob], filename, { type: 'image/png' });
        resolve({ file, blob: fallbackBlob });
      }
    }, 'image/png', 0.95);
  });
}

/** 
 * Dispara la descarga o apertura nativa en móviles (Web Share API) o link de descarga estándar
 * En iOS Safari / Android, Web Share permite "Guardar imagen en Fotos", enviar a WhatsApp, etc.
 */
async function triggerDownloadOrShare(file: File, blob: Blob, title: string): Promise<'shared' | 'downloaded'> {
  // 1. Probar Web Share API (Nativo en iPhone y Android modernos)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: file.name,
        text: title,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'shared';
      }
      console.warn('Web Share API falló o fue cancelado, probando descarga clásica:', err);
    }
  }

  // 2. Descarga estándar vía Blob ObjectURL añadido al DOM
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    try { document.body.removeChild(link); } catch {}
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }, 1000);

  return 'downloaded';
}

/** Filtro dinámico de atributos para evitar mostrar 0 Habs / Baños en Terrenos o Locales */
function getValidSpecs(p: Property) {
  const specs: Array<{ label: string; v: string | number; emoji: string; icon: any }> = [];
  if (p.beds > 0) {
    specs.push({ label: 'Habitaciones', v: p.beds, emoji: '🛏', icon: Bed });
  }
  if (p.baths > 0) {
    specs.push({ label: 'Baños', v: p.baths, emoji: '🚿', icon: Bath });
  }
  if (p.sqm > 0) {
    specs.push({ label: 'Área Total', v: `${p.sqm} m²`, emoji: '📐', icon: Ruler });
  }
  return specs;
}

// ─── FORMAT CONFIG ─────────────────────────────────────────────────────────────
const FORMAT_CONFIG = {
  pdf: {
    label: 'Ficha Comercial PDF',
    description: 'Documento oficial con membrete corporativo, fotos y QR',
    icon: FileText,
    color: 'from-red-500 to-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    templateA: { name: 'Clásica', desc: 'Blanco · Membrete Corporativo' },
    templateB: { name: 'Lujosa', desc: 'Oscura · Gold Edition' },
  },
  instagram: {
    label: 'Historia Instagram (9:16)',
    description: 'Minimalista · Foto full-bleed · Badge precio · Sin tarjetas',
    icon: Instagram,
    color: 'from-pink-500 via-purple-500 to-yellow-400',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-600',
    templateA: { name: 'Clean Dark', desc: 'Full bleed 9:16 · Badge vinotinto · Overlay minimalista' },
    templateB: { name: 'Clean Gold', desc: 'Full bleed 9:16 · Badge dorado · Overlay minimalista' },
  },
  whatsapp: {
    label: 'WhatsApp Marketing',
    description: 'Copy enriquecido + Imagen 1:1 minimalista y envío directo',
    icon: MessageCircle,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-600',
    templateA: { name: 'Clean Full Foto', desc: '1:1 · Badge precio · Texto directo sobre foto' },
    templateB: { name: 'Clean Split', desc: '1:1 · Foto + Panel blanco · Info limpia' },
  },
  video: {
    label: 'Video Slideshow (9:16)',
    description: 'Reels/TikTok con transiciones, Watermark y Outro',
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
  const { getAdvisorPhone } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('format');
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('A');
  const [isExporting, setIsExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoPhase, setVideoPhase] = useState<'loading' | 'rendering' | 'done'>('loading');
  const [done, setDone] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [base64Img, setBase64Img] = useState<string>('');
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);
  const [generatedFile, setGeneratedFile] = useState<File | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);

  const advisorPhone = property.captador ? getAdvisorPhone(property.captador) : '';

  // Preload property image to base64 DataURL to prevent CORS canvas tainting and black output
  useEffect(() => {
    let isMounted = true;
    if (property.image) {
      urlToBase64(property.image).then(b64 => {
        if (isMounted && b64) setBase64Img(b64);
      });
    }
    return () => { isMounted = false; };
  }, [property.image]);

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

  const validSpecs = getValidSpecs(property);

  const isLand = 
    property.propertyType === 'Terreno' ||
    (property.propertyType || '').toLowerCase().includes('terreno') ||
    (property.propertyType || '').toLowerCase().includes('parcela') ||
    property.title.toLowerCase().includes('terreno') ||
    property.title.toLowerCase().includes('parcela');

  const getRef = () => {
    if (selectedFormat === 'pdf')       return selectedTemplate === 'A' ? pdfARef : pdfBRef;
    if (selectedFormat === 'instagram') return selectedTemplate === 'A' ? igARef  : igBRef;
    if (selectedFormat === 'whatsapp')  return selectedTemplate === 'A' ? waARef  : waBRef;
    return null;
  };

  const handleClose = () => {
    if (generatedPreviewUrl) {
      URL.revokeObjectURL(generatedPreviewUrl);
    }
    setGeneratedPreviewUrl(null);
    setGeneratedFile(null);
    setGeneratedBlob(null);
    setStep('format');
    setSelectedFormat(null);
    setSelectedTemplate('A');
    setDone(false);
    setCopiedText(false);
    onClose();
  };

  const handleSelectFormat = (format: FormatType) => {
    if (generatedPreviewUrl) {
      URL.revokeObjectURL(generatedPreviewUrl);
    }
    setGeneratedPreviewUrl(null);
    setGeneratedFile(null);
    setGeneratedBlob(null);
    setSelectedFormat(format);
    setSelectedTemplate('A');
    setDone(false);
    setCopiedText(false);
    if (format === 'video') {
      setStep('export');
    } else {
      setStep('template');
    }
  };

  // Generador de copy optimizado para WhatsApp con emojis y viñetas
  const buildWAText = () => {
    const specsLines: string[] = [];
    if (property.beds > 0) specsLines.push(`🛏 *Habitaciones:* ${property.beds}`);
    if (property.baths > 0) specsLines.push(`🚿 *Baños:* ${property.baths}`);
    if (property.sqm > 0) specsLines.push(`📐 *Área Construida:* ${property.sqm} m²`);
    
    const amenitiesBlock = property.amenities?.length
      ? `\n🌟 *Comodidades y Atributos:*\n${property.amenities.map(a => `  • ${a}`).join('\n')}\n`
      : '';

    const phoneStr = advisorPhone ? `\n📲 *Teléfono / WhatsApp:* ${advisorPhone}` : '';

    return `✨ *OPORTUNIDAD INMOBILIARIA EXCLUSIVA* ✨\n\n🏢 *${property.title}*\n🏷 *Tipo:* ${property.propertyType || 'Inmueble'} en Venta\n📍 *Ubicación:* ${property.location}\n💰 *Precio de Venta:* *$${fmt(property.price)} USD*\n\n${specsLines.join('\n')}${amenitiesBlock}\n👤 *Asesor Inmobiliario:* *${property.captador || 'RIV Margarita Premier'}*${phoneStr}\n\n💬 _Para más información o agendar una visita privada, responde a este mensaje._\n✦ *RIV MARGARITA PREMIER* ✦`;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildWAText());
      setCopiedText(true);
      showToast('Texto copiado al portapapeles', 'success');
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      showToast('No se pudo copiar el texto al portapapeles', 'error');
    }
  };

  const handleShareWhatsApp = () => {
    const text = buildWAText();
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
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
      // Ensure image is preloaded into base64
      let activeImg = base64Img;
      if (!activeImg && property.image) {
        activeImg = await urlToBase64(property.image);
        if (activeImg) setBase64Img(activeImg);
        await new Promise(r => setTimeout(r, 150));
      }
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready;
      }

      // Determine background color so transparent canvas doesn't convert to solid black JPEG
      const isDark = (selectedFormat === 'pdf' && selectedTemplate === 'B') ||
                     (selectedFormat === 'instagram' && selectedTemplate === 'A') ||
                     (selectedFormat === 'whatsapp' && selectedTemplate === 'A');
      const bgColor = isDark ? '#0F0F0F' : '#FFFFFF';

      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: bgColor,
        logging: false,
      });

      if (selectedFormat === 'pdf') {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        // Clean standard A4 portrait (210mm x 297mm)
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        const filename = `${property.title.replace(/\s+/g, '_')}_Ficha_RIV.pdf`;
        pdf.save(filename);
      } else {
        const suffix = selectedFormat === 'instagram' ? 'Historia_IG' : 'WhatsApp';
        const filename = `${property.title.replace(/\s+/g, '_')}_${suffix}_Plantilla_${selectedTemplate}.png`;
        
        // Conversión a File y Blob nativo para evitar bloqueo de descarga en móviles
        const { file, blob } = await canvasToFile(canvas, filename);
        const previewUrl = URL.createObjectURL(blob);
        setGeneratedPreviewUrl(previewUrl);
        setGeneratedFile(file);
        setGeneratedBlob(blob);

        await triggerDownloadOrShare(file, blob, `Plantilla RIV - ${property.title}`);
      }
      setDone(true);
    } catch (e) {
      console.error('Error al exportar plantilla:', e);
      showToast('Error al exportar la plantilla. Por favor intenta de nuevo.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Generador de Video Slideshow (Vertical 9:16 para Reels / TikTok) ────────
  const generateVideo = async () => {
    setIsExporting(true);
    setVideoPhase('loading');
    setVideoProgress(0);
    try {
      const WIDTH = 1080;
      const HEIGHT = 1920; // Formato 9:16 nativo para Reels/Stories
      const FPS = 30;
      const SLIDE_FRAMES = FPS * 3;       // 3 segundos por imagen
      const FADE_FRAMES  = Math.floor(FPS * 0.6); // 0.6s de transición suave
      const OUTRO_FRAMES = FPS * 2.8;     // 2.8s para la tarjeta final de cierre

      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el lienzo 2D.');

      // Función de carga con respaldo y CORS
      const loadImg = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((res) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = () => {
            const fallback = new Image();
            fallback.onload = () => res(fallback);
            fallback.onerror = () => res(null);
            fallback.src = src;
          };
          img.src = src;
        });

      // Carga paralela de fotos y logo corporativo
      const [logoImg, ...loadedPhotos] = await Promise.all([
        loadImg('/logo-riv.svg'),
        ...allImages.map(loadImg),
      ]);

      const imgs = loadedPhotos.filter((img): img is HTMLImageElement => img !== null);
      if (imgs.length === 0) {
        showToast('No se pudieron cargar las fotos para generar el video.', 'error');
        return;
      }

      setVideoPhase('rendering');
      const photoFrames = imgs.length * SLIDE_FRAMES;
      const totalFrames = photoFrames + OUTRO_FRAMES;

      // Detección de códec de video compatible (mp4 en Safari, webm en Chrome/Edge)
      let mimeType = 'video/webm';
      if (typeof MediaRecorder !== 'undefined') {
        const testTypes = [
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        for (const t of testTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      }

      // Configurar grabación multimedia
      const stream = canvas.captureStream(FPS);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8_000_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      await new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          const isMp4 = mimeType.includes('mp4');
          const ext = isMp4 ? 'mp4' : 'webm';
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const filename = `${property.title.replace(/\s+/g, '_')}_Reel_RIV.${ext}`;
          const file = new File([blob], filename, { type: blob.type });

          const previewUrl = URL.createObjectURL(blob);
          setGeneratedPreviewUrl(previewUrl);
          setGeneratedFile(file);
          setGeneratedBlob(blob);

          await triggerDownloadOrShare(file, blob, `Reel Video 9:16 - ${property.title}`);
          resolve();
        };

        recorder.start();
        let frame = 0;

        const drawFrame = () => {
          if (frame >= totalFrames) {
            recorder.stop();
            return;
          }

          // ── A. FASE 1: DIAPOSITIVAS DE FOTOS ──────────────────────────────
          if (frame < photoFrames) {
            const slideIdx = Math.floor(frame / SLIDE_FRAMES);
            const frameInSlide = frame % SLIDE_FRAMES;
            const currentImg = imgs[slideIdx];
            const nextImg = imgs[(slideIdx + 1) % imgs.length];

            // Opacidad de fade
            let alpha = 1;
            if (frameInSlide >= SLIDE_FRAMES - FADE_FRAMES) {
              alpha = 1 - (frameInSlide - (SLIDE_FRAMES - FADE_FRAMES)) / FADE_FRAMES;
            }

            // Efecto Ken Burns (Zoom sutil de 1.0 a 1.045)
            const zoomRatio = 1.0 + (frameInSlide / SLIDE_FRAMES) * 0.045;

            const drawCover = (img: HTMLImageElement, a: number, scaleFactor = 1) => {
              ctx.globalAlpha = a;
              const baseScale = Math.max(WIDTH / img.naturalWidth, HEIGHT / img.naturalHeight);
              const scale = baseScale * scaleFactor;
              const w = img.naturalWidth * scale;
              const h = img.naturalHeight * scale;
              const x = (WIDTH - w) / 2;
              const y = (HEIGHT - h) / 2;
              ctx.drawImage(img, x, y, w, h);
              ctx.globalAlpha = 1;
            };

            // Fondo negro
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            drawCover(currentImg, 1, zoomRatio);

            if (alpha < 1 && frameInSlide >= SLIDE_FRAMES - FADE_FRAMES) {
              drawCover(nextImg, 1 - alpha, 1.0);
            }

            // 1. Top Vignette Gradient
            const topGrad = ctx.createLinearGradient(0, 0, 0, 320);
            topGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
            topGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, WIDTH, 320);

            // 2. Animated Gold Progress Bar
            const progressWidth = ((frame + 1) / totalFrames) * WIDTH;
            const lineGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
            lineGrad.addColorStop(0, '#800020');
            lineGrad.addColorStop(0.5, '#D4AF37');
            lineGrad.addColorStop(1, '#FFF2B2');
            ctx.fillStyle = lineGrad;
            ctx.fillRect(0, 0, progressWidth, 8);

            // 3. Top Header: Watermark Vector SVG & Counter
            // Watermark Logo
            if (logoImg) {
              drawRoundRect(ctx, 48, 48, 280, 68, 20, 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.2)', 1);
              ctx.drawImage(logoImg, 64, 56, 248, 52);
            } else {
              // Fallback badge si falla el logo
              drawRoundRect(ctx, 48, 48, 290, 60, 20, '#800020', '#D4AF37', 1.5);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 20px system-ui, sans-serif';
              ctx.textBaseline = 'middle';
              ctx.textAlign = 'center';
              ctx.fillText('✦ RIV MARGARITA PREMIER', 193, 78);
            }

            // Photo Counter
            drawRoundRect(ctx, WIDTH - 228, 48, 180, 56, 20, 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.2)', 1);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '600 20px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Foto ${slideIdx + 1} de ${imgs.length}`, WIDTH - 138, 76);

            // 4. Bottom Cinematic Deep Gradient
            const bottomGrad = ctx.createLinearGradient(0, HEIGHT * 0.45, 0, HEIGHT);
            bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
            bottomGrad.addColorStop(0.25, 'rgba(5,5,5,0.45)');
            bottomGrad.addColorStop(0.6, 'rgba(5,5,5,0.85)');
            bottomGrad.addColorStop(1, 'rgba(0,0,0,0.98)');
            ctx.fillStyle = bottomGrad;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            // 5. Property Tag
            const pType = (property.propertyType || 'INMUEBLE').toUpperCase();
            drawRoundRect(ctx, 56, HEIGHT - 460, 320, 48, 24, 'rgba(212, 175, 55, 0.25)', '#D4AF37', 1.5);
            ctx.fillStyle = '#D4AF37';
            ctx.font = 'bold 18px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`★  ${pType} EN VENTA`, 80, HEIGHT - 436);

            // 6. Price
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 84px system-ui, sans-serif';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`$${fmt(property.price)}`, 56, HEIGHT - 340);

            const pWidth = ctx.measureText(`$${fmt(property.price)}`).width;
            ctx.fillStyle = '#D4AF37';
            ctx.font = 'bold 34px system-ui, sans-serif';
            ctx.fillText('USD', 56 + pWidth + 18, HEIGHT - 340);

            // 7. Title & Location
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 38px system-ui, sans-serif';
            const displayTitle = property.title.length > 38 ? property.title.slice(0, 37) + '…' : property.title;
            ctx.fillText(displayTitle, 56, HEIGHT - 275);

            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = '500 26px system-ui, sans-serif';
            ctx.fillText(`📍 ${property.location}`, 56, HEIGHT - 225);

            // 8. Dynamic Spec Badges (Filtrados sin 0 habs/baños)
            const specsList: Array<{ icon: string; text: string }> = [];
            if (property.beds > 0) specsList.push({ icon: '🛏', text: `${property.beds} Hab` });
            if (property.baths > 0) specsList.push({ icon: '🚿', text: `${property.baths} Baños` });
            if (property.sqm > 0) specsList.push({ icon: '📐', text: `${property.sqm} m²` });
            specsList.push({ icon: '👤', text: property.captador ? property.captador.split(' ')[0] : 'Asesor' });

            const badgeW = (WIDTH - 112 - (specsList.length - 1) * 16) / specsList.length;
            const badgeH = 74;
            const badgeY = HEIGHT - 145;

            specsList.forEach((s, idx) => {
              const bX = 56 + idx * (badgeW + 16);
              drawRoundRect(ctx, bX, badgeY, badgeW, badgeH, 18, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.25)', 1);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 22px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${s.icon} ${s.text}`, bX + badgeW / 2, badgeY + badgeH / 2);
            });

          } else {
            // ── B. FASE 2: TARJETA DE CIERRE (OUTRO CARD) ─────────────────────
            // Fondo con degradado profundo Vinotinto & Dorado
            const outroGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.75);
            outroGrad.addColorStop(0, '#5e0017');
            outroGrad.addColorStop(0.6, '#2a000a');
            outroGrad.addColorStop(1, '#080808');
            ctx.fillStyle = outroGrad;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            // Borde perimetral dorado
            drawRoundRect(ctx, 40, 40, WIDTH - 80, HEIGHT - 80, 36, undefined, 'rgba(212, 175, 55, 0.4)', 2);

            // Logotipo Central
            if (logoImg) {
              const outroLogoW = 540;
              const outroLogoH = 135;
              ctx.drawImage(logoImg, (WIDTH - outroLogoW) / 2, HEIGHT * 0.22, outroLogoW, outroLogoH);
            } else {
              drawRoundRect(ctx, (WIDTH - 500) / 2, HEIGHT * 0.22, 500, 110, 24, '#800020', '#D4AF37', 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '900 32px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('RIV MARGARITA PREMIER', WIDTH / 2, HEIGHT * 0.22 + 55);
            }

            // Separador con estrella
            ctx.fillStyle = '#D4AF37';
            ctx.font = 'bold 24px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('✦  TU PRÓXIMO HOGAR EN MARGARITA  ✦', WIDTH / 2, HEIGHT * 0.38);

            // Título de la propiedad en Outro
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 44px system-ui, sans-serif';
            const shortTitle = property.title.length > 32 ? property.title.slice(0, 31) + '…' : property.title;
            ctx.fillText(shortTitle, WIDTH / 2, HEIGHT * 0.48);

            // Precio en Outro
            ctx.fillStyle = '#D4AF37';
            ctx.font = '900 76px system-ui, sans-serif';
            ctx.fillText(`$${fmt(property.price)} USD`, WIDTH / 2, HEIGHT * 0.56);

            // Tarjeta de contacto del asesor
            const cardW = WIDTH - 160;
            const cardH = 260;
            const cardX = 80;
            const cardY = HEIGHT * 0.65;
            drawRoundRect(ctx, cardX, cardY, cardW, cardH, 28, 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.2)', 1.5);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 32px system-ui, sans-serif';
            ctx.fillText(property.captador || 'Asesor Inmobiliario', WIDTH / 2, cardY + 70);

            if (advisorPhone) {
              ctx.fillStyle = '#D4AF37';
              ctx.font = '600 28px system-ui, sans-serif';
              ctx.fillText(`📲 WhatsApp: ${advisorPhone}`, WIDTH / 2, cardY + 125);
            }

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '500 24px system-ui, sans-serif';
            ctx.fillText('Contáctanos para coordinar tu visita privada', WIDTH / 2, cardY + 185);
          }

          setVideoProgress(Math.round((frame / totalFrames) * 100));
          frame++;
          requestAnimationFrame(drawFrame);
        };

        drawFrame();
      });

      setVideoPhase('done');
      setDone(true);
    } catch (e) {
      console.error(e);
      showToast('Error al generar el video. Tu navegador debe soportar MediaRecorder (Chrome/Edge).', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://rivmargaritapremier.com';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;

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
            className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="modal-container bg-white w-full sm:max-w-lg rounded-3xl shadow-2xl overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  {step !== 'format' && (
                    <button
                      onClick={() => { setStep(step === 'export' && selectedFormat !== 'video' ? 'template' : 'format'); setDone(false); }}
                      className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 mr-1 transition"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                      <span>Módulo de Marketing</span>
                      <BrandLogo size="xs" />
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {step === 'format' && 'Selecciona el canal de exportación'}
                      {step === 'template' && 'Elige la plantilla de diseño'}
                      {step === 'export' && (selectedFormat === 'whatsapp' ? 'Copywriting y Compartición Directa' : 'Generación lista')}
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
                              {key === 'video' && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">9:16 Vertical</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Watermark SVG</span>
                                </div>
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
                      <p className="text-sm font-semibold text-gray-600 mb-1">Selecciona una plantilla visual</p>
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
                        className="w-full py-4 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-2xl font-bold shadow-lg shadow-vinotinto/25 flex items-center justify-center gap-2 mt-2"
                      >
                        <Sparkles size={16} />
                        Continuar con Plantilla {selectedTemplate}
                      </motion.button>
                    </motion.div>
                  )}

                  {/* ─── STEP 3: EXPORT & WHATSAPP ACTIONS ──────────── */}
                  {step === 'export' && selectedFormat && (
                    <motion.div key="export" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      {/* Info card */}
                      <div className={`rounded-2xl p-4 border ${FORMAT_CONFIG[selectedFormat].border} ${FORMAT_CONFIG[selectedFormat].bg}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${FORMAT_CONFIG[selectedFormat].color} flex items-center justify-center shrink-0`}>
                            {(() => { const I = FORMAT_CONFIG[selectedFormat].icon; return <I size={20} className="text-white" />; })()}
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${FORMAT_CONFIG[selectedFormat].text}`}>{FORMAT_CONFIG[selectedFormat].label}</p>
                            {selectedFormat !== 'video' && <p className="text-xs text-gray-500">Plantilla {selectedTemplate} · {selectedTemplate === 'A' ? FORMAT_CONFIG[selectedFormat].templateA.name : FORMAT_CONFIG[selectedFormat].templateB.name}</p>}
                            {selectedFormat === 'video' && <p className="text-xs text-gray-500">Formato 9:16 Vertical · {allImages.length} fotos · Watermark y Outro de asesor</p>}
                          </div>
                        </div>
                      </div>

                      {/* SUBMÓDULO WHATSAPP: COPYWRITING & DEEP LINKING */}
                      {selectedFormat === 'whatsapp' && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700">Texto Formateado con Emojis:</span>
                            <button
                              type="button"
                              onClick={handleCopyText}
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                                copiedText ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {copiedText ? <Check size={12} /> : <Copy size={12} />}
                              {copiedText ? '¡Copiado!' : 'Copiar Texto'}
                            </button>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-800 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed select-all">
                            {buildWAText()}
                          </div>

                          {/* Botón Deep Link de Envío a WhatsApp */}
                          <button
                            type="button"
                            onClick={handleShareWhatsApp}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-95"
                          >
                            <MessageCircle size={18} />
                            Compartir Directo en WhatsApp
                          </button>
                        </div>
                      )}

                      {/* Video progress indicator */}
                      {selectedFormat === 'video' && isExporting && (
                        <div className="space-y-2 bg-violet-50 border border-violet-200 p-4 rounded-2xl">
                          <div className="flex justify-between text-xs font-bold text-violet-900">
                            <span>
                              {videoPhase === 'loading' ? 'Preparando fotos y watermark...' : 'Renderizando animación 9:16...'}
                            </span>
                            <span>{videoProgress}%</span>
                          </div>
                          <div className="w-full bg-violet-200 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 h-2.5 rounded-full transition-all duration-200" style={{ width: `${videoProgress}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Success banner */}
                      {done && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                            <Check size={20} className="text-green-600" strokeWidth={3} />
                          </div>
                          <div>
                            <p className="font-bold text-green-700 text-sm">¡Generación Completada!</p>
                            <p className="text-xs text-green-600 mt-0.5">
                              {selectedFormat === 'pdf'
                                ? 'Ficha PDF generada correctamente para tu dispositivo'
                                : 'Tu archivo está listo para guardar en fotos o compartir'}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Tarjeta de visualización y guardado directo en móviles */}
                      {done && generatedPreviewUrl && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-center">
                            {selectedFormat === 'video' ? (
                              <video
                                src={generatedPreviewUrl}
                                controls
                                playsInline
                                className="max-h-60 rounded-xl shadow-md border border-gray-200 bg-black"
                              />
                            ) : (
                              <img
                                src={generatedPreviewUrl}
                                alt="Plantilla Generada"
                                className="max-h-60 rounded-xl object-contain shadow-md border border-gray-200 bg-white"
                              />
                            )}
                          </div>

                          <div className="space-y-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (generatedFile && generatedBlob) {
                                  await triggerDownloadOrShare(generatedFile, generatedBlob, `Plantilla RIV - ${property.title}`);
                                }
                              }}
                              className="w-full py-3.5 bg-vinotinto hover:bg-[#a60029] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-vinotinto/25 active:scale-95 transition"
                            >
                              <Share2 size={18} />
                              Guardar en Fotos / Compartir
                            </button>

                            <a
                              href={generatedPreviewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition text-center"
                            >
                              <ExternalLink size={14} />
                              Abrir archivo en pestaña nueva
                            </a>

                            <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                              📱 <strong>En iPhone o Android:</strong> Toca <em>"Guardar en Fotos / Compartir"</em> o mantén presionada la imagen para guardarla en tu galería.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Download button */}
                      <motion.button
                        whileHover={{ scale: done ? 1 : 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                          done
                            ? 'bg-gray-800 hover:bg-gray-900 text-white shadow-gray-800/25'
                            : 'bg-gradient-to-r from-vinotinto to-vinotinto-light text-white shadow-vinotinto/25 disabled:opacity-60'
                        }`}
                      >
                        {isExporting ? (
                          <><Loader2 size={18} className="animate-spin" /> Procesando…</>
                        ) : done ? (
                          <><Check size={18} /> Regenerar archivo</>
                        ) : selectedFormat === 'whatsapp' ? (
                          <><Download size={18} /> Descargar Imagen 1:1 de WhatsApp</>
                        ) : selectedFormat === 'video' ? (
                          <><Video size={18} /> Generar y Descargar Video 9:16</>
                        ) : (
                          <><Download size={18} /> Descargar {selectedFormat === 'pdf' ? 'Ficha PDF' : 'Imagen 9:16'}</>
                        )}
                      </motion.button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        ─── HIDDEN TEMPLATES (OFF-SCREEN ACTIVO PARA HTML2CANVAS) ─────────────
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          zIndex: -9999,
          pointerEvents: 'none',
          opacity: 0.99,
          overflow: 'visible',
        }}
      >
        {/* ── PDF – Plantilla A: Clásica con Membrete Corporativo y QR ─────── */}
        <div ref={pdfARef} style={{ width: '794px', minHeight: '1123px', background: '#FFFFFF', padding: '50px 60px', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          {/* Header Corporativo con LOGO RIV MARGARITA PREMIER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #800020', paddingBottom: '20px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/logo-riv.svg" alt="RIV Margarita Premier" style={{ height: '64px', objectFit: 'contain' }} crossOrigin="anonymous" />
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ background: '#800020', color: '#fff', padding: '6px 18px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, letterSpacing: '2px' }}>FICHA TÉCNICA OFICIAL</span>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '6px 0 0', fontWeight: 600 }}>Isla de Margarita, Venezuela</p>
            </div>
          </div>

          {/* Título y Precio */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div style={{ flex: 1, paddingRight: '20px' }}>
              <span style={{ color: '#800020', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{property.propertyType || 'Inmueble'} en Venta</span>
              <h1 style={{ fontSize: '36px', fontWeight: 900, color: '#111', margin: '4px 0 0', lineHeight: 1.15 }}>{property.title}</h1>
              <p style={{ color: '#6B7280', marginTop: '6px', fontSize: '15px' }}>📍 {property.location}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '38px', fontWeight: 900, color: '#800020', margin: 0 }}>${fmt(property.price)}</p>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: '2px 0 0', fontWeight: 600 }}>USD</p>
            </div>
          </div>

          {/* Foto Principal */}
          <img src={base64Img || property.image} crossOrigin="anonymous" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '18px', marginBottom: '28px' }} alt="" />

          {/* Specs Dinámicos (Filtrados sin 0 habs) */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${validSpecs.length}, 1fr)`, gap: '16px', marginBottom: '28px' }}>
            {validSpecs.map(s => {
              const Icon = s.icon;
              return (
              <div key={s.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '18px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Icon size={28} color="#111" /></div>
                <p style={{ fontSize: '26px', fontWeight: 800, color: '#111', margin: 0 }}>{s.v}</p>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
              </div>
            )})}
          </div>

          {/* Descripción */}
          <div style={{ flex: 1, marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111', marginBottom: '8px' }}>Descripción de la Propiedad</h2>
            <p style={{ color: '#4B5563', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>{property.description}</p>
            {property.amenities && property.amenities.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111', marginBottom: '10px' }}>Comodidades y Atributos</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {property.amenities.map(a => (
                    <span key={a} style={{ background: '#FFF1F4', color: '#800020', border: '1px solid #FECDD3', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 600 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Corporativo con Asesor y Código QR */}
          <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', borderRadius: '18px', padding: '18px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#800020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 800, flexShrink: 0 }}>
                {property.captador ? property.captador.charAt(0).toUpperCase() : 'R'}
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Asesor Inmobiliario</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: '#111', margin: '2px 0 0' }}>{property.captador || 'RIV Premier'}</p>
                {advisorPhone && <p style={{ fontSize: '13px', color: '#800020', fontWeight: 700, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}><Smartphone size={14} /> {advisorPhone}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'right' }}>
              <div>
                <p style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 700, margin: 0 }}>ESCANEA PARA MÁS INFO</p>
                <p style={{ fontSize: '12px', color: '#111', fontWeight: 700, margin: '2px 0 0' }}>Ficha en Línea</p>
              </div>
              <img src={qrUrl} alt="QR Ficha" style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1px solid #E5E7EB' }} crossOrigin="anonymous" />
            </div>
          </div>
        </div>

        {/* ── PDF – Plantilla B: Lujosa Gold Edition con QR ───────────────── */}
        <div ref={pdfBRef} style={{ width: '794px', minHeight: '1123px', background: '#0F0F0F', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          {/* Hero con Membrete Dorado */}
          <div style={{ position: 'relative', height: '480px', overflow: 'hidden' }}>
            <img src={base64Img || property.image} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} alt="" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.9) 100%)' }} />
            {/* Top Bar con Logo */}
            <div style={{ position: 'absolute', top: 40, left: 60, right: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <img src="/logo-riv.svg" alt="RIV Margarita Premier" style={{ height: '54px', objectFit: 'contain' }} crossOrigin="anonymous" />
              <div style={{ background: '#D4AF37', color: '#000', padding: '6px 18px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>PREMIUM COLLECTION</div>
            </div>
            {/* Title Bottom */}
            <div style={{ position: 'absolute', bottom: 40, left: 60, right: 60 }}>
              <h1 style={{ fontSize: '42px', fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1 }}>{property.title}</h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '8px', fontSize: '16px' }}>📍 {property.location}</p>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '40px 60px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '24px' }}>
              <div>
                <p style={{ color: '#D4AF37', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', margin: 0 }}>PRECIO DE INVERSIÓN</p>
                <p style={{ color: '#fff', fontSize: '46px', fontWeight: 900, margin: '4px 0 0' }}>${fmt(property.price)} <span style={{ fontSize: '18px', fontWeight: 400, color: '#9CA3AF' }}>USD</span></p>
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                {validSpecs.map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ color: '#D4AF37', fontSize: '28px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <h2 style={{ color: '#D4AF37', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', margin: '0 0 10px' }}>DESCRIPCIÓN</h2>
            <p style={{ color: '#D1D5DB', fontSize: '15px', lineHeight: 1.8, margin: 0 }}>{property.description}</p>

            {property.amenities && property.amenities.length > 0 && (
              <div style={{ marginTop: '28px' }}>
                <h2 style={{ color: '#D4AF37', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', margin: '0 0 12px' }}>COMODIDADES DESTACADAS</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {property.amenities.map(a => (
                    <span key={a} style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 600 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Dorado con QR */}
          <div style={{ background: '#D4AF37', padding: '24px 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '22px', fontWeight: 900, flexShrink: 0 }}>
                {property.captador ? property.captador.charAt(0).toUpperCase() : 'R'}
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', margin: 0, letterSpacing: '1px' }}>ASESOR EXCLUSIVO</p>
                <p style={{ fontSize: '20px', fontWeight: 900, color: '#000', margin: '2px 0 0' }}>{property.captador}</p>
                {advisorPhone && <p style={{ fontSize: '13px', fontWeight: 800, color: '#000', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}><Smartphone size={14} /> {advisorPhone}</p>}
              </div>
            </div>
            <img src={qrUrl} alt="QR" style={{ width: '60px', height: '60px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.2)' }} crossOrigin="anonymous" />
          </div>
        </div>

        {/* ── Instagram – Plantilla A: Clean Dark 9:16 (Ultra-Minimalista) ──── */}
        <div
          ref={igARef}
          style={{
            position: 'relative',
            width: '1080px',
            height: '1920px',
            background: '#0a0a0a',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* FOTO FULL BLEED — sin distorsión */}
          <img
            src={base64Img || property.image}
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            alt=""
          />

          {/* DEGRADADO SUTIL SOLO EN LA BASE para contraste del texto */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 35%, transparent 60%)',
            pointerEvents: 'none'
          }} />

          {/* BADGE SUPERIOR DERECHO — Precio o Estatus */}
          <div style={{
            position: 'absolute',
            top: 56,
            right: 56,
            zIndex: 20,
            background: '#8B0000',
            padding: '18px 36px',
            display: 'flex',
            alignItems: 'center',
            gap: '0'
          }}>
            <span style={{
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '36px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              lineHeight: 1
            }}>
              {property.status === 'Vendida'
                ? 'VENDIDO'
                : `$${fmt(property.price)} USD`}
            </span>
          </div>

          {/* BLOQUE INFERIOR MINIMALISTA — directo sobre la foto */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '60px 60px 72px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: '28px'
          }}>
            {/* Ícono izquierdo — Casa vectorial */}
            <div style={{ flexShrink: 0, paddingBottom: '8px' }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>

            {/* Textos centrales */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Línea 1 — Título / Ubicación */}
              <p style={{
                color: '#FFFFFF',
                fontSize: '32px',
                fontWeight: 500,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                margin: '0 0 10px 0',
                lineHeight: 1.2,
                opacity: 0.9
              }}>
                {property.location.toUpperCase()}
              </p>

              {/* Línea 2 — Tipo de inmueble + Atributos */}
              <p style={{
                color: '#FFFFFF',
                fontSize: '46px',
                fontWeight: 800,
                textTransform: 'uppercase',
                margin: '0 0 16px 0',
                lineHeight: 1.1,
                letterSpacing: '-0.5px'
              }}>
                {property.propertyType
                  ? `${property.propertyType.toUpperCase()} ${property.status === 'Vendida' ? 'VENDIDA' : 'EN VENTA'}`
                  : 'EN VENTA'}
                {validSpecs.length > 0 && (
                  <span style={{ fontSize: '34px', fontWeight: 700, opacity: 0.85 }}>
                    {' · '}{validSpecs.map(s => s.v).join(' | ')}
                  </span>
                )}
              </p>

              {/* Línea 3 — RIF Corporativo */}
              <p style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: '22px',
                fontStyle: 'italic',
                fontWeight: 400,
                margin: 0,
                letterSpacing: '0.5px'
              }}>
                J-11055496-2
              </p>
            </div>

            {/* Flecha derecha */}
            <div style={{ flexShrink: 0, paddingBottom: '8px' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </div>



        {/* ── Instagram – Plantilla B: Clean Gold 9:16 (Ultra-Minimalista) ───── */}
        <div
          ref={igBRef}
          style={{
            position: 'relative',
            width: '1080px',
            height: '1920px',
            background: '#0a0a0a',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* FOTO FULL BLEED — sin distorsión */}
          <img
            src={base64Img || property.image}
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            alt=""
          />

          {/* DEGRADADO SUTIL SOLO EN LA BASE */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 35%, transparent 60%)',
            pointerEvents: 'none'
          }} />

          {/* BADGE SUPERIOR DERECHO — Dorado */}
          <div style={{
            position: 'absolute',
            top: 56,
            right: 56,
            zIndex: 20,
            background: '#D4AF37',
            padding: '18px 36px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              color: '#000000',
              fontWeight: 900,
              fontSize: '36px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              lineHeight: 1
            }}>
              {property.status === 'Vendida'
                ? 'VENDIDO'
                : `$${fmt(property.price)} USD`}
            </span>
          </div>

          {/* BLOQUE INFERIOR MINIMALISTA */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '60px 60px 72px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: '28px'
          }}>
            {/* Ícono izquierdo */}
            <div style={{ flexShrink: 0, paddingBottom: '8px' }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>

            {/* Textos centrales */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Línea 1 — Ubicación */}
              <p style={{
                color: '#FFFFFF',
                fontSize: '32px',
                fontWeight: 500,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                margin: '0 0 10px 0',
                lineHeight: 1.2,
                opacity: 0.9
              }}>
                {property.location.toUpperCase()}
              </p>

              {/* Línea 2 — Tipo + Atributos en dorado */}
              <p style={{
                color: '#D4AF37',
                fontSize: '46px',
                fontWeight: 800,
                textTransform: 'uppercase',
                margin: '0 0 16px 0',
                lineHeight: 1.1,
                letterSpacing: '-0.5px'
              }}>
                {property.propertyType
                  ? `${property.propertyType.toUpperCase()} ${property.status === 'Vendida' ? 'VENDIDA' : 'EN VENTA'}`
                  : 'EN VENTA'}
                {validSpecs.length > 0 && (
                  <span style={{ fontSize: '34px', fontWeight: 700, opacity: 0.85, color: '#FFFFFF' }}>
                    {' · '}{validSpecs.map(s => s.v).join(' | ')}
                  </span>
                )}
              </p>

              {/* Línea 3 — RIF Corporativo */}
              <p style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: '22px',
                fontStyle: 'italic',
                fontWeight: 400,
                margin: 0,
                letterSpacing: '0.5px'
              }}>
                J-11055496-2
              </p>
            </div>

            {/* Flecha derecha en dorado */}
            <div style={{ flexShrink: 0, paddingBottom: '8px' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </div>



        {/* ── WhatsApp – Plantilla A: Clean Full Photo 1:1 (Ultra-Minimalista) ─ */}
        <div
          ref={waARef}
          style={{
            position: 'relative',
            width: '1080px',
            height: '1080px',
            background: '#0a0a0a',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            overflow: 'hidden'
          }}
        >
          {/* FOTO FULL BLEED sin distorsión */}
          <img
            src={base64Img || property.image}
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            alt=""
          />

          {/* DEGRADADO SUTIL SOLO EN LA BASE */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.32) 35%, transparent 60%)',
            pointerEvents: 'none'
          }} />

          {/* BADGE SUPERIOR DERECHO — Precio */}
          <div style={{
            position: 'absolute',
            top: 48,
            right: 48,
            zIndex: 20,
            background: '#8B0000',
            padding: '16px 32px'
          }}>
            <span style={{
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '34px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              lineHeight: 1
            }}>
              {property.status === 'Vendida'
                ? 'VENDIDO'
                : `$${fmt(property.price)} USD`}
            </span>
          </div>

          {/* BLOQUE INFERIOR MINIMALISTA */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '52px 52px 60px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: '24px'
          }}>
            {/* Ícono izquierdo */}
            <div style={{ flexShrink: 0, paddingBottom: '6px' }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>

            {/* Textos centrales */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                color: '#FFFFFF',
                fontSize: '28px',
                fontWeight: 500,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                margin: '0 0 8px 0',
                lineHeight: 1.2,
                opacity: 0.9
              }}>
                {property.location.toUpperCase()}
              </p>
              <p style={{
                color: '#FFFFFF',
                fontSize: '42px',
                fontWeight: 800,
                textTransform: 'uppercase',
                margin: '0 0 12px 0',
                lineHeight: 1.1
              }}>
                {property.propertyType
                  ? `${property.propertyType.toUpperCase()} ${property.status === 'Vendida' ? 'VENDIDA' : 'EN VENTA'}`
                  : 'EN VENTA'}
                {validSpecs.length > 0 && (
                  <span style={{ fontSize: '30px', fontWeight: 700, opacity: 0.85 }}>
                    {' · '}{validSpecs.map(s => s.v).join(' | ')}
                  </span>
                )}
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '20px',
                fontStyle: 'italic',
                fontWeight: 400,
                margin: 0
              }}>
                J-11055496-2
              </p>
            </div>

            {/* Flecha derecha */}
            <div style={{ flexShrink: 0, paddingBottom: '6px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── WhatsApp – Plantilla B: Clean Split 1:1 (Ultra-Minimalista) ──────── */}
        <div
          ref={waBRef}
          style={{
            width: '1080px',
            height: '1080px',
            background: '#FFFFFF',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* FOTO SUPERIOR — 58% del canvas, sin distorsión */}
          <div style={{ position: 'relative', height: '626px', flexShrink: 0, overflow: 'hidden' }}>
            <img
              src={base64Img || property.image}
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                display: 'block'
              }}
              alt=""
            />
            {/* Gradiente sutil sobre la foto */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.12) 100%)'
            }} />
            {/* BADGE SUPERIOR DERECHO */}
            <div style={{
              position: 'absolute',
              top: 36,
              right: 36,
              background: '#8B0000',
              padding: '14px 28px',
              zIndex: 10
            }}>
              <span style={{
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '28px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                lineHeight: 1
              }}>
                {property.status === 'Vendida' ? 'VENDIDO' : 'EN VENTA'}
              </span>
            </div>
          </div>

          {/* PANEL INFERIOR BLANCO — Info limpia */}
          <div style={{
            flex: 1,
            padding: '36px 52px 40px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: '20px',
            background: '#FFFFFF'
          }}>
            {/* Ícono casa */}
            <div style={{ flexShrink: 0, paddingBottom: '4px' }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>

            {/* Textos */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                color: '#555555',
                fontSize: '22px',
                fontWeight: 500,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                margin: '0 0 6px 0',
                lineHeight: 1.2
              }}>
                {property.location.toUpperCase()}
              </p>
              <p style={{
                color: '#111111',
                fontSize: '36px',
                fontWeight: 800,
                textTransform: 'uppercase',
                margin: '0 0 10px 0',
                lineHeight: 1.1
              }}>
                {property.propertyType
                  ? `${property.propertyType.toUpperCase()} ${property.status === 'Vendida' ? 'VENDIDA' : 'EN VENTA'}`
                  : 'EN VENTA'}
                {validSpecs.length > 0 && (
                  <span style={{ fontSize: '26px', fontWeight: 600, color: '#444444' }}>
                    {' · '}{validSpecs.map(s => s.v).join(' | ')}
                  </span>
                )}
              </p>
              <p style={{
                color: '#999999',
                fontSize: '17px',
                fontStyle: 'italic',
                fontWeight: 400,
                margin: 0
              }}>
                J-11055496-2
              </p>
            </div>

            {/* Precio y flecha */}
            <div style={{ flexShrink: 0, textAlign: 'right', paddingBottom: '4px' }}>
              <p style={{
                fontSize: '38px',
                fontWeight: 900,
                color: '#8B0000',
                margin: '0 0 6px 0',
                lineHeight: 1
              }}>
                ${fmt(property.price)}
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#999999', display: 'block' }}>USD</span>
              </p>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
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
      // IG-B: Clean Gold thumbnail
      <div style={{ width: '100%', aspectRatio: '0.56', background: '#0a0a0a', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 40%, transparent 65%)' }} />
        {/* Badge dorado top-right */}
        <div style={{ position: 'absolute', top: '7px', right: '7px', background: '#D4AF37', padding: '3px 7px' }}>
          <div style={{ width: '28px', height: '6px', background: '#000', borderRadius: '1px' }} />
        </div>
        {/* Bloque inferior minimalista */}
        <div style={{ position: 'absolute', bottom: '10px', left: '8px', right: '8px', display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
          <div style={{ width: '10px', height: '10px', border: '1px solid rgba(255,255,255,0.8)', flexShrink: 0, marginBottom: '1px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '70%', height: '3px', background: 'rgba(255,255,255,0.7)', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '95%', height: '5px', background: '#D4AF37', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '45%', height: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '1px' }} />
          </div>
          <div style={{ width: '8px', height: '8px', border: '1px solid rgba(212,175,55,0.8)', flexShrink: 0, marginBottom: '1px', borderRadius: '1px' }} />
        </div>
      </div>
    ) : (
      // IG-A: Clean Dark thumbnail
      <div style={{ width: '100%', aspectRatio: '0.56', background: '#0a0a0a', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 40%, transparent 65%)' }} />
        {/* Badge vinotinto top-right */}
        <div style={{ position: 'absolute', top: '7px', right: '7px', background: '#8B0000', padding: '3px 7px' }}>
          <div style={{ width: '28px', height: '6px', background: '#fff', borderRadius: '1px' }} />
        </div>
        {/* Bloque inferior minimalista */}
        <div style={{ position: 'absolute', bottom: '10px', left: '8px', right: '8px', display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
          <div style={{ width: '10px', height: '10px', border: '1px solid rgba(255,255,255,0.8)', flexShrink: 0, marginBottom: '1px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '70%', height: '3px', background: 'rgba(255,255,255,0.7)', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '95%', height: '5px', background: '#fff', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '45%', height: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '1px' }} />
          </div>
          <div style={{ width: '8px', height: '8px', border: '1px solid rgba(255,255,255,0.7)', flexShrink: 0, marginBottom: '1px', borderRadius: '1px' }} />
        </div>
      </div>
    );
  }

  if (format === 'whatsapp') {
    return isB ? (
      // WA-B: Clean Split thumbnail
      <div style={{ width: '100%', aspectRatio: '1', background: '#fff', borderRadius: '10px', overflow: 'hidden', fontSize: 0, display: 'flex', flexDirection: 'column', border: '1px solid #E5E7EB' }}>
        {/* Foto */}
        <div style={{ position: 'relative', height: '58%', overflow: 'hidden', flexShrink: 0 }}>
          <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          <div style={{ position: 'absolute', top: '5px', right: '5px', background: '#8B0000', padding: '2px 6px' }}>
            <div style={{ width: '22px', height: '5px', background: '#fff', borderRadius: '1px' }} />
          </div>
        </div>
        {/* Panel blanco */}
        <div style={{ flex: 1, padding: '7px 8px 8px', display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
          <div style={{ width: '9px', height: '9px', border: '1px solid #111', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '75%', height: '3px', background: '#999', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '100%', height: '5px', background: '#111', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '40%', height: '3px', background: '#CCC', borderRadius: '1px' }} />
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ width: '28px', height: '5px', background: '#8B0000', borderRadius: '1px', marginBottom: '3px', marginLeft: 'auto' }} />
            <div style={{ width: '8px', height: '8px', border: '1px solid #111', borderRadius: '1px', marginLeft: 'auto' }} />
          </div>
        </div>
      </div>
    ) : (
      // WA-A: Clean Full Photo thumbnail
      <div style={{ width: '100%', aspectRatio: '1', background: '#0a0a0a', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.20) 40%, transparent 60%)' }} />
        {/* Badge top-right */}
        <div style={{ position: 'absolute', top: '7px', right: '7px', background: '#8B0000', padding: '3px 7px' }}>
          <div style={{ width: '28px', height: '5px', background: '#fff', borderRadius: '1px' }} />
        </div>
        {/* Bloque inferior */}
        <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
          <div style={{ width: '9px', height: '9px', border: '1px solid rgba(255,255,255,0.8)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '70%', height: '3px', background: 'rgba(255,255,255,0.6)', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '95%', height: '5px', background: '#fff', borderRadius: '1px', marginBottom: '3px' }} />
            <div style={{ width: '45%', height: '3px', background: 'rgba(255,255,255,0.35)', borderRadius: '1px' }} />
          </div>
          <div style={{ width: '8px', height: '8px', border: '1px solid rgba(255,255,255,0.7)', flexShrink: 0, borderRadius: '1px' }} />
        </div>
      </div>
    );
  }

  return <div style={{ width: '100%', aspectRatio: '1', background: '#EEE', borderRadius: '10px' }} />;
}

// ─── Canvas Helper ─────────────────────────────────────────────────────────────
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle?: string,
  strokeStyle?: string,
  lineWidth = 1
) {
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
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

