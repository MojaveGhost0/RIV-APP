'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  X, FileText, Instagram, MessageCircle, Video,
  MapPin, Bed, Bath, Maximize, Ruler, Smartphone, User, ArrowLeft,
  Download, ChevronRight, Star, Sparkles, Check,
  Loader2, Copy, Share2, ExternalLink, Eye
} from 'lucide-react';
import { toCanvas } from 'html-to-image';
import { motion, AnimatePresence } from 'framer-motion';
import { Property } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BrandLogo from './BrandLogo';
import { DEFAULT_BRAND_LOGO } from '../lib/brandConfig';
import { formatPrice, fmt } from '../lib/currency';

/** Fuente determinista cargada en app/layout.tsx para evitar variaciones entre Windows / iOS / Android */
const EXPORT_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Convierte cualquier URL de imagen (local o remota) en un DataURL Base64 real.
 * Usa fetch + FileReader (y proxy same-origin de respaldo) para evitar bloqueos de caché CORS en iOS Safari / Chrome.
 */
async function urlToBase64(url: string, mimeType: string = 'image/jpeg'): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const isPng = url.toLowerCase().includes('.png') || mimeType === 'image/png';
  const outMime = isPng ? 'image/png' : mimeType;

  // 1. Intentar fetch directo a Blob -> FileReader (evita el bug de caché de <img> en iOS WebKit)
  try {
    const isLocal = url.startsWith('/');
    const res = await fetch(url, isLocal ? { cache: 'default' } : { mode: 'cors', cache: 'no-store' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        return await blobToDataUrl(blob);
      }
    }
  } catch {
    // Continuar al proxy same-origin si es URL externa
  }

  // 2. Si es URL externa (http/https) y falló por CORS en móvil, usar nuestro proxy same-origin /api/image-proxy
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const proxyRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        if (blob.size > 0) {
          return await blobToDataUrl(blob);
        }
      }
    } catch {
      // Continuar al respaldo por Canvas
    }
  }

  // 3. Respaldo por HTMLImageElement + cache-buster
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
          resolve(c.toDataURL(outMime, 0.95));
          return;
        }
      } catch (err) {
        console.warn('Canvas toDataURL failed in urlToBase64:', err);
      }
      resolve(url);
    };
    img.onerror = () => resolve(url);
    const sep = url.includes('?') ? '&' : '?';
    img.src = url.startsWith('/') ? url : `${url}${sep}_cb=${Date.now()}`;
  });
}

/**
 * Carga y decodifica un HTMLImageElement en memoria a partir de cualquier URL o DataURL.
 * No asigna crossOrigin cuando ya es data: para evitar bloqueos de WebKit en iOS.
 */
async function loadDecodedImage(src: string, isPng = false): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const dataUrl = src.startsWith('data:') ? src : await urlToBase64(src, isPng ? 'image/png' : 'image/jpeg');
  if (!dataUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    if (!dataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // ignore decode warning
      }
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Pre-recorta una imagen con matemática 'cover' centrada para evitar estiramiento */
async function getCoverCroppedImage(url: string, targetWidth: number, targetHeight: number): Promise<string> {
  if (!url) return '';
  const img = await loadDecodedImage(url, false);
  if (!img) return '';
  try {
    const c = document.createElement('canvas');
    c.width = targetWidth;
    c.height = targetHeight;
    const ctx = c.getContext('2d');
    if (ctx) {
      drawCoverImageBox(ctx, img, 0, 0, targetWidth, targetHeight, 0, 1);
      return c.toDataURL('image/jpeg', 0.95);
    }
  } catch (err) {
    console.warn('Canvas cover crop failed:', err);
  }
  return '';
}

/** Dibuja un HTMLImageElement en modo 'cover' dentro de una caja (x, y, w, h) con soporte de border-radius y opacidad */
function drawCoverImageBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  radius = 0,
  opacity = 1
) {
  const imgWidth = img.naturalWidth || img.width || boxW;
  const imgHeight = img.naturalHeight || img.height || boxH;
  const imgRatio = imgWidth / imgHeight;
  const targetRatio = boxW / boxH;

  let sWidth = imgWidth;
  let sHeight = imgHeight;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sHeight = imgHeight;
    sWidth = imgHeight * targetRatio;
    sx = (imgWidth - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = imgWidth;
    sHeight = imgWidth / targetRatio;
    sx = 0;
    sy = (imgHeight - sHeight) / 2;
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  if (radius > 0) {
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, boxX, boxY, boxW, boxH);
  ctx.restore();
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

/** Filtro dinámico de atributos: garantiza siempre 3 columnas simétricas (Habitaciones, Baños y Área) */
function getValidSpecs(p: Property) {
  const specs: Array<{ label: string; v: string | number; emoji: string; icon: any }> = [];
  const typeLower = (p.propertyType || '').toLowerCase();
  const titleLower = (p.title || '').toLowerCase();
  const isLand = typeLower.includes('terreno') || typeLower.includes('parcela') || typeLower.includes('lote') ||
                 titleLower.includes('terreno') || titleLower.includes('parcela');

  if (isLand) {
    const sqmVal = p.sqm > 0 ? `${p.sqm} m²` : '— m²';
    specs.push({ label: 'Área Terreno', v: sqmVal, emoji: '📐', icon: Ruler });
    specs.push({ label: 'Topografía', v: 'Plana', emoji: '📐', icon: Maximize });
    specs.push({ label: 'Estatus Legal', v: 'Al Día', emoji: '✓', icon: Check });
    return specs;
  }

  // 1. Habitaciones (al menos 1 si no está configurado o si es 0 en residencial)
  const bedsVal = p.beds > 0 ? p.beds : 1;
  specs.push({ label: 'Habitaciones', v: bedsVal, emoji: '🛏', icon: Bed });

  // 2. Baños: SIEMPRE mostrar para que nunca quede el espacio vacío
  const bathsVal = p.baths > 0 ? p.baths : 1;
  specs.push({ label: 'Baños', v: bathsVal, emoji: '🚿', icon: Bath });

  // 3. Área Total
  const sqmVal = p.sqm > 0 ? `${p.sqm} m²` : '— m²';
  specs.push({ label: 'Área Total', v: sqmVal, emoji: '📐', icon: Ruler });

  return specs;
}

/** Calcula tamaño de fuente adaptativo para títulos largos sin romper la simetría de 2 líneas máx */
function getAdaptiveTitleSize(title: string, basePx: number, minPx: number): number {
  const len = (title || '').trim().length;
  if (len <= 24) return basePx;
  if (len >= 56) return minPx;
  const ratio = (len - 24) / (56 - 24);
  return Math.round(basePx - ratio * (basePx - minPx));
}

/** Normaliza y limita la descripción para que el PDF mantenga proporción A4 exacta sin vacíos ni desbordes */
function getSafeDescription(p: Property): string {
  const raw = (p.description || '').trim().replace(/\s+/g, ' ');
  const fallback = `Exclusiva propiedad tipo ${(p.propertyType || 'inmueble').toLowerCase()} ubicada estratégicamente en ${p.location || 'Isla de Margarita'}. Cuenta con una excelente distribución arquitectónica de ${p.sqm > 0 ? `${p.sqm} m²` : 'amplios espacios'}, acabados de primera calidad, óptima iluminación natural y documentación lista para firma inmediata con el respaldo de RIV Margarita Premier.`;
  const text = raw.length >= 70 ? raw : (raw ? `${raw} ${fallback}` : fallback);
  if (text.length <= 420) return text;
  const sliced = text.slice(0, 417);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 320 ? lastSpace : 417)}…`;
}

/** Garantiza siempre entre 6 y 9 comodidades (grilla simétrica de 3 columnas) para que el PDF nunca se vea vacío */
function getSafeAmenities(p: Property): string[] {
  const defaults = [
    'Ubicación Estratégica',
    'Documentación al Día',
    'Excelente Iluminación',
    'Seguridad y Privacidad',
    'Alta Revalorización',
    'Asesoría Exclusiva RIV',
  ];
  const existing = (p.amenities || []).map(a => a.trim()).filter(Boolean);
  const merged = [...existing];
  for (const d of defaults) {
    if (merged.length >= 6) break;
    if (!merged.some(m => m.toLowerCase() === d.toLowerCase())) {
      merged.push(d);
    }
  }
  // Ajustar a múltiplo de 3 (6 o 9) para que la grilla de 3 columnas sea 100% simétrica
  if (merged.length > 9) return merged.slice(0, 9);
  if (merged.length > 6 && merged.length < 9) return merged.slice(0, 6);
  return merged.slice(0, 6);
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
  const [base64PdfImg, setBase64PdfImg] = useState<string>('');
  const [base64IgImg, setBase64IgImg] = useState<string>('');
  const [base64WaImg, setBase64WaImg] = useState<string>('');
  const [base64Logo, setBase64Logo] = useState<string>('');
  const [base64Qr, setBase64Qr] = useState<string>('');
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);
  const [generatedFile, setGeneratedFile] = useState<File | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);

  const advisorPhone: string = (property.captador ? getAdvisorPhone(property.captador) : '') || '';

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://rivmargaritapremier.com';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;

  // Preload logo and QR to base64 DataURL (evita fallos de red o CORS en exportación)
  useEffect(() => {
    let isMounted = true;
    urlToBase64('/logo-riv.png', 'image/png').then(b64 => {
      if (isMounted && b64) setBase64Logo(b64);
    });
    if (qrUrl) {
      urlToBase64(qrUrl, 'image/png').then(b64 => {
        if (isMounted && b64) setBase64Qr(b64);
      });
    }
    return () => { isMounted = false; };
  }, [qrUrl]);

  // Preload property image to base64 DataURL (y versiones proporcionales pre-recortadas para evitar estiramiento)
  useEffect(() => {
    let isMounted = true;
    if (property.image) {
      urlToBase64(property.image).then(b64 => {
        if (isMounted && b64) setBase64Img(b64);
      });
      getCoverCroppedImage(property.image, 1380, 680).then(b64 => {
        if (isMounted && b64) setBase64PdfImg(b64);
      });
      getCoverCroppedImage(property.image, 1080, 1920).then(b64 => {
        if (isMounted && b64) setBase64IgImg(b64);
      });
      getCoverCroppedImage(property.image, 1080, 1080).then(b64 => {
        if (isMounted && b64) setBase64WaImg(b64);
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
    const isRental = property.operacion === 'Alquiler' || property.status === 'Alquilada';
    const opLabel = isRental ? 'en Alquiler Fijo' : 'en Venta';
    const priceTitle = isRental ? 'Canon Mensual' : 'Precio de Venta';
    const priceSuffix = isRental ? 'USD/mes' : 'USD';

    return `✨ *OPORTUNIDAD INMOBILIARIA EXCLUSIVA* ✨\n\n🏢 *${property.title}*\n🏷 *Tipo:* ${property.propertyType || 'Inmueble'} ${opLabel}\n📍 *Ubicación:* ${property.location}\n💰 *${priceTitle}:* *$${fmt(property.price)} ${priceSuffix}*\n\n${specsLines.join('\n')}${amenitiesBlock}\n👤 *Asesor Inmobiliario:* *${property.captador || 'RIV Margarita Premier'}*${phoneStr}\n\n💬 _Para más información o agendar una visita privada, responde a este mensaje._\n✦ *RIV MARGARITA PREMIER* ✦`;
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
      const rootEl = ref.current;

      // 1. Cargar y decodificar en memoria los HTMLImageElement reales (Foto, Logo y QR)
      // Esto evita por completo el bug de iOS WebKit (Safari y Chrome en iPhone) donde <foreignObject> no pinta etiquetas <img>.
      const [photoImgEl, logoImgEl, qrImgEl] = await Promise.all([
        loadDecodedImage(base64Img || property.image, false),
        loadDecodedImage(base64Logo || '/logo-riv.png', true),
        selectedFormat === 'pdf' ? loadDecodedImage(base64Qr || qrUrl, true) : Promise.resolve(null),
      ]);

      if (photoImgEl?.src?.startsWith('data:') && !base64Img) {
        setBase64Img(photoImgEl.src);
      }
      if (logoImgEl?.src?.startsWith('data:') && !base64Logo) {
        setBase64Logo(logoImgEl.src);
      }
      if (qrImgEl?.src?.startsWith('data:') && !base64Qr) {
        setBase64Qr(qrImgEl.src);
      }

      // 2. Cargar explícitamente los pesos de Inter antes de capturar para garantizar métricas idénticas
      if (typeof document !== 'undefined' && document.fonts) {
        await Promise.allSettled([
          document.fonts.load('600 16px Inter'),
          document.fonts.load('700 18px Inter'),
          document.fonts.load('800 24px Inter'),
          document.fonts.load('900 44px Inter'),
        ]);
        await document.fonts.ready;
      }
      await new Promise(r => setTimeout(r, 80));

      const isDark = (selectedFormat === 'pdf' && selectedTemplate === 'B') ||
                     (selectedFormat === 'instagram') ||
                     (selectedFormat === 'whatsapp' && selectedTemplate === 'A');
      const bgColor = isDark ? '#0F0F0F' : '#FFFFFF';

      const dims = selectedFormat === 'pdf'
        ? { width: 794, height: 1123 }
        : selectedFormat === 'instagram'
          ? { width: 1080, height: 1920 }
          : { width: 1080, height: 1080 };

      const SCALE = 2;

      // 3. Medir coordenadas exactas de todas las imágenes dentro de la plantilla antes de capturar
      const rootRect = rootEl.getBoundingClientRect();
      const imgNodes = Array.from(rootEl.querySelectorAll('img[data-canvas-role]')) as HTMLImageElement[];
      const measuredLayers = imgNodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          node,
          role: node.getAttribute('data-canvas-role') as 'photo' | 'logo' | 'qr',
          layer: (node.getAttribute('data-canvas-layer') || 'overlay') as 'underlay' | 'overlay',
          radius: parseFloat(node.getAttribute('data-canvas-radius') || '0'),
          opacity: parseFloat(node.getAttribute('data-canvas-opacity') || '1'),
          x: rect.left - rootRect.left,
          y: rect.top - rootRect.top,
          w: rect.width,
          h: rect.height,
        };
      });

      const hasUnderlay = measuredLayers.some((l) => l.layer === 'underlay');
      const templateContainer = rootEl.firstElementChild as HTMLElement | null;
      const prevContainerBg = templateContainer ? templateContainer.style.background : '';

      // 4. Ocultar temporalmente las etiquetas <img> durante la captura de la interfaz con html-to-image
      // para que las fotos y el logo se pinten con Canvas 2D nativo a máxima nitidez en iPhone y Android.
      measuredLayers.forEach((l) => {
        l.node.style.visibility = 'hidden';
      });
      if (hasUnderlay && templateContainer) {
        templateContainer.style.background = 'transparent';
      }

      let uiCanvas: HTMLCanvasElement;
      try {
        uiCanvas = await toCanvas(rootEl, {
          pixelRatio: SCALE,
          width: dims.width,
          height: dims.height,
          backgroundColor: hasUnderlay ? 'rgba(0,0,0,0)' : bgColor,
          cacheBust: false,
          style: {
            transform: 'none',
            transformOrigin: 'top left',
            margin: '0',
          },
        });
      } catch (err) {
        console.warn('html-to-image fallback a html2canvas:', err);
        const { default: html2canvas } = await import('html2canvas');
        uiCanvas = await html2canvas(rootEl, {
          scale: SCALE,
          useCORS: true,
          allowTaint: false,
          backgroundColor: hasUnderlay ? null : bgColor,
          logging: false,
        });
      } finally {
        measuredLayers.forEach((l) => {
          l.node.style.visibility = '';
        });
        if (hasUnderlay && templateContainer) {
          templateContainer.style.background = prevContainerBg;
        }
      }

      // 5. Composición Híbrida en 3 Capas sobre el Canvas Final (100% compatible con iOS Safari y Chrome)
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = dims.width * SCALE;
      finalCanvas.height = dims.height * SCALE;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('No se pudo inicializar el canvas de composición.');

      // Capa 0: Color de fondo sólido base
      finalCtx.fillStyle = bgColor;
      finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Capa 1 (Underlay): Fotografías que van debajo de degradados y tarjetas (IG-A, IG-B, WA-A, WA-B, PDF-B)
      for (const item of measuredLayers) {
        if (item.layer !== 'underlay') continue;
        if (item.role === 'photo' && photoImgEl && item.w > 0 && item.h > 0) {
          drawCoverImageBox(
            finalCtx,
            photoImgEl,
            item.x * SCALE,
            item.y * SCALE,
            item.w * SCALE,
            item.h * SCALE,
            item.radius * SCALE,
            item.opacity
          );
        }
      }

      // Capa 2 (UI): Degradados, tarjetas glassmorphism, bordes, íconos Lucide SVG y textos Inter centrados
      finalCtx.drawImage(uiCanvas, 0, 0, finalCanvas.width, finalCanvas.height);

      // Capa 3 (Overlay): Logo corporativo en su píldora blanca, código QR y foto enmarcada de PDF-A
      for (const item of measuredLayers) {
        if (item.layer !== 'overlay' || item.w <= 0 || item.h <= 0) continue;
        if (item.role === 'photo' && photoImgEl) {
          drawCoverImageBox(
            finalCtx,
            photoImgEl,
            item.x * SCALE,
            item.y * SCALE,
            item.w * SCALE,
            item.h * SCALE,
            item.radius * SCALE,
            item.opacity
          );
        } else if (item.role === 'logo' && logoImgEl) {
          drawContainedImage(
            finalCtx,
            logoImgEl,
            item.x * SCALE,
            item.y * SCALE,
            item.w * SCALE,
            item.h * SCALE
          );
        } else if (item.role === 'qr' && qrImgEl) {
          drawContainedImage(
            finalCtx,
            qrImgEl,
            item.x * SCALE,
            item.y * SCALE,
            item.w * SCALE,
            item.h * SCALE
          );
        }
      }

      const canvas = finalCanvas;

      if (selectedFormat === 'pdf') {
        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        setGeneratedPreviewUrl(imgData);
        // Clean standard A4 portrait (210mm x 297mm — exact 794x1123 aspect ratio 1:1.4143)
        const { default: jsPDF } = await import('jspdf');
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
      const SLIDE_FRAMES = FPS * 3;              // 3.0s por imagen
      const FADE_FRAMES  = Math.floor(FPS * 0.55); // 0.55s de transición suave
      const OUTRO_FRAMES = Math.floor(FPS * 3.2);  // 3.2s para la tarjeta final de cierre

      // Asegurar que la fuente Inter esté lista en el motor Canvas 2D
      if (typeof document !== 'undefined' && document.fonts) {
        await Promise.allSettled([
          document.fonts.load('600 22px Inter'),
          document.fonts.load('700 24px Inter'),
          document.fonts.load('800 28px Inter'),
          document.fonts.load('900 52px Inter'),
        ]);
        await document.fonts.ready;
      }

      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el lienzo 2D.');

      // Función de carga con conversión a Base64 previa para evitar tainting en Canvas
      const loadImg = async (src: string, isPng = false): Promise<HTMLImageElement | null> => {
        if (!src) return null;
        const safeSrc = src.startsWith('data:') ? src : await urlToBase64(src, isPng ? 'image/png' : 'image/jpeg');
        return new Promise((res) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = safeSrc || src;
        });
      };

      // Carga paralela de logo corporativo, QR y todas las fotos de la propiedad
      const [logoImg, qrImg, ...loadedPhotos] = await Promise.all([
        loadImg(base64Logo || '/logo-riv.png', true),
        loadImg(base64Qr || qrUrl, true),
        ...allImages.map((u) => loadImg(u, false)),
      ]);

      const imgs = loadedPhotos.filter((img): img is HTMLImageElement => img !== null);
      if (imgs.length === 0) {
        showToast('No se pudieron cargar las fotos para generar el video.', 'error');
        return;
      }

      setVideoPhase('rendering');
      const photoFrames = imgs.length * SLIDE_FRAMES;
      const totalFrames = photoFrames + OUTRO_FRAMES;

      // Datos normalizados y simétricos
      const isRentalVideo = property.operacion === 'Alquiler' || property.status === 'Alquilada';
      const pTypeLabel = `${(property.propertyType || 'PROPIEDAD').toUpperCase()} ${isRentalVideo ? 'EN ALQUILER' : 'EN VENTA'}`;
      const priceLabel = property.status === 'Vendida'
        ? 'VENDIDO'
        : property.status === 'Alquilada'
        ? 'ALQUILADO'
        : `$${fmt(property.price)} ${isRentalVideo ? 'USD/MES' : 'USD'}`;
      const phoneLabel = advisorPhone || '0414-7901111';
      const advisorLabel = property.captador || 'RIV Margarita Premier';
      const locationLabel = (property.location || 'Isla de Margarita').toUpperCase();
      const specsForVideo = [
        { kind: 'bed' as const, value: `${property.beds > 0 ? property.beds : 1}`, label: 'HABITACIONES' },
        { kind: 'bath' as const, value: `${property.baths > 0 ? property.baths : 1}`, label: 'BAÑOS' },
        { kind: 'area' as const, value: property.sqm > 0 ? `${property.sqm} m²` : '— m²', label: 'ÁREA TOTAL' },
      ];

      // Detección de códec de video compatible (mp4 en Safari/iOS, webm en Chrome/Edge)
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

      const stream = canvas.captureStream(FPS);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 10_000_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

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

        // Dibuja una fotografía en modo 'cover' con Ken Burns alternado (zoom-in / zoom-out + paneo suave)
        const drawCoverSlide = (img: HTMLImageElement, slideIndex: number, progress01: number, alpha: number) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          const imgW = img.naturalWidth || WIDTH;
          const imgH = img.naturalHeight || HEIGHT;
          const baseScale = Math.max(WIDTH / imgW, HEIGHT / imgH);
          const ease = 0.5 - Math.cos(progress01 * Math.PI) / 2; // Ease-in-out sinusoidal
          const isEven = slideIndex % 2 === 0;
          const zoom = isEven ? 1.0 + ease * 0.065 : 1.065 - ease * 0.065;
          const panX = (isEven ? 1 : -1) * (ease - 0.5) * 18;
          const panY = (slideIndex % 3 === 0 ? -1 : 1) * (ease - 0.5) * 14;

          const drawW = imgW * baseScale * zoom;
          const drawH = imgH * baseScale * zoom;
          const drawX = (WIDTH - drawW) / 2 + panX;
          const drawY = (HEIGHT - drawH) / 2 + panY;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        };

        // Función que dibuja la escena de cierre (Outro) con soporte de opacidad para transición cruzada
        const drawOutroScene = (outroProgress01: number, sceneAlpha = 1) => {
          ctx.save();
          ctx.globalAlpha = sceneAlpha;

          // 1. Fondo Radial Vinotinto & Obsidiana de Lujo
          const outroGrad = ctx.createRadialGradient(
            WIDTH / 2,
            HEIGHT * 0.42,
            60,
            WIDTH / 2,
            HEIGHT * 0.5,
            HEIGHT * 0.72
          );
          outroGrad.addColorStop(0, '#6B001B');
          outroGrad.addColorStop(0.55, '#2D000B');
          outroGrad.addColorStop(1, '#080808');
          ctx.fillStyle = outroGrad;
          ctx.fillRect(0, 0, WIDTH, HEIGHT);

          // 2. Doble Marco Perimetral Dorado Simétrico
          drawRoundRect(ctx, 44, 44, WIDTH - 88, HEIGHT - 88, 40, undefined, 'rgba(212, 175, 55, 0.55)', 2.5);
          drawRoundRect(ctx, 60, 60, WIDTH - 120, HEIGHT - 120, 32, undefined, 'rgba(212, 175, 55, 0.2)', 1);

          // Animación suave de entrada vertical
          const entryEase = Math.min(1, outroProgress01 / 0.28);
          const slideUp = (1 - Math.pow(1 - entryEase, 3)) * 0; // Estabilizado al centro
          ctx.translate(0, slideUp);

          // 3. Píldora Blanca Superior con Logo Oficial (Sin deformación)
          const logoPillW = 420;
          const logoPillH = 128;
          const logoPillX = (WIDTH - logoPillW) / 2;
          const logoPillY = 160;
          drawRoundRect(ctx, logoPillX, logoPillY, logoPillW, logoPillH, 32, '#FFFFFF', '#D4AF37', 3);
          if (logoImg) {
            drawContainedImage(ctx, logoImg, logoPillX + 36, logoPillY + 18, logoPillW - 72, logoPillH - 36);
          } else {
            ctx.fillStyle = '#800020';
            ctx.font = `900 32px ${EXPORT_FONT}`;
            drawCenteredText(ctx, 'RIV MARGARITA PREMIER', WIDTH / 2, logoPillY + logoPillH / 2);
          }

          // 4. Píldora Dorada de Exclusividad
          ctx.font = `800 18px ${EXPORT_FONT}`;
          const tagStr = 'EXCLUSIVA OPORTUNIDAD INMOBILIARIA';
          const tagTextW = ctx.measureText(tagStr).width;
          const tagPillW = tagTextW + 104;
          const tagPillH = 50;
          const tagPillX = (WIDTH - tagPillW) / 2;
          const tagPillY = 340;
          drawRoundRect(ctx, tagPillX, tagPillY, tagPillW, tagPillH, 25, 'rgba(212, 175, 55, 0.16)', '#D4AF37', 1.5);
          drawCanvasStar(ctx, tagPillX + 28, tagPillY + tagPillH / 2, 9, '#D4AF37');
          drawCanvasStar(ctx, tagPillX + tagPillW - 28, tagPillY + tagPillH / 2, 9, '#D4AF37');
          ctx.fillStyle = '#D4AF37';
          drawCenteredText(ctx, tagStr, WIDTH / 2, tagPillY + tagPillH / 2);

          // 5. Título de la Propiedad Centrado (Hasta 2 líneas)
          const outroTitleSize = getAdaptiveTitleSize(property.title, 52, 36);
          ctx.font = `900 ${outroTitleSize}px ${EXPORT_FONT}`;
          ctx.fillStyle = '#FFFFFF';
          const titleBottomY = drawWrappedCenteredText(ctx, property.title, WIDTH / 2, 455, WIDTH - 180, outroTitleSize * 1.18, 2);

          // 6. Ubicación con Pin Vectorial Centrado
          const locY = titleBottomY + 34;
          ctx.font = `700 22px ${EXPORT_FONT}`;
          const shortLoc = locationLabel.length > 42 ? locationLabel.slice(0, 41) + '…' : locationLabel;
          const locW = ctx.measureText(shortLoc).width;
          const totalLocW = 24 + 10 + locW;
          const locStartX = (WIDTH - totalLocW) / 2;
          drawCanvasPin(ctx, locStartX + 12, locY, 22, '#D4AF37');
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          drawCenteredText(ctx, shortLoc, locStartX + 24 + 10 + locW / 2, locY);

          // 7. Banner Central de Precio de Inversión
          const priceBoxW = 720;
          const priceBoxH = 148;
          const priceBoxX = (WIDTH - priceBoxW) / 2;
          const priceBoxY = 640;
          drawRoundRect(ctx, priceBoxX, priceBoxY, priceBoxW, priceBoxH, 30, 'rgba(212, 175, 55, 0.14)', '#D4AF37', 2.5);
          ctx.font = `800 17px ${EXPORT_FONT}`;
          ctx.fillStyle = '#D4AF37';
          drawCenteredText(ctx, 'PRECIO DE INVERSIÓN', WIDTH / 2, priceBoxY + 40);
          ctx.font = `900 64px ${EXPORT_FONT}`;
          ctx.fillStyle = '#FFFFFF';
          drawCenteredText(ctx, priceLabel, WIDTH / 2, priceBoxY + 102);

          // 8. Grilla de 3 Especificaciones en el Outro
          const specGap = 20;
          const specTotalW = WIDTH - 180;
          const specCardW = (specTotalW - specGap * 2) / 3;
          const specCardH = 136;
          const specY = 835;
          specsForVideo.forEach((sp, i) => {
            const sx = 90 + i * (specCardW + specGap);
            drawRoundRect(ctx, sx, specY, specCardW, specCardH, 24, 'rgba(255, 255, 255, 0.06)', 'rgba(212, 175, 55, 0.4)', 1.5);
            const iconCx = sx + specCardW / 2;
            const iconCy = specY + 36;
            if (sp.kind === 'bed') drawCanvasBed(ctx, iconCx, iconCy, 30, '#D4AF37');
            if (sp.kind === 'bath') drawCanvasBath(ctx, iconCx, iconCy, 30, '#D4AF37');
            if (sp.kind === 'area') drawCanvasRuler(ctx, iconCx, iconCy, 28, '#D4AF37');

            ctx.font = `900 30px ${EXPORT_FONT}`;
            ctx.fillStyle = '#FFFFFF';
            drawCenteredText(ctx, sp.value, iconCx, specY + 80);

            ctx.font = `800 13px ${EXPORT_FONT}`;
            ctx.fillStyle = '#D4AF37';
            drawCenteredText(ctx, sp.label, iconCx, specY + 112);
          });

          // 9. Tarjeta Simétrica de Contacto del Asesor + QR
          const cardW = WIDTH - 180;
          const cardH = 380;
          const cardX = 90;
          const cardY = 1025;
          drawRoundRect(ctx, cardX, cardY, cardW, cardH, 32, 'rgba(14, 14, 14, 0.86)', '#D4AF37', 2);

          ctx.font = `800 16px ${EXPORT_FONT}`;
          ctx.fillStyle = '#D4AF37';
          drawCenteredText(ctx, 'ASESOR INMOBILIARIO EXCLUSIVO', WIDTH / 2, cardY + 52);

          ctx.font = `900 42px ${EXPORT_FONT}`;
          ctx.fillStyle = '#FFFFFF';
          drawCenteredText(ctx, advisorLabel, WIDTH / 2, cardY + 104);

          // Píldora Destacada de Teléfono Grande y Legible
          const phPillW = 460;
          const phPillH = 74;
          const phPillX = (WIDTH - phPillW) / 2;
          const phPillY = cardY + 148;
          drawRoundRect(ctx, phPillX, phPillY, phPillW, phPillH, 37, '#800020', '#D4AF37', 2);
          ctx.font = `900 34px ${EXPORT_FONT}`;
          const phTextW = ctx.measureText(phoneLabel).width;
          const phTotalW = 28 + 14 + phTextW;
          const phStartX = WIDTH / 2 - phTotalW / 2;
          drawCanvasPhone(ctx, phStartX + 14, phPillY + phPillH / 2, 28, '#D4AF37');
          ctx.fillStyle = '#FFFFFF';
          drawCenteredText(ctx, phoneLabel, phStartX + 28 + 14 + phTextW / 2, phPillY + phPillH / 2);

          // Llamado a la acción + QR opcional o Código
          if (qrImg) {
            const qrBoxSize = 96;
            const qrX = cardX + cardW - qrBoxSize - 36;
            const qrY = cardY + cardH - qrBoxSize - 28;
            drawRoundRect(ctx, qrX - 6, qrY - 6, qrBoxSize + 12, qrBoxSize + 12, 14, '#FFFFFF', '#D4AF37', 1.5);
            ctx.drawImage(qrImg, qrX, qrY, qrBoxSize, qrBoxSize);

            ctx.font = `700 22px ${EXPORT_FONT}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            drawCenteredText(ctx, 'Agenda tu visita privada hoy mismo', WIDTH / 2 - 44, cardY + 276);
            ctx.font = `700 16px ${EXPORT_FONT}`;
            ctx.fillStyle = '#D4AF37';
            drawCenteredText(
              ctx,
              `RIV MARGARITA PREMIER · RIF: J-11055496-2${property.codigo ? ` · CÓD: ${property.codigo}` : ''}`,
              WIDTH / 2 - 44,
              cardY + 318
            );
          } else {
            ctx.font = `700 22px ${EXPORT_FONT}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            drawCenteredText(ctx, 'Agenda tu visita privada hoy mismo', WIDTH / 2, cardY + 276);
            ctx.font = `700 16px ${EXPORT_FONT}`;
            ctx.fillStyle = '#D4AF37';
            drawCenteredText(
              ctx,
              `RIV MARGARITA PREMIER · RIF: J-11055496-2${property.codigo ? ` · CÓD: ${property.codigo}` : ''}`,
              WIDTH / 2,
              cardY + 322
            );
          }

          ctx.restore();
        };

        const drawFrame = () => {
          if (frame >= totalFrames) {
            recorder.stop();
            return;
          }

          // ── A. FASE 1: DIAPOSITIVAS DE FOTOS CON DISEÑO SIMÉTRICO 9:16 ─────
          if (frame < photoFrames) {
            const slideIdx = Math.floor(frame / SLIDE_FRAMES);
            const frameInSlide = frame % SLIDE_FRAMES;
            const slideProgress = frameInSlide / SLIDE_FRAMES;
            const currentImg = imgs[slideIdx];
            const isLastSlide = slideIdx === imgs.length - 1;
            const nextImg = imgs[(slideIdx + 1) % imgs.length];

            // Fondo base
            ctx.fillStyle = '#0A0A0A';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            // Dibujar foto actual con Ken Burns
            drawCoverSlide(currentImg, slideIdx, slideProgress, 1);

            // Crossfade hacia la siguiente foto (o hacia el Outro si es la última foto)
            if (frameInSlide >= SLIDE_FRAMES - FADE_FRAMES) {
              const fadeAlpha = (frameInSlide - (SLIDE_FRAMES - FADE_FRAMES)) / FADE_FRAMES;
              if (!isLastSlide) {
                drawCoverSlide(nextImg, slideIdx + 1, 0, fadeAlpha);
              }
            }

            // 1. Degradado Superior
            const topGrad = ctx.createLinearGradient(0, 0, 0, 340);
            topGrad.addColorStop(0, 'rgba(0,0,0,0.84)');
            topGrad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
            topGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, WIDTH, 340);

            // 2. Degradado Inferior Profundo
            const bottomGrad = ctx.createLinearGradient(0, HEIGHT - 1080, 0, HEIGHT);
            bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
            bottomGrad.addColorStop(0.25, 'rgba(10,10,10,0.45)');
            bottomGrad.addColorStop(0.6, 'rgba(10,10,10,0.9)');
            bottomGrad.addColorStop(1, 'rgba(5,5,5,0.98)');
            ctx.fillStyle = bottomGrad;
            ctx.fillRect(0, HEIGHT - 1080, WIDTH, 1080);

            // 3. Barras de Progreso Segmentadas Estilo Instagram Stories / Reels
            const segGap = 10;
            const segTotalW = WIDTH - 112;
            const segW = (segTotalW - segGap * (imgs.length - 1)) / imgs.length;
            const segY = 28;
            for (let i = 0; i < imgs.length; i++) {
              const sx = 56 + i * (segW + segGap);
              drawRoundRect(ctx, sx, segY, segW, 6, 3, 'rgba(255, 255, 255, 0.28)');
              const fillRatio = i < slideIdx ? 1 : i === slideIdx ? slideProgress : 0;
              if (fillRatio > 0) {
                drawRoundRect(ctx, sx, segY, Math.max(6, segW * fillRatio), 6, 3, '#D4AF37');
              }
            }

            // 4. Barra Superior Simétrica (Logo a la izquierda, Precio + Contador a la derecha)
            const headerY = 56;
            const logoBoxW = 236;
            const logoBoxH = 84;
            drawRoundRect(ctx, 56, headerY, logoBoxW, logoBoxH, 24, '#FFFFFF', '#D4AF37', 2);
            if (logoImg) {
              drawContainedImage(ctx, logoImg, 56 + 24, headerY + 12, logoBoxW - 48, logoBoxH - 24);
            } else {
              ctx.font = `900 22px ${EXPORT_FONT}`;
              ctx.fillStyle = '#800020';
              drawCenteredText(ctx, 'RIV PREMIER', 56 + logoBoxW / 2, headerY + logoBoxH / 2);
            }

            // Píldora de Precio Superior Derecha
            ctx.font = `900 40px ${EXPORT_FONT}`;
            const priceTextW = ctx.measureText(priceLabel).width;
            const priceBoxW = Math.max(300, priceTextW + 76);
            const priceBoxH = 84;
            const priceBoxX = WIDTH - 56 - priceBoxW;
            drawRoundRect(ctx, priceBoxX, headerY, priceBoxW, priceBoxH, 24, '#800020', '#D4AF37', 2);
            ctx.fillStyle = '#FFFFFF';
            drawCenteredText(ctx, priceLabel, priceBoxX + priceBoxW / 2, headerY + priceBoxH / 2);

            // Píldora Flotante de Contador de Fotos debajo del Precio
            const counterW = 148;
            const counterH = 42;
            const counterX = WIDTH - 56 - counterW;
            const counterY = headerY + priceBoxH + 14;
            drawRoundRect(ctx, counterX, counterY, counterW, counterH, 21, 'rgba(14, 14, 14, 0.82)', 'rgba(212, 175, 55, 0.5)', 1.5);
            ctx.font = `800 17px ${EXPORT_FONT}`;
            ctx.fillStyle = '#D4AF37';
            drawCenteredText(ctx, `FOTO ${slideIdx + 1} / ${imgs.length}`, counterX + counterW / 2, counterY + counterH / 2);

            // 5. Tarjeta Inferior Contenedora Simétrica (Idéntica en proporción a Instagram 9:16)
            const cardX = 56;
            const cardW = 968;
            const cardH = 520;
            const cardY = HEIGHT - 56 - cardH;
            drawRoundRect(ctx, cardX, cardY, cardW, cardH, 36, 'rgba(14, 14, 14, 0.92)', 'rgba(212, 175, 55, 0.45)', 1.8);

            // 5.1 Píldora Centrada de Tipo de Inmueble con Estrella Vectorial
            ctx.font = `800 16px ${EXPORT_FONT}`;
            const typeTextW = ctx.measureText(pTypeLabel).width;
            const typePillW = typeTextW + 68;
            const typePillH = 44;
            const typePillX = (WIDTH - typePillW) / 2;
            const typePillY = cardY + 32;
            drawRoundRect(ctx, typePillX, typePillY, typePillW, typePillH, 14, 'rgba(212, 175, 55, 0.18)', '#D4AF37', 1.5);
            const starX = typePillX + 24;
            const starY = typePillY + typePillH / 2;
            drawCanvasStar(ctx, starX, starY, 8, '#D4AF37');
            ctx.fillStyle = '#D4AF37';
            drawCenteredText(ctx, pTypeLabel, starX + 14 + typeTextW / 2, starY);

            // 5.2 Ubicación Centrada con Pin Vectorial
            const slideLocY = typePillY + typePillH + 26;
            ctx.font = `700 20px ${EXPORT_FONT}`;
            const shortSlideLoc = locationLabel.length > 44 ? locationLabel.slice(0, 43) + '…' : locationLabel;
            const slideLocW = ctx.measureText(shortSlideLoc).width;
            const slideLocTotalW = 20 + 8 + slideLocW;
            const slideLocStartX = (WIDTH - slideLocTotalW) / 2;
            drawCanvasPin(ctx, slideLocStartX + 10, slideLocY, 20, '#D4AF37');
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            drawCenteredText(ctx, shortSlideLoc, slideLocStartX + 20 + 8 + slideLocW / 2, slideLocY);

            // 5.3 Título de la Propiedad Centrado
            const slideTitleSize = getAdaptiveTitleSize(property.title, 44, 30);
            ctx.font = `900 ${slideTitleSize}px ${EXPORT_FONT}`;
            ctx.fillStyle = '#FFFFFF';
            drawWrappedCenteredText(ctx, property.title, WIDTH / 2, slideLocY + 46, cardW - 88, slideTitleSize * 1.15, 2);

            // 5.4 Grilla Simétrica de 3 Especificaciones con Íconos Vectoriales
            const sGap = 16;
            const sTotalW = cardW - 88;
            const sCardW = (sTotalW - sGap * 2) / 3;
            const sCardH = 128;
            const sCardY = cardY + 258;
            specsForVideo.forEach((sp, idx) => {
              const sx = cardX + 44 + idx * (sCardW + sGap);
              drawRoundRect(ctx, sx, sCardY, sCardW, sCardH, 22, 'rgba(255, 255, 255, 0.07)', 'rgba(212, 175, 55, 0.4)', 1.5);
              const icx = sx + sCardW / 2;
              const icy = sCardY + 34;
              if (sp.kind === 'bed') drawCanvasBed(ctx, icx, icy, 28, '#D4AF37');
              if (sp.kind === 'bath') drawCanvasBath(ctx, icx, icy, 28, '#D4AF37');
              if (sp.kind === 'area') drawCanvasRuler(ctx, icx, icy, 26, '#D4AF37');

              ctx.font = `900 28px ${EXPORT_FONT}`;
              ctx.fillStyle = '#FFFFFF';
              drawCenteredText(ctx, sp.value, icx, sCardY + 76);

              ctx.font = `800 12px ${EXPORT_FONT}`;
              ctx.fillStyle = '#D4AF37';
              drawCenteredText(ctx, sp.label, icx, sCardY + 106);
            });

            // 5.5 Footer Simétrico de 3 Columnas dentro de la Tarjeta
            const dividerY = cardY + cardH - 96;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cardX + 44, dividerY);
            ctx.lineTo(cardX + cardW - 44, dividerY);
            ctx.stroke();

            const footerCenterY = dividerY + 48;

            // Izquierda: Asesor
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.font = `800 12px ${EXPORT_FONT}`;
            ctx.fillStyle = '#D4AF37';
            ctx.fillText('ASESOR INMOBILIARIO', cardX + 44, footerCenterY - 10);
            ctx.font = `900 21px ${EXPORT_FONT}`;
            ctx.fillStyle = '#FFFFFF';
            const shortAdvisor = advisorLabel.length > 20 ? advisorLabel.slice(0, 19) + '…' : advisorLabel;
            ctx.fillText(shortAdvisor, cardX + 44, footerCenterY + 16);

            // Centro: Píldora de Teléfono
            const fPhoneW = 248;
            const fPhoneH = 48;
            const fPhoneX = WIDTH / 2 - fPhoneW / 2;
            const fPhoneY = footerCenterY - fPhoneH / 2;
            drawRoundRect(ctx, fPhoneX, fPhoneY, fPhoneW, fPhoneH, 24, '#800020', '#D4AF37', 1.5);
            ctx.font = `900 20px ${EXPORT_FONT}`;
            const fpTextW = ctx.measureText(phoneLabel).width;
            const fpTotalW = 18 + 8 + fpTextW;
            const fpStartX = WIDTH / 2 - fpTotalW / 2;
            drawCanvasPhone(ctx, fpStartX + 9, footerCenterY, 18, '#D4AF37');
            ctx.fillStyle = '#FFFFFF';
            drawCenteredText(ctx, phoneLabel, fpStartX + 18 + 8 + fpTextW / 2, footerCenterY);

            // Derecha: RIV + RIF + Código
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.font = `800 13px ${EXPORT_FONT}`;
            ctx.fillStyle = '#D4AF37';
            ctx.fillText('RIV MARGARITA PREMIER', cardX + cardW - 44, footerCenterY - 8);
            ctx.font = `600 12px ${EXPORT_FONT}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.fillText(
              `RIF: J-11055496-2${property.codigo ? ` · ${property.codigo}` : ''}`,
              cardX + cardW - 44,
              footerCenterY + 14
            );

            // Si estamos en los últimos cuadros de la última diapositiva, fundir suavemente hacia el Outro
            if (isLastSlide && frameInSlide >= SLIDE_FRAMES - FADE_FRAMES) {
              const outroFade = (frameInSlide - (SLIDE_FRAMES - FADE_FRAMES)) / FADE_FRAMES;
              drawOutroScene(0, outroFade);
            }
          } else {
            // ── B. FASE 2: TARJETA DE CIERRE (OUTRO CARD) ─────────────────────
            const outroProgress = (frame - photoFrames) / OUTRO_FRAMES;
            drawOutroScene(outroProgress, 1);
          }

          // Barra de progreso dorada general en el borde superior (6px)
          const totalProgressW = ((frame + 1) / totalFrames) * WIDTH;
          const barGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
          barGrad.addColorStop(0, '#800020');
          barGrad.addColorStop(0.5, '#D4AF37');
          barGrad.addColorStop(1, '#FFF2B2');
          ctx.fillStyle = barGrad;
          ctx.fillRect(0, 0, totalProgressW, 6);

          setVideoProgress(Math.round(((frame + 1) / totalFrames) * 100));
          frame++;
          requestAnimationFrame(drawFrame);
        };

        drawFrame();
      });

      setVideoPhase('done');
      setDone(true);
    } catch (e) {
      console.error(e);
      showToast('Error al generar el video. Tu navegador debe soportar MediaRecorder (Chrome/Edge/Safari).', 'error');
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
                      <BrandLogo size="sm" />
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

                  {/* ─── STEP 2: PLANTILLA (CON VISTA PREVIA REAL EN VIVO) ─── */}
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
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedTemplate(t)}
                              className={`relative p-3.5 rounded-2xl border-2 transition-all text-left ${
                                selectedTemplate === t
                                  ? 'border-vinotinto bg-vinotinto/5 shadow-md'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              {selectedTemplate === t && (
                                <div className="absolute top-2.5 right-2.5 z-10 w-5 h-5 bg-vinotinto rounded-full flex items-center justify-center shadow">
                                  <Check size={11} className="text-white" strokeWidth={3} />
                                </div>
                              )}
                              <LiveTemplatePreview
                                format={selectedFormat}
                                template={t}
                                property={property}
                                advisorPhone={advisorPhone}
                                base64Img={base64Img}
                                base64PdfImg={base64PdfImg}
                                base64IgImg={base64IgImg}
                                base64WaImg={base64WaImg}
                                base64Logo={base64Logo}
                                base64Qr={base64Qr || qrUrl}
                              />
                              <p className="text-sm font-bold text-gray-800 mt-3">{tData.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{tData.desc}</p>
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

                      {/* VISTA PREVIA REAL EN VIVO ANTES DE EXPORTAR */}
                      {selectedFormat !== 'video' && !done && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Eye size={13} className="text-vinotinto" />
                              Vista Previa Exacta (Plantilla {selectedTemplate})
                            </span>
                            <div className="flex gap-1">
                              {(['A', 'B'] as TemplateType[]).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setSelectedTemplate(t)}
                                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition ${
                                    selectedTemplate === t
                                      ? 'bg-vinotinto text-white shadow-sm'
                                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                  }`}
                                >
                                  Plantilla {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="max-w-[240px] mx-auto">
                            <LiveTemplatePreview
                              format={selectedFormat}
                              template={selectedTemplate}
                              property={property}
                              advisorPhone={advisorPhone}
                              base64Img={base64Img}
                              base64PdfImg={base64PdfImg}
                              base64IgImg={base64IgImg}
                              base64WaImg={base64WaImg}
                              base64Logo={base64Logo}
                              base64Qr={base64Qr || qrUrl}
                            />
                          </div>
                        </div>
                      )}

                      {/* VISTA PREVIA INTERACTIVA DEL SLIDESHOW 9:16 ANTES DE GENERAR */}
                      {selectedFormat === 'video' && !done && !isExporting && (
                        <LiveSlideshowPreview
                          images={allImages}
                          property={property}
                          advisorPhone={advisorPhone}
                          base64Logo={base64Logo}
                          base64Qr={base64Qr || qrUrl}
                        />
                      )}

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
                                className="max-h-64 rounded-xl object-contain shadow-md border border-gray-200 bg-white"
                              />
                            )}
                          </div>

                          {selectedFormat !== 'pdf' && (
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
                          )}
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
        ─── LIENZOS DE EXPORTACIÓN NATIVOS (PARA HTML-TO-IMAGE) ────────────────
        Renderizados únicamente cuando el modal está abierto (isOpen) para cero consumo de DOM en reposo.
      */}
      {isOpen && (
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          zIndex: -9999,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <div ref={pdfARef} style={{ width: '794px', height: '1123px' }}>
          <RenderExportTemplate
            format="pdf"
            template="A"
            property={property}
            advisorPhone={advisorPhone}
            base64Img={base64Img}
            base64PdfImg={base64PdfImg}
            base64IgImg={base64IgImg}
            base64WaImg={base64WaImg}
            base64Logo={base64Logo}
            base64Qr={base64Qr || qrUrl}
          />
        </div>
        <div ref={pdfBRef} style={{ width: '794px', height: '1123px' }}>
          <RenderExportTemplate
            format="pdf"
            template="B"
            property={property}
            advisorPhone={advisorPhone}
            base64Img={base64Img}
            base64PdfImg={base64PdfImg}
            base64IgImg={base64IgImg}
            base64WaImg={base64WaImg}
            base64Logo={base64Logo}
            base64Qr={base64Qr || qrUrl}
          />
        </div>
        <div ref={igARef} style={{ width: '1080px', height: '1920px' }}>
          <RenderExportTemplate
            format="instagram"
            template="A"
            property={property}
            advisorPhone={advisorPhone}
            base64Img={base64Img}
            base64PdfImg={base64PdfImg}
            base64IgImg={base64IgImg}
            base64WaImg={base64WaImg}
            base64Logo={base64Logo}
            base64Qr={base64Qr || qrUrl}
          />
        </div>
        <div ref={igBRef} style={{ width: '1080px', height: '1920px' }}>
          <RenderExportTemplate
            format="instagram"
            template="B"
            property={property}
            advisorPhone={advisorPhone}
            base64Img={base64Img}
            base64PdfImg={base64PdfImg}
            base64IgImg={base64IgImg}
            base64WaImg={base64WaImg}
            base64Logo={base64Logo}
            base64Qr={base64Qr || qrUrl}
          />
        </div>
        <div ref={waARef} style={{ width: '1080px', height: '1080px' }}>
          <RenderExportTemplate
            format="whatsapp"
            template="A"
            property={property}
            advisorPhone={advisorPhone}
            base64Img={base64Img}
            base64PdfImg={base64PdfImg}
            base64IgImg={base64IgImg}
            base64WaImg={base64WaImg}
            base64Logo={base64Logo}
            base64Qr={base64Qr || qrUrl}
          />
        </div>
        <div ref={waBRef} style={{ width: '1080px', height: '1080px' }}>
          <RenderExportTemplate
            format="whatsapp"
            template="B"
            property={property}
            advisorPhone={advisorPhone}
            base64Img={base64Img}
            base64PdfImg={base64PdfImg}
            base64IgImg={base64IgImg}
            base64WaImg={base64WaImg}
            base64Logo={base64Logo}
            base64Qr={base64Qr || qrUrl}
          />
        </div>
      </div>
      )}
    </>
  );
}

// ─── COMPONENTES COMPARTIDOS SIMÉTRICOS PARA LAS 6 PLANTILLAS ─────────────────
// Fuente fija Inter, íconos 100% Lucide SVG, compensación óptica de letterSpacing y cero offsets manuales.

interface SharedTemplateProps {
  format: Exclude<FormatType, 'video'>;
  template: TemplateType;
  property: Property;
  advisorPhone: string;
  base64Img: string;
  base64PdfImg: string;
  base64IgImg: string;
  base64WaImg: string;
  base64Logo: string;
  base64Qr: string;
}

/** Píldora del logo oficial siempre centrada y con ancho explícito 4:3 para evitar colapso en iOS */
function ExportLogoBadge({
  logoSrc,
  height,
  imgHeight,
  paddingX,
  borderRadius,
  borderColor = '#D4AF37',
}: {
  logoSrc: string;
  height: number;
  imgHeight: number;
  paddingX: number;
  borderRadius: number;
  borderColor?: string;
}) {
  const imgWidth = Math.round(imgHeight * 1.34);
  return (
    <div
      style={{
        height: `${height}px`,
        padding: `0 ${paddingX}px`,
        background: '#FFFFFF',
        border: `2px solid ${borderColor}`,
        borderRadius: `${borderRadius}px`,
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.38)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <img
        src={logoSrc}
        alt="RIV Margarita Premier"
        data-canvas-role="logo"
        data-canvas-layer="overlay"
        style={{
          height: `${imgHeight}px`,
          width: `${imgWidth}px`,
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
}

/** Píldora de Precio o Estado centrada matemáticamente */
function ExportPriceBadge({
  text,
  height,
  paddingX,
  fontSize,
  borderRadius,
  bg,
  color,
  borderColor,
}: {
  text: string;
  height: number;
  paddingX: number;
  fontSize: number;
  borderRadius: number;
  bg: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div
      style={{
        height: `${height}px`,
        padding: `0 ${paddingX}px`,
        background: bg,
        border: `2px solid ${borderColor}`,
        borderRadius: `${borderRadius}px`,
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.38)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: EXPORT_FONT,
          color,
          fontWeight: 900,
          fontSize: `${fontSize}px`,
          letterSpacing: '0.5px',
          paddingLeft: '0.5px',
          textTransform: 'uppercase',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** Píldora de Tipo de Propiedad con ícono Star SVG y compensación simétrica de letterSpacing */
function ExportTypePill({
  label,
  height,
  paddingX,
  fontSize,
  iconSize,
  bg,
  color,
  borderColor,
  borderRadius = 999,
}: {
  label: string;
  height: number;
  paddingX: number;
  fontSize: number;
  iconSize: number;
  bg: string;
  color: string;
  borderColor: string;
  borderRadius?: number;
}) {
  return (
    <div
      style={{
        height: `${height}px`,
        padding: `0 ${paddingX}px`,
        background: bg,
        color,
        border: `1.5px solid ${borderColor}`,
        borderRadius: `${borderRadius}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxSizing: 'border-box',
      }}
    >
      <Star size={iconSize} fill={color} color={color} strokeWidth={1.5} style={{ flexShrink: 0, display: 'block' }} />
      <span
        style={{
          fontFamily: EXPORT_FONT,
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          letterSpacing: '2px',
          paddingLeft: '2px',
          textTransform: 'uppercase',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Línea de Ubicación centrada con ícono MapPin SVG */
function ExportLocationRow({
  location,
  fontSize,
  iconSize,
  color,
  iconColor,
  uppercase = true,
}: {
  location: string;
  fontSize: number;
  iconSize: number;
  color: string;
  iconColor: string;
  uppercase?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <MapPin size={iconSize} color={iconColor} strokeWidth={2.4} style={{ flexShrink: 0, display: 'block' }} />
      <span
        style={{
          fontFamily: EXPORT_FONT,
          color,
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          letterSpacing: uppercase ? '1px' : '0.2px',
          paddingLeft: uppercase ? '1px' : '0',
          textTransform: uppercase ? 'uppercase' : 'none',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '92%',
        }}
      >
        {location}
      </span>
    </div>
  );
}

/** Grilla fija de 3 columnas iguales para Habitaciones, Baños y Área Total */
function ExportSpecsGrid({
  specs,
  cardHeight,
  borderRadius,
  iconSize,
  valueSize,
  labelSize,
  gap,
  bg,
  borderColor,
  iconColor,
  valueColor,
  labelColor,
}: {
  specs: Array<{ label: string; v: string | number; icon: any }>;
  cardHeight: number;
  borderRadius: number;
  iconSize: number;
  valueSize: number;
  labelSize: number;
  gap: number;
  bg: string;
  borderColor: string;
  iconColor: string;
  valueColor: string;
  labelColor: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${specs.length}, 1fr)`,
        gap: `${gap}px`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {specs.map((s) => {
        const SpecIcon = s.icon;
        return (
          <div
            key={s.label}
            style={{
              height: `${cardHeight}px`,
              background: bg,
              border: `1.5px solid ${borderColor}`,
              borderRadius: `${borderRadius}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 12px',
              boxSizing: 'border-box',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SpecIcon size={iconSize} color={iconColor} strokeWidth={2} style={{ display: 'block' }} />
            </div>
            <div
              style={{
                fontFamily: EXPORT_FONT,
                color: valueColor,
                fontSize: `${valueSize}px`,
                fontWeight: 900,
                lineHeight: 1,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {s.v}
            </div>
            <div
              style={{
                fontFamily: EXPORT_FONT,
                color: labelColor,
                fontSize: `${labelSize}px`,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                paddingLeft: '1px',
                lineHeight: 1,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Footer simétrico de tarjeta (Instagram & WhatsApp) con pesos visuales balanceados y teléfono grande legible */
function ExportSocialFooter({
  advisorName,
  advisorPhone,
  codigo,
  borderColor,
  roleColor,
  nameColor,
  phoneBg,
  phoneBorder,
  phoneTextColor,
  phoneIconColor,
  brandColor,
  rifColor,
  scale = 'lg',
}: {
  advisorName: string;
  advisorPhone: string;
  codigo?: string;
  borderColor: string;
  roleColor: string;
  nameColor: string;
  phoneBg: string;
  phoneBorder: string;
  phoneTextColor: string;
  phoneIconColor: string;
  brandColor: string;
  rifColor: string;
  scale?: 'lg' | 'md';
}) {
  const isLg = scale === 'lg';
  const phone = advisorPhone || '0414-7901111';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderTop: `1.5px solid ${borderColor}`,
        paddingTop: isLg ? '20px' : '14px',
        width: '100%',
        boxSizing: 'border-box',
        gap: '16px',
      }}
    >
      {/* Columna Izquierda: Asesor */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '4px', minWidth: 0 }}>
        <span
          style={{
            fontFamily: EXPORT_FONT,
            color: roleColor,
            fontSize: isLg ? '12px' : '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            lineHeight: 1,
          }}
        >
          ASESOR INMOBILIARIO
        </span>
        <span
          style={{
            fontFamily: EXPORT_FONT,
            color: nameColor,
            fontSize: isLg ? '22px' : '19px',
            fontWeight: 900,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {advisorName || 'RIV Margarita Premier'}
        </span>
      </div>

      {/* Columna Central: Píldora de Teléfono Grande y Legible (Eje de Simetría) */}
      <div
        style={{
          height: isLg ? '48px' : '42px',
          padding: isLg ? '0 22px' : '0 18px',
          background: phoneBg,
          border: `1.5px solid ${phoneBorder}`,
          borderRadius: '999px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxSizing: 'border-box',
        }}
      >
        <Smartphone size={isLg ? 20 : 18} color={phoneIconColor} strokeWidth={2.4} style={{ flexShrink: 0, display: 'block' }} />
        <span
          style={{
            fontFamily: EXPORT_FONT,
            color: phoneTextColor,
            fontSize: isLg ? '21px' : '18px',
            fontWeight: 900,
            letterSpacing: '0.5px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {phone}
        </span>
      </div>

      {/* Columna Derecha: Identidad Corporativa & Código */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', textAlign: 'right' }}>
        <span
          style={{
            fontFamily: EXPORT_FONT,
            color: brandColor,
            fontSize: isLg ? '14px' : '13px',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          RIV MARGARITA PREMIER
        </span>
        <span
          style={{
            fontFamily: EXPORT_FONT,
            color: rifColor,
            fontSize: isLg ? '12px' : '11px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            lineHeight: 1.15,
          }}
        >
          RIF: J-11055496-2{codigo ? ` · ${codigo}` : ''}
        </span>
      </div>
    </div>
  );
}

/** Renderizador Unificado de las 6 Plantillas (Usado tanto en la exportación como en la vista previa en vivo) */
function RenderExportTemplate({
  format,
  template,
  property,
  advisorPhone,
  base64Img,
  base64PdfImg,
  base64IgImg,
  base64WaImg,
  base64Logo,
  base64Qr,
}: SharedTemplateProps) {
  const validSpecs = getValidSpecs(property);
  const logoSrc = base64Logo || '/logo-riv.png';
  const isRental = property.operacion === 'Alquiler' || property.status === 'Alquilada';
  const typeLabel = property.propertyType
    ? `${property.propertyType.toUpperCase()} ${isRental ? 'EN ALQUILER' : 'EN VENTA'}`
    : isRental
    ? 'PROPIEDAD EN ALQUILER'
    : 'PROPIEDAD EN VENTA';
  const priceText = property.status === 'Vendida'
    ? 'VENDIDO'
    : property.status === 'Alquilada'
    ? 'ALQUILADO'
    : `$${fmt(property.price)} ${isRental ? 'USD/MES' : 'USD'}`;
  const phone = advisorPhone || '0414-7901111';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. FICHA COMERCIAL PDF (794 × 1123 px — Proporción A4 Exacta 1:1.414)
  // ═══════════════════════════════════════════════════════════════════════════
  if (format === 'pdf') {
    const safeDesc = getSafeDescription(property);
    const safeAmenities = getSafeAmenities(property);
    const pdfPhoto = base64PdfImg || base64Img || property.image;
    const pdfTitleSize = getAdaptiveTitleSize(property.title, 34, 24);

    if (template === 'A') {
      // ── PDF PLANTILLA A: CLÁSICA CORPORATIVA ──────────────────────────────
      return (
        <div
          style={{
            width: '794px',
            height: '1123px',
            background: '#FFFFFF',
            padding: '40px 48px',
            fontFamily: EXPORT_FONT,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* 1. Header Corporativo */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #800020',
              paddingBottom: '16px',
              flexShrink: 0,
            }}
          >
            <img
              src={logoSrc}
              alt="RIV Margarita Premier"
              data-canvas-role="logo"
              data-canvas-layer="overlay"
              style={{ height: '72px', width: '98px', objectFit: 'contain', display: 'block' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <div
                style={{
                  height: '32px',
                  padding: '0 20px',
                  background: '#800020',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    fontFamily: EXPORT_FONT,
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '2px',
                    paddingLeft: '2px',
                    lineHeight: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  FICHA TÉCNICA OFICIAL
                </span>
              </div>
              <span style={{ fontFamily: EXPORT_FONT, fontSize: '11px', color: '#6B7280', fontWeight: 600, lineHeight: 1 }}>
                RIF: J-11055496-2 · Isla de Margarita, Venezuela
              </span>
            </div>
          </div>

          {/* 2. Bloque Hero Centrado: Tipo, Título, Ubicación y Banner de Precio */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <ExportTypePill
              label={typeLabel}
              height={30}
              paddingX={18}
              fontSize={11}
              iconSize={13}
              bg="#FFF1F4"
              color="#800020"
              borderColor="#FECDD3"
            />
            <h1
              style={{
                fontFamily: EXPORT_FONT,
                fontSize: `${pdfTitleSize}px`,
                fontWeight: 900,
                color: '#111827',
                margin: 0,
                lineHeight: 1.15,
                textAlign: 'center',
                maxWidth: '100%',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {property.title}
            </h1>
            <ExportLocationRow
              location={property.location}
              fontSize={14}
              iconSize={16}
              color="#4B5563"
              iconColor="#800020"
              uppercase={false}
            />

            {/* Banner de Precio Centrado */}
            <div
              style={{
                height: '52px',
                padding: '0 32px',
                marginTop: '4px',
                background: 'linear-gradient(135deg, #800020 0%, #590016 100%)',
                borderRadius: '16px',
                boxShadow: '0 6px 18px rgba(128, 0, 32, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  paddingLeft: '2px',
                  textTransform: 'uppercase',
                  color: '#D4AF37',
                  lineHeight: 1,
                }}
              >
                PRECIO DE INVERSIÓN
              </span>
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  fontSize: '28px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  lineHeight: 1,
                }}
              >
                {priceText}
              </span>
              {property.codigo && (
                <div
                  style={{
                    height: '26px',
                    padding: '0 10px',
                    background: 'rgba(212, 175, 55, 0.22)',
                    border: '1px solid #D4AF37',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontFamily: EXPORT_FONT, color: '#D4AF37', fontSize: '11px', fontWeight: 800, lineHeight: 1 }}>
                    {property.codigo}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Fotografía Principal Proporcional */}
          <div style={{ width: '100%', height: '300px', borderRadius: '18px', overflow: 'hidden', flexShrink: 0, border: '1px solid #E5E7EB' }}>
            <img
              src={pdfPhoto}
              data-canvas-role="photo"
              data-canvas-layer="overlay"
              data-canvas-radius="18"
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            />
          </div>

          {/* 4. Grilla Simétrica de 3 Especificaciones */}
          <div style={{ flexShrink: 0 }}>
            <ExportSpecsGrid
              specs={validSpecs}
              cardHeight={96}
              borderRadius={16}
              iconSize={24}
              valueSize={24}
              labelSize={11}
              gap={14}
              bg="#F9FAFB"
              borderColor="#E5E7EB"
              iconColor="#800020"
              valueColor="#111827"
              labelColor="#6B7280"
            />
          </div>

          {/* 5. Descripción y Grilla de Comodidades 3×2 (Sin espacios vacíos) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexShrink: 0 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontFamily: EXPORT_FONT,
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#800020',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    paddingLeft: '2px',
                    lineHeight: 1,
                  }}
                >
                  DESCRIPCIÓN DE LA PROPIEDAD
                </span>
              </div>
              <div
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '14px',
                  padding: '14px 20px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: EXPORT_FONT,
                    color: '#374151',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {safeDesc}
                </p>
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontFamily: EXPORT_FONT,
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#800020',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    paddingLeft: '2px',
                    lineHeight: 1,
                  }}
                >
                  COMODIDADES Y ATRIBUTOS DESTACADOS
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {safeAmenities.map((a) => (
                  <div
                    key={a}
                    style={{
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#FFF1F4',
                      border: '1px solid #FECDD3',
                      borderRadius: '10px',
                      padding: '0 12px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#800020',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} color="#FFFFFF" strokeWidth={3} style={{ display: 'block' }} />
                    </div>
                    <span
                      style={{
                        fontFamily: EXPORT_FONT,
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#800020',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {a}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Footer Corporativo Simétrico con Asesor, Teléfono Grande y QR */}
          <div
            style={{
              borderTop: '2px solid #800020',
              background: '#F9FAFB',
              border: '1.5px solid #E5E7EB',
              borderRadius: '18px',
              padding: '16px 24px',
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: '16px',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  fontSize: '10px',
                  color: '#800020',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  lineHeight: 1,
                }}
              >
                ASESOR INMOBILIARIO EXCLUSIVO
              </span>
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  fontSize: '19px',
                  fontWeight: 900,
                  color: '#111827',
                  lineHeight: 1.15,
                }}
              >
                {property.captador || 'RIV Margarita Premier'}
              </span>
            </div>

            {/* Teléfono en píldora central destacada */}
            <div
              style={{
                height: '44px',
                padding: '0 20px',
                background: '#800020',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Smartphone size={18} color="#D4AF37" strokeWidth={2.4} style={{ display: 'block', flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '0.5px',
                  lineHeight: 1,
                }}
              >
                {phone}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', textAlign: 'right' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: EXPORT_FONT, fontSize: '9px', color: '#9CA3AF', fontWeight: 800, letterSpacing: '1px', lineHeight: 1 }}>
                  ESCANEA PARA MÁS INFO
                </span>
                <span style={{ fontFamily: EXPORT_FONT, fontSize: '12px', color: '#111827', fontWeight: 800, lineHeight: 1.1 }}>
                  Ficha en Línea
                </span>
                <span style={{ fontFamily: EXPORT_FONT, fontSize: '10px', color: '#6B7280', fontWeight: 700, lineHeight: 1 }}>
                  RIF: J-11055496-2
                </span>
              </div>
              <img
                src={base64Qr}
                alt="QR Ficha"
                data-canvas-role="qr"
                data-canvas-layer="overlay"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '10px',
                  border: '1px solid #D1D5DB',
                  padding: '3px',
                  background: '#FFFFFF',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    // ── PDF PLANTILLA B: LUJOSA GOLD EDITION ────────────────────────────────
    return (
      <div
        style={{
          width: '794px',
          height: '1123px',
          background: '#0F0F0F',
          fontFamily: EXPORT_FONT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* 1. Hero Superior con Foto y Membrete Dorado */}
        <div style={{ position: 'relative', height: '390px', flexShrink: 0, overflow: 'hidden' }}>
          <img
            src={pdfPhoto}
            data-canvas-role="photo"
            data-canvas-layer="underlay"
            data-canvas-opacity="0.72"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.72, display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(15,15,15,0.25) 40%, rgba(15,15,15,0.98) 100%)',
            }}
          />

          {/* Top Bar */}
          <div
            style={{
              position: 'absolute',
              top: 32,
              left: 48,
              right: 48,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <ExportLogoBadge logoSrc={logoSrc} height={60} imgHeight={44} paddingX={22} borderRadius={16} borderColor="#D4AF37" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <ExportTypePill
                label="PREMIUM COLLECTION"
                height={34}
                paddingX={16}
                fontSize={11}
                iconSize={13}
                bg="#D4AF37"
                color="#000000"
                borderColor="#FFFFFF"
              />
              <span style={{ fontFamily: EXPORT_FONT, fontSize: '10px', fontWeight: 800, color: '#D4AF37', letterSpacing: '1px', lineHeight: 1 }}>
                RIF: J-11055496-2 · ISLA DE MARGARITA
              </span>
            </div>
          </div>

          {/* Título y Ubicación Centrados sobre el Hero */}
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: 48,
              right: 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '8px',
            }}
          >
            <ExportTypePill
              label={typeLabel}
              height={30}
              paddingX={18}
              fontSize={11}
              iconSize={13}
              bg="rgba(212, 175, 55, 0.2)"
              color="#D4AF37"
              borderColor="#D4AF37"
            />
            <h1
              style={{
                fontFamily: EXPORT_FONT,
                fontSize: `${pdfTitleSize}px`,
                fontWeight: 900,
                color: '#FFFFFF',
                margin: 0,
                lineHeight: 1.15,
                textAlign: 'center',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {property.title}
            </h1>
            <ExportLocationRow
              location={property.location}
              fontSize={14}
              iconSize={16}
              color="rgba(255,255,255,0.85)"
              iconColor="#D4AF37"
              uppercase={false}
            />
          </div>
        </div>

        {/* 2. Cuerpo Central */}
        <div
          style={{
            padding: '20px 48px 24px',
            flex: 1,
            background: '#0F0F0F',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Banner de Precio Centrado */}
          <div
            style={{
              height: '58px',
              background: 'rgba(212, 175, 55, 0.12)',
              border: '1.5px solid #D4AF37',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '0 28px',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontFamily: EXPORT_FONT,
                color: '#D4AF37',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '2px',
                paddingLeft: '2px',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              PRECIO DE INVERSIÓN
            </span>
            <span style={{ fontFamily: EXPORT_FONT, color: '#FFFFFF', fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>
              {priceText}
            </span>
            {property.codigo && (
              <div
                style={{
                  height: '26px',
                  padding: '0 10px',
                  background: '#D4AF37',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: EXPORT_FONT, color: '#000000', fontSize: '11px', fontWeight: 900, lineHeight: 1 }}>
                  {property.codigo}
                </span>
              </div>
            )}
          </div>

          {/* Grilla de 3 Especificaciones */}
          <ExportSpecsGrid
            specs={validSpecs}
            cardHeight={96}
            borderRadius={16}
            iconSize={24}
            valueSize={24}
            labelSize={11}
            gap={14}
            bg="rgba(255, 255, 255, 0.05)"
            borderColor="rgba(212, 175, 55, 0.4)"
            iconColor="#D4AF37"
            valueColor="#FFFFFF"
            labelColor="#D4AF37"
          />

          {/* Descripción */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  color: '#D4AF37',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  paddingLeft: '2px',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                DESCRIPCIÓN DE LA PROPIEDAD
              </span>
            </div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '14px 20px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontFamily: EXPORT_FONT, color: '#D1D5DB', fontSize: '13px', lineHeight: 1.55, margin: 0 }}>
                {safeDesc}
              </p>
            </div>
          </div>

          {/* Comodidades 3×2 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <span
                style={{
                  fontFamily: EXPORT_FONT,
                  color: '#D4AF37',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  paddingLeft: '2px',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                COMODIDADES Y ATRIBUTOS DESTACADOS
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {safeAmenities.map((a) => (
                <div
                  key={a}
                  style={{
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(212, 175, 55, 0.08)',
                    border: '1px solid rgba(212, 175, 55, 0.35)',
                    borderRadius: '10px',
                    padding: '0 12px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#D4AF37',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={11} color="#000000" strokeWidth={3} style={{ display: 'block' }} />
                  </div>
                  <span
                    style={{
                      fontFamily: EXPORT_FONT,
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#D4AF37',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {a}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Footer Dorado Simétrico */}
        <div
          style={{
            background: '#D4AF37',
            padding: '18px 48px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '16px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span
              style={{
                fontFamily: EXPORT_FONT,
                fontSize: '10px',
                fontWeight: 800,
                color: 'rgba(0,0,0,0.65)',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              ASESOR INMOBILIARIO EXCLUSIVO
            </span>
            <span style={{ fontFamily: EXPORT_FONT, fontSize: '20px', fontWeight: 900, color: '#000000', lineHeight: 1.15 }}>
              {property.captador || 'RIV Margarita Premier'}
            </span>
          </div>

          <div
            style={{
              height: '44px',
              padding: '0 20px',
              background: '#0F0F0F',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Smartphone size={18} color="#D4AF37" strokeWidth={2.4} style={{ display: 'block', flexShrink: 0 }} />
            <span style={{ fontFamily: EXPORT_FONT, fontSize: '18px', fontWeight: 900, color: '#D4AF37', letterSpacing: '0.5px', lineHeight: 1 }}>
              {phone}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', textAlign: 'right' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontFamily: EXPORT_FONT, fontSize: '9px', color: 'rgba(0,0,0,0.65)', fontWeight: 800, letterSpacing: '1px', lineHeight: 1 }}>
                ESCANEA PARA MÁS INFO
              </span>
              <span style={{ fontFamily: EXPORT_FONT, fontSize: '12px', color: '#000000', fontWeight: 800, lineHeight: 1.1 }}>
                Ficha en Línea
              </span>
              <span style={{ fontFamily: EXPORT_FONT, fontSize: '10px', color: 'rgba(0,0,0,0.75)', fontWeight: 700, lineHeight: 1 }}>
                RIF: J-11055496-2
              </span>
            </div>
            <img
              src={base64Qr}
              alt="QR"
              data-canvas-role="qr"
              data-canvas-layer="overlay"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.3)',
                padding: '3px',
                background: '#FFFFFF',
                display: 'block',
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. HISTORIA INSTAGRAM 9:16 (1080 × 1920 px — Simetría Total)
  // ═══════════════════════════════════════════════════════════════════════════
  if (format === 'instagram') {
    const isGold = template === 'B';
    const igPhoto = base64IgImg || base64Img || property.image;
    const igTitleSize = getAdaptiveTitleSize(property.title, 46, 32);

    return (
      <div
        style={{
          position: 'relative',
          width: '1080px',
          height: '1920px',
          background: '#0A0A0A',
          fontFamily: EXPORT_FONT,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Foto Full-Bleed Pre-Recortada 9:16 */}
        <img
          src={igPhoto}
          data-canvas-role="photo"
          data-canvas-layer="underlay"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '1080px',
            height: '1920px',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />

        {/* Degradado Superior */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '340px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Degradado Inferior Profundo */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1080px',
            background: isGold
              ? 'linear-gradient(to top, rgba(16,4,8,0.98) 0%, rgba(22,6,11,0.9) 42%, rgba(10,5,8,0.45) 78%, transparent 100%)'
              : 'linear-gradient(to top, rgba(6,6,6,0.98) 0%, rgba(12,12,12,0.9) 42%, rgba(10,10,10,0.45) 78%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Barra Superior Simétrica (56px de margen a cada lado) */}
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 56,
            width: '968px',
            zIndex: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          <ExportLogoBadge
            logoSrc={logoSrc}
            height={84}
            imgHeight={60}
            paddingX={32}
            borderRadius={24}
            borderColor="#D4AF37"
          />
          <ExportPriceBadge
            text={priceText}
            height={84}
            paddingX={38}
            fontSize={42}
            borderRadius={24}
            bg={isGold ? '#D4AF37' : '#800020'}
            color={isGold ? '#000000' : '#FFFFFF'}
            borderColor={isGold ? '#FFFFFF' : '#D4AF37'}
          />
        </div>

        {/* Tarjeta Inferior Simétrica */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: 56,
            width: '968px',
            zIndex: 10,
            background: isGold ? 'rgba(26, 6, 12, 0.92)' : 'rgba(14, 14, 14, 0.92)',
            border: isGold ? '2px solid #D4AF37' : '1.5px solid rgba(212, 175, 55, 0.45)',
            borderRadius: '36px',
            padding: '36px 44px 32px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '22px',
            boxSizing: 'border-box',
          }}
        >
          {/* Stack Superior Centrado: Píldora Tipo + Ubicación + Título */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <ExportTypePill
              label={typeLabel}
              height={46}
              paddingX={26}
              fontSize={16}
              iconSize={18}
              bg={isGold ? '#D4AF37' : 'rgba(212, 175, 55, 0.18)'}
              color={isGold ? '#000000' : '#D4AF37'}
              borderColor="#D4AF37"
              borderRadius={14}
            />
            <ExportLocationRow
              location={property.location}
              fontSize={20}
              iconSize={22}
              color={isGold ? '#D4AF37' : 'rgba(255, 255, 255, 0.92)'}
              iconColor="#D4AF37"
              uppercase={true}
            />
            <h1
              style={{
                fontFamily: EXPORT_FONT,
                color: '#FFFFFF',
                fontSize: `${igTitleSize}px`,
                fontWeight: 900,
                margin: '2px 0 0',
                lineHeight: 1.15,
                textAlign: 'center',
                width: '100%',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {property.title}
            </h1>
          </div>

          {/* Grilla de 3 Especificaciones Iguales */}
          <ExportSpecsGrid
            specs={validSpecs}
            cardHeight={132}
            borderRadius={22}
            iconSize={32}
            valueSize={30}
            labelSize={13}
            gap={16}
            bg={isGold ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.07)'}
            borderColor={isGold ? '#D4AF37' : 'rgba(212, 175, 55, 0.4)'}
            iconColor="#D4AF37"
            valueColor="#FFFFFF"
            labelColor="#D4AF37"
          />

          {/* Footer Simétrico de 3 Columnas */}
          <ExportSocialFooter
            advisorName={property.captador || 'RIV Margarita Premier'}
            advisorPhone={phone}
            codigo={property.codigo}
            borderColor={isGold ? 'rgba(212, 175, 55, 0.3)' : 'rgba(255, 255, 255, 0.14)'}
            roleColor="#D4AF37"
            nameColor="#FFFFFF"
            phoneBg={isGold ? '#D4AF37' : '#800020'}
            phoneBorder="#D4AF37"
            phoneTextColor={isGold ? '#000000' : '#FFFFFF'}
            phoneIconColor={isGold ? '#000000' : '#D4AF37'}
            brandColor="#D4AF37"
            rifColor="rgba(255, 255, 255, 0.65)"
            scale="lg"
          />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. WHATSAPP MARKETING 1:1 (1080 × 1080 px — Simetría Total)
  // ═══════════════════════════════════════════════════════════════════════════
  const waPhoto = base64WaImg || base64Img || property.image;
  const waTitleSize = getAdaptiveTitleSize(property.title, 34, 24);

  if (template === 'A') {
    // ── WHATSAPP PLANTILLA A: CLEAN FULL PHOTO 1:1 ────────────────────────
    return (
      <div
        style={{
          position: 'relative',
          width: '1080px',
          height: '1080px',
          background: '#0A0A0A',
          fontFamily: EXPORT_FONT,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <img
          src={waPhoto}
          data-canvas-role="photo"
          data-canvas-layer="underlay"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '1080px',
            height: '1080px',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />

        {/* Degradado Superior */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '220px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Degradado Inferior */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '660px',
            background: 'linear-gradient(to top, rgba(5,5,5,0.98) 0%, rgba(10,10,10,0.88) 45%, rgba(10,10,10,0.35) 80%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Barra Superior Simétrica (40px de margen) */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            width: '1000px',
            zIndex: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          <ExportLogoBadge
            logoSrc={logoSrc}
            height={68}
            imgHeight={48}
            paddingX={26}
            borderRadius={20}
            borderColor="#D4AF37"
          />
          <ExportPriceBadge
            text={priceText}
            height={68}
            paddingX={30}
            fontSize={30}
            borderRadius={20}
            bg="#800020"
            color="#FFFFFF"
            borderColor="#D4AF37"
          />
        </div>

        {/* Tarjeta Inferior Contenedora Simétrica */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 40,
            width: '1000px',
            zIndex: 10,
            background: 'rgba(14, 14, 14, 0.93)',
            border: '1.5px solid rgba(212, 175, 55, 0.45)',
            borderRadius: '30px',
            padding: '26px 36px 22px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <ExportTypePill
              label={typeLabel}
              height={38}
              paddingX={22}
              fontSize={14}
              iconSize={15}
              bg="rgba(212, 175, 55, 0.18)"
              color="#D4AF37"
              borderColor="#D4AF37"
              borderRadius={12}
            />
            <ExportLocationRow
              location={property.location}
              fontSize={16}
              iconSize={18}
              color="rgba(255, 255, 255, 0.9)"
              iconColor="#D4AF37"
              uppercase={true}
            />
            <h2
              style={{
                fontFamily: EXPORT_FONT,
                color: '#FFFFFF',
                fontSize: `${waTitleSize}px`,
                fontWeight: 900,
                margin: '2px 0 0',
                lineHeight: 1.15,
                textAlign: 'center',
                width: '100%',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {property.title}
            </h2>
          </div>

          <ExportSpecsGrid
            specs={validSpecs}
            cardHeight={106}
            borderRadius={18}
            iconSize={26}
            valueSize={24}
            labelSize={11}
            gap={14}
            bg="rgba(255, 255, 255, 0.07)"
            borderColor="rgba(212, 175, 55, 0.4)"
            iconColor="#D4AF37"
            valueColor="#FFFFFF"
            labelColor="#D4AF37"
          />

          <ExportSocialFooter
            advisorName={property.captador || 'RIV Margarita Premier'}
            advisorPhone={phone}
            codigo={property.codigo}
            borderColor="rgba(255, 255, 255, 0.14)"
            roleColor="#D4AF37"
            nameColor="#FFFFFF"
            phoneBg="#800020"
            phoneBorder="#D4AF37"
            phoneTextColor="#FFFFFF"
            phoneIconColor="#D4AF37"
            brandColor="#D4AF37"
            rifColor="rgba(255, 255, 255, 0.65)"
            scale="md"
          />
        </div>
      </div>
    );
  }

  // ── WHATSAPP PLANTILLA B: CLEAN SPLIT 1:1 (LA CLARA EDITORIAL) ───────────
  return (
    <div
      style={{
        width: '1080px',
        height: '1080px',
        background: '#FFFFFF',
        fontFamily: EXPORT_FONT,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Mitad Superior: Fotografía 540px */}
      <div style={{ position: 'relative', height: '540px', flexShrink: 0, overflow: 'hidden' }}>
        <img
          src={waPhoto}
          data-canvas-role="photo"
          data-canvas-layer="underlay"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 45%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        {/* Barra Superior Sobre Foto */}
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 40,
            right: 40,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <ExportLogoBadge
            logoSrc={logoSrc}
            height={64}
            imgHeight={46}
            paddingX={24}
            borderRadius={18}
            borderColor="#800020"
          />
          <ExportTypePill
            label={typeLabel}
            height={48}
            paddingX={22}
            fontSize={14}
            iconSize={16}
            bg="#800020"
            color="#FFFFFF"
            borderColor="#D4AF37"
            borderRadius={16}
          />
        </div>
      </div>

      {/* Mitad Inferior: Panel Blanco Editorial Simétrico (540px) */}
      <div
        style={{
          flex: 1,
          padding: '26px 44px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
          boxSizing: 'border-box',
        }}
      >
        {/* Bloque Superior Centrado: Ubicación + Título + Píldora de Precio */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <ExportLocationRow
            location={property.location}
            fontSize={15}
            iconSize={17}
            color="#800020"
            iconColor="#800020"
            uppercase={true}
          />
          <h2
            style={{
              fontFamily: EXPORT_FONT,
              color: '#111827',
              fontSize: `${waTitleSize}px`,
              fontWeight: 900,
              lineHeight: 1.15,
              margin: 0,
              textAlign: 'center',
              width: '100%',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {property.title}
          </h2>
          <div
            style={{
              height: '52px',
              padding: '0 28px',
              marginTop: '2px',
              background: '#FFF1F4',
              border: '1.5px solid #FECDD3',
              borderRadius: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontFamily: EXPORT_FONT,
                fontSize: '32px',
                fontWeight: 900,
                color: '#800020',
                lineHeight: 1,
              }}
            >
              {priceText}
            </span>
          </div>
        </div>

        {/* Grilla de 3 Especificaciones */}
        <ExportSpecsGrid
          specs={validSpecs}
          cardHeight={104}
          borderRadius={18}
          iconSize={26}
          valueSize={23}
          labelSize={11}
          gap={14}
          bg="#F8FAFC"
          borderColor="#E2E8F0"
          iconColor="#800020"
          valueColor="#0F172A"
          labelColor="#800020"
        />

        {/* Footer Simétrico de 3 Columnas */}
        <ExportSocialFooter
          advisorName={property.captador || 'RIV Margarita Premier'}
          advisorPhone={phone}
          codigo={property.codigo}
          borderColor="#E2E8F0"
          roleColor="#800020"
          nameColor="#111827"
          phoneBg="#800020"
          phoneBorder="#800020"
          phoneTextColor="#FFFFFF"
          phoneIconColor="#D4AF37"
          brandColor="#111827"
          rifColor="#64748B"
          scale="md"
        />
      </div>
    </div>
  );
}

// ─── VISTA PREVIA REAL EN VIVO ESCALADA (WYSIWYG) ─────────────────────────────
function LiveTemplatePreview(props: SharedTemplateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.18);

  const dims =
    props.format === 'pdf'
      ? { w: 794, h: 1123 }
      : props.format === 'instagram'
        ? { w: 1080, h: 1920 }
        : { w: 1080, h: 1080 };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / dims.w);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.w]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        aspectRatio: `${dims.w} / ${dims.h}`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        background: '#0F0F0F',
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          width: `${dims.w}px`,
          height: `${dims.h}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <RenderExportTemplate {...props} />
      </div>
    </div>
  );
}

// ─── VISTA PREVIA INTERACTIVA DEL VIDEO SLIDESHOW 9:16 ────────────────────────
function LiveSlideshowPreview({
  images,
  property,
  advisorPhone,
  base64Logo,
  base64Qr,
}: {
  images: string[];
  property: Property;
  advisorPhone: string;
  base64Logo: string;
  base64Qr: string;
}) {
  // Índice: 0..(images.length - 1) para fotos, images.length para la tarjeta de cierre (Outro)
  const totalSlides = images.length + 1;
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % totalSlides);
    }, 2600);
    return () => clearInterval(timer);
  }, [totalSlides]);

  const isOutro = activeIdx === images.length;
  const currentImg = images[Math.min(activeIdx, Math.max(0, images.length - 1))] || property.image;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / 1080);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const validSpecs = getValidSpecs(property);
  const logoSrc = base64Logo || '/logo-riv.png';
  const isRental = property.operacion === 'Alquiler' || property.status === 'Alquilada';
  const typeLabel = property.propertyType
    ? `${property.propertyType.toUpperCase()} ${isRental ? 'EN ALQUILER' : 'EN VENTA'}`
    : isRental
    ? 'PROPIEDAD EN ALQUILER'
    : 'PROPIEDAD EN VENTA';
  const priceText = property.status === 'Vendida'
    ? 'VENDIDO'
    : property.status === 'Alquilada'
    ? 'ALQUILADO'
    : `$${fmt(property.price)} ${isRental ? 'USD/MES' : 'USD'}`;
  const phone = advisorPhone || '0414-7901111';

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Eye size={13} className="text-violet-600" />
          Vista Previa Animada ({isOutro ? 'Cierre Corporativo' : `Foto ${activeIdx + 1} de ${images.length}`})
        </span>
        <div className="flex items-center gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`h-2 rounded-full transition-all ${
                activeIdx === i ? 'w-5 bg-vinotinto' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              title={`Foto ${i + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={() => setActiveIdx(images.length)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
              isOutro
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            Outro
          </button>
        </div>
      </div>

      <div className="max-w-[220px] mx-auto">
        <div
          ref={containerRef}
          style={{
            width: '100%',
            aspectRatio: '1080 / 1920',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '14px',
            background: '#0A0A0A',
            border: '1px solid #E5E7EB',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              width: '1080px',
              height: '1920px',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
              userSelect: 'none',
              fontFamily: EXPORT_FONT,
            }}
          >
            {!isOutro ? (
              <RenderExportTemplate
                format="instagram"
                template="A"
                property={{ ...property, image: currentImg }}
                advisorPhone={phone}
                base64Img={currentImg}
                base64PdfImg=""
                base64IgImg={currentImg}
                base64WaImg=""
                base64Logo={logoSrc}
                base64Qr={base64Qr}
              />
            ) : (
              /* Vista Previa de la Tarjeta de Cierre (Outro) */
              <div
                style={{
                  width: '1080px',
                  height: '1920px',
                  background: 'radial-gradient(circle at 50% 42%, #6B001B 0%, #2D000B 55%, #080808 100%)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '150px 90px 140px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '44px',
                    borderRadius: '40px',
                    border: '2.5px solid rgba(212, 175, 55, 0.55)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: '60px',
                    borderRadius: '32px',
                    border: '1px solid rgba(212, 175, 55, 0.2)',
                    pointerEvents: 'none',
                  }}
                />

                <ExportLogoBadge
                  logoSrc={logoSrc}
                  height={128}
                  imgHeight={90}
                  paddingX={44}
                  borderRadius={32}
                  borderColor="#D4AF37"
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%', textAlign: 'center' }}>
                  <ExportTypePill
                    label="EXCLUSIVA OPORTUNIDAD INMOBILIARIA"
                    height={50}
                    paddingX={28}
                    fontSize={17}
                    iconSize={18}
                    bg="rgba(212, 175, 55, 0.16)"
                    color="#D4AF37"
                    borderColor="#D4AF37"
                  />
                  <h2 style={{ color: '#FFFFFF', fontSize: '48px', fontWeight: 900, margin: 0, lineHeight: 1.15, textAlign: 'center' }}>
                    {property.title}
                  </h2>
                  <ExportLocationRow
                    location={property.location}
                    fontSize={22}
                    iconSize={22}
                    color="rgba(255,255,255,0.88)"
                    iconColor="#D4AF37"
                    uppercase={true}
                  />
                </div>

                <div
                  style={{
                    width: '720px',
                    height: '148px',
                    background: 'rgba(212, 175, 55, 0.14)',
                    border: '2.5px solid #D4AF37',
                    borderRadius: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ color: '#D4AF37', fontSize: '17px', fontWeight: 800, letterSpacing: '2px', paddingLeft: '2px' }}>
                    PRECIO DE INVERSIÓN
                  </span>
                  <span style={{ color: '#FFFFFF', fontSize: '60px', fontWeight: 900, lineHeight: 1 }}>
                    {priceText}
                  </span>
                </div>

                <ExportSpecsGrid
                  specs={validSpecs}
                  cardHeight={132}
                  borderRadius={24}
                  iconSize={30}
                  valueSize={30}
                  labelSize={13}
                  gap={20}
                  bg="rgba(255, 255, 255, 0.06)"
                  borderColor="rgba(212, 175, 55, 0.4)"
                  iconColor="#D4AF37"
                  valueColor="#FFFFFF"
                  labelColor="#D4AF37"
                />

                <div
                  style={{
                    width: '100%',
                    background: 'rgba(14, 14, 14, 0.86)',
                    border: '2px solid #D4AF37',
                    borderRadius: '32px',
                    padding: '32px 36px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ color: '#D4AF37', fontSize: '16px', fontWeight: 800, letterSpacing: '2px', paddingLeft: '2px' }}>
                    ASESOR INMOBILIARIO EXCLUSIVO
                  </span>
                  <span style={{ color: '#FFFFFF', fontSize: '40px', fontWeight: 900, lineHeight: 1.1 }}>
                    {property.captador || 'RIV Margarita Premier'}
                  </span>
                  <div
                    style={{
                      height: '70px',
                      padding: '0 36px',
                      background: '#800020',
                      border: '2px solid #D4AF37',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                    }}
                  >
                    <Smartphone size={28} color="#D4AF37" strokeWidth={2.4} />
                    <span style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{phone}</span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '20px', fontWeight: 600 }}>
                    Agenda tu visita privada hoy mismo
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Canvas 2D Helpers (Centrado Óptico Real e Íconos Vectoriales) ─────────────
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

/** Centra un texto horizontal y verticalmente usando el bounding-box real de los glifos */
function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent ?? 0;
  if (typeof ascent === 'number' && ascent > 0) {
    const opticalY = centerY + (ascent - descent) / 2;
    ctx.fillText(text, centerX, opticalY);
  } else {
    ctx.textBaseline = 'middle';
    ctx.fillText(text, centerX, centerY);
  }
  ctx.restore();
}

/** Parte un título largo en hasta `maxLines` líneas centradas y devuelve el Y inferior */
function drawWrappedCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  firstLineCenterY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
): number {
  const words = (text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);

  const finalLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = finalLines[maxLines - 1];
    while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trim();
    }
    finalLines[maxLines - 1] = `${last}…`;
  }

  const totalH = (finalLines.length - 1) * lineHeight;
  const startY = finalLines.length === 1 ? firstLineCenterY : firstLineCenterY - totalH / 2 + 8;
  finalLines.forEach((line, i) => {
    drawCenteredText(ctx, line, centerX, startY + i * lineHeight);
  });
  return startY + (finalLines.length - 1) * lineHeight;
}

/** Dibuja una imagen preservando su proporción ('contain') y centrada dentro de una caja */
function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  const iw = img.naturalWidth || img.width || boxW;
  const ih = img.naturalHeight || img.height || boxH;
  const scale = Math.min(boxW / iw, boxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Estrella vectorial de 5 puntas centrada en (cx, cy) */
function drawCanvasStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const innerR = outerR * 0.45;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Pin de ubicación vectorial centrado en (cx, cy) */
function drawCanvasPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  const r = size * 0.36;
  const topCy = cy - size * 0.12;
  ctx.beginPath();
  ctx.arc(cx, topCy, r, Math.PI * 0.85, Math.PI * 0.15, false);
  ctx.lineTo(cx, cy + size * 0.46);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, topCy, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ícono vectorial de Cama (Habitaciones) centrado en (cx, cy) */
function drawCanvasBed(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = size;
  const h = size * 0.72;
  const left = cx - w / 2;
  const top = cy - h / 2;
  // Cabecera y pie
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + h);
  ctx.moveTo(left + w, top + h * 0.35);
  ctx.lineTo(left + w, top + h);
  // Colchón horizontal
  ctx.moveTo(left, top + h * 0.62);
  ctx.lineTo(left + w, top + h * 0.62);
  // Almohada / domo superior
  ctx.moveTo(left + w * 0.14, top + h * 0.62);
  ctx.lineTo(left + w * 0.14, top + h * 0.3);
  ctx.lineTo(left + w * 0.88, top + h * 0.3);
  ctx.lineTo(left + w * 0.88, top + h * 0.62);
  ctx.stroke();
  ctx.restore();
}

/** Ícono vectorial de Baño / Ducha centrado en (cx, cy) */
function drawCanvasBath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = size;
  const h = size * 0.78;
  const left = cx - w / 2;
  const top = cy - h / 2;
  // Tina
  ctx.beginPath();
  ctx.moveTo(left, cy);
  ctx.lineTo(left + w, cy);
  ctx.lineTo(left + w * 0.9, top + h);
  ctx.lineTo(left + w * 0.1, top + h);
  ctx.closePath();
  // Grifo superior
  ctx.moveTo(left + w * 0.18, cy);
  ctx.lineTo(left + w * 0.18, top + h * 0.15);
  ctx.quadraticCurveTo(left + w * 0.18, top, left + w * 0.36, top);
  ctx.lineTo(left + w * 0.46, top);
  ctx.stroke();
  ctx.restore();
}

/** Ícono vectorial de Regla / Área centrado en (cx, cy) */
function drawCanvasRuler(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const r = size / 2;
  ctx.strokeRect(cx - r, cy - r * 0.65, size, size * 0.65);
  // Marcas de graduación
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const mx = cx - r + (size / 4) * i;
    ctx.moveTo(mx, cy - r * 0.65);
    ctx.lineTo(mx, cy - r * 0.2);
  }
  ctx.stroke();
  ctx.restore();
}

/** Ícono vectorial de Smartphone centrado en (cx, cy) */
function drawCanvasPhone(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  const w = size * 0.64;
  const h = size;
  drawRoundRect(ctx, cx - w / 2, cy - h / 2, w, h, 4, undefined, color, 2.4);
  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.3, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

