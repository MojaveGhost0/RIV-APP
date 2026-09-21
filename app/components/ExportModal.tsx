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
    description: 'Formato vertical Reels/Stories con Glassmorphism',
    icon: Instagram,
    color: 'from-pink-500 via-purple-500 to-yellow-400',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-600',
    templateA: { name: 'Oscura Glass', desc: 'Full bleed 9:16 · Card flotante · CTA' },
    templateB: { name: 'Gold Premier', desc: 'Full bleed 9:16 · Luxury Frosted · CTA' },
  },
  whatsapp: {
    label: 'WhatsApp Marketing',
    description: 'Copy enriquecido + Imagen 1:1 y envío directo',
    icon: MessageCircle,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-600',
    templateA: { name: 'Full Foto', desc: 'Foto fondo · Overlay vinotinto' },
    templateB: { name: 'Panel Premium', desc: 'Foto + Tarjetas de datos' },
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
  const [step, setStep] = useState<Step>('format');
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('A');
  const [isExporting, setIsExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoPhase, setVideoPhase] = useState<'loading' | 'rendering' | 'done'>('loading');
  const [done, setDone] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [base64Img, setBase64Img] = useState<string>('');

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
    setStep('format');
    setSelectedFormat(null);
    setSelectedTemplate('A');
    setDone(false);
    setCopiedText(false);
    onClose();
  };

  const handleSelectFormat = (format: FormatType) => {
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
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      alert('Texto copiado al portapapeles');
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
        pdf.save(`${property.title.replace(/\s+/g, '_')}_Ficha_RIV.pdf`);
      } else {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        const suffix = selectedFormat === 'instagram' ? 'Historia_IG' : 'WhatsApp';
        link.download = `${property.title.replace(/\s+/g, '_')}_${suffix}_Plantilla_${selectedTemplate}.png`;
        link.click();
      }
      setDone(true);
    } catch (e) {
      console.error('Error al exportar plantilla:', e);
      alert('Error al exportar la plantilla. Por favor intenta de nuevo.');
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
        alert('No se pudieron cargar las fotos para generar el video.');
        return;
      }

      setVideoPhase('rendering');
      const photoFrames = imgs.length * SLIDE_FRAMES;
      const totalFrames = photoFrames + OUTRO_FRAMES;

      // Configurar grabación multimedia
      const stream = canvas.captureStream(FPS);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 8_000_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${property.title.replace(/\s+/g, '_')}_Reel_RIV.webm`;
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
      alert('Error al generar el video. Tu navegador debe soportar MediaRecorder (Chrome/Edge).');
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
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
              style={{ maxHeight: '94dvh', overflowY: 'auto' }}
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
                        className="w-full py-4 bg-gradient-to-r from-vinotinto to-[#a60029] text-white rounded-2xl font-bold shadow-lg shadow-vinotinto/25 flex items-center justify-center gap-2 mt-2"
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
                            <p className="text-xs text-green-600 mt-0.5">El archivo fue descargado a tu dispositivo</p>
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
                        {isExporting ? (
                          <><Loader2 size={18} className="animate-spin" /> Procesando…</>
                        ) : done ? (
                          <><Check size={18} /> Descargar de nuevo</>
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

        {/* ── Instagram – Plantilla A: Oscura Glass 9:16 (Full Bleed) ─────── */}
        <div 
          ref={igARef} 
          style={{ 
            position: 'relative', 
            width: '1080px', 
            height: '1920px', 
            background: '#0a0a0c', 
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* FOTO DE FONDO FULL BLEED (9:16) */}
          <img 
            src={base64Img || property.image} 
            crossOrigin="anonymous" 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }} 
            alt="" 
          />

          {/* OVERLAY DE DEGRADADO NEGRO SUTIL DESDE LA BASE (rgba(0,0,0,0.8)) */}
          <div 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.80) 36%, rgba(0,0,0,0.28) 65%, rgba(0,0,0,0.60) 100%)',
              pointerEvents: 'none'
            }} 
          />
          
          {/* HEADER TRANSPARENTE: [ RIV MARGARITA PREMIER ]   [ EN VENTA ] */}
          <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ 
              background: 'rgba(12, 12, 16, 0.68)', 
              backdropFilter: 'blur(20px)', 
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(212, 175, 55, 0.45)', 
              padding: '12px 28px', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)'
            }}>
              <img src="/logo-riv.svg" style={{ minWidth: '120px', height: 'auto', maxHeight: '36px', objectFit: 'contain' }} alt="RIV Margarita Premier" crossOrigin="anonymous" />
            </div>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(128,0,32,0.95) 0%, rgba(85,0,21,0.95) 100%)', 
              border: '1.5px solid rgba(255,255,255,0.25)', 
              padding: '14px 30px', 
              borderRadius: '999px',
              boxShadow: '0 8px 24px rgba(128,0,32,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#D4AF37', fontSize: '20px' }}>✦</span>
              <span style={{ color: '#FFFFFF', fontWeight: 900, fontSize: '22px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {property.status === 'Vendida' ? 'VENDIDO' : 'EN VENTA'}
              </span>
            </div>
          </div>

          {/* TARJETA DE INFORMACIÓN FLOTANTE (GLASSMORPHISM) */}
          <div style={{ 
            position: 'absolute', 
            bottom: 60, 
            left: 24, 
            right: 24, 
            zIndex: 10,
            background: 'rgba(16, 18, 27, 0.76)', 
            backdropFilter: 'blur(30px)', 
            WebkitBackdropFilter: 'blur(30px)',
            border: '1.5px solid rgba(255, 255, 255, 0.18)', 
            borderRadius: '38px', 
            padding: '40px 42px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Tag de Categoría */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ 
                background: 'rgba(212, 175, 55, 0.18)', 
                color: '#D4AF37', 
                border: '1px solid rgba(212, 175, 55, 0.4)', 
                borderRadius: '999px', 
                padding: '6px 20px', 
                fontSize: '18px', 
                fontWeight: 800, 
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>
                {property.propertyType || (isLand ? 'Terreno' : 'Inmueble')}
              </div>
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                color: '#FFFFFF', 
                borderRadius: '999px', 
                padding: '6px 18px', 
                fontSize: '16px', 
                fontWeight: 700 
              }}>
                Exclusiva RIV
              </div>
            </div>

            {/* Título (Máximo 2 líneas) */}
            <h1 style={{ 
              fontSize: '50px', 
              fontWeight: 900, 
              color: '#FFFFFF', 
              margin: '0 0 10px 0', 
              lineHeight: 1.25, 
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {property.title}
            </h1>

            {/* Ubicación */}
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.85)', 
              fontSize: '26px', 
              fontWeight: 600, 
              margin: '0 0 22px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <MapPin size={28} color="#FFFFFF" /> {property.location}
            </p>

            {/* Precio */}
            <div style={{ marginBottom: '22px' }}>
              <p style={{ color: '#D4AF37', fontSize: '15px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                PRECIO DE INVERSIÓN
              </p>
              <p style={{ fontSize: '76px', fontWeight: 900, color: '#FFFFFF', margin: '2px 0 0 0', lineHeight: 1 }}>
                ${fmt(property.price)} <span style={{ fontSize: '32px', color: '#D4AF37', fontWeight: 700 }}>USD</span>
              </p>
            </div>

            {/* ATRIBUTOS DINÁMICOS: TERRENO O REGULAR */}
            {isLand ? (
              /* En Terreno / Parcela: NO muestra Habs ni Baños. Muestra solo Superficie en contenedor destacado central */
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(128, 0, 32, 0.22) 100%)', 
                border: '1.5px solid rgba(212, 175, 55, 0.5)', 
                borderRadius: '24px', 
                padding: '22px 28px', 
                textAlign: 'center', 
                marginBottom: '22px',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15)'
              }}>
                <p style={{ color: '#D4AF37', fontSize: '16px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
                  SUPERFICIE TOTAL DEL TERRENO
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#FFFFFF', margin: 0, fontSize: '48px', fontWeight: 900 }}>
                  <Ruler size={44} color="#FFFFFF" /> {property.sqm > 0 ? `${fmt(property.sqm)} m²` : 'Consultar'}
                </div>
              </div>
            ) : (
              /* Bloques para inmuebles normales */
              <div style={{ display: 'flex', gap: '16px', marginBottom: '22px' }}>
                {validSpecs.map(s => {
                  const Icon = s.icon;
                  return (
                  <div key={s.label} style={{ 
                    flex: 1, 
                    background: 'rgba(255, 255, 255, 0.08)', 
                    border: '1px solid rgba(255, 255, 255, 0.15)', 
                    borderRadius: '22px', 
                    padding: '18px 12px', 
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    <Icon size={32} color="#FFFFFF" style={{ marginBottom: '8px' }} />
                    <p style={{ color: '#FFFFFF', fontSize: '36px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '17px', margin: '4px 0 0 0', fontWeight: 600 }}>{s.label}</p>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Asesor */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '18px', 
              paddingTop: '20px', 
              borderTop: '1px solid rgba(255, 255, 255, 0.12)' 
            }}>
              <div style={{ 
                width: '62px', 
                height: '62px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #800020 0%, #D4AF37 100%)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#FFFFFF', 
                fontSize: '28px', 
                fontWeight: 900, 
                flexShrink: 0,
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
              }}>
                {property.captador ? property.captador.charAt(0).toUpperCase() : 'R'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '15px', fontWeight: 700, margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Asesor Comercial
                </p>
                <p style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: 900, margin: '2px 0 0 0' }}>
                  {property.captador || 'RIV Margarita Premier'}
                </p>
              </div>
              {advisorPhone && (
                <div style={{ 
                  background: 'rgba(37, 211, 102, 0.18)', 
                  border: '1px solid rgba(37, 211, 102, 0.45)', 
                  borderRadius: '18px', 
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Smartphone size={22} color="#25D366" />
                  <span style={{ color: '#25D366', fontSize: '19px', fontWeight: 800 }}>{advisorPhone}</span>
                </div>
              )}
            </div>

            {/* BOTÓN / INSIGNIA DE LLAMADO A LA ACCIÓN (CTA) - INTEGRADO */}
            <div style={{ 
              marginTop: '20px',
              background: 'linear-gradient(90deg, #25D366 0%, #128C7E 100%)', 
              color: '#FFFFFF', 
              padding: '22px 32px', 
              borderRadius: '999px', 
              textAlign: 'center', 
              boxShadow: '0 12px 36px rgba(37, 211, 102, 0.45)', 
              border: '1.5px solid rgba(255, 255, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px'
            }}>
              <Smartphone size={28} color="#FFFFFF" />
              <span style={{ fontSize: '25px', fontWeight: 900, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                ¡Escríbenos por WhatsApp / DM!
              </span>
            </div>
          </div>
        </div>



        {/* ── Instagram – Plantilla B: Gold Premier 9:16 (Full Bleed) ───────── */}
        <div 
          ref={igBRef} 
          style={{ 
            position: 'relative', 
            width: '1080px', 
            height: '1920px', 
            background: '#0F0F0F', 
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* FOTO DE FONDO FULL BLEED (9:16) */}
          <img 
            src={base64Img || property.image} 
            crossOrigin="anonymous" 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }} 
            alt="" 
          />

          {/* OVERLAY DE DEGRADADO DORADO OBSIDIANA DESDE LA BASE */}
          <div 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, rgba(15,12,10,0.80) 36%, rgba(0,0,0,0.28) 65%, rgba(0,0,0,0.65) 100%)',
              pointerEvents: 'none'
            }} 
          />
          
          {/* HEADER TRANSPARENTE: [ RIV MARGARITA PREMIER ]   [ EN VENTA ] */}
          <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.94)', 
              backdropFilter: 'blur(20px)', 
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(212, 175, 55, 0.6)', 
              padding: '12px 28px', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
            }}>
              <img src="/logo-riv.svg" style={{ minWidth: '120px', height: 'auto', maxHeight: '36px', objectFit: 'contain' }} alt="RIV Margarita Premier" crossOrigin="anonymous" />
            </div>
            <div style={{ 
              background: 'linear-gradient(135deg, #D4AF37 0%, #AA8010 100%)', 
              border: '1.5px solid rgba(255,255,255,0.4)', 
              padding: '14px 30px', 
              borderRadius: '999px',
              boxShadow: '0 8px 24px rgba(212,175,55,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#000000', fontSize: '20px' }}>★</span>
              <span style={{ color: '#000000', fontWeight: 900, fontSize: '22px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {property.status === 'Vendida' ? 'VENDIDO' : 'PREMIER'}
              </span>
            </div>
          </div>

          {/* TARJETA DE INFORMACIÓN FLOTANTE (FROSTED GLASS) */}
          <div style={{ 
            position: 'absolute', 
            bottom: 60, 
            left: 24, 
            right: 24, 
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.92)', 
            backdropFilter: 'blur(30px)', 
            WebkitBackdropFilter: 'blur(30px)',
            border: '1.5px solid rgba(212, 175, 55, 0.5)', 
            borderRadius: '38px', 
            padding: '40px 42px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Tag de Categoría */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ 
                background: 'rgba(128, 0, 32, 0.1)', 
                color: '#800020', 
                border: '1px solid rgba(128, 0, 32, 0.3)', 
                borderRadius: '999px', 
                padding: '6px 20px', 
                fontSize: '18px', 
                fontWeight: 800, 
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>
                {property.propertyType || (isLand ? 'Terreno' : 'Inmueble')}
              </div>
              <div style={{ 
                background: 'rgba(212, 175, 55, 0.18)', 
                color: '#997300', 
                borderRadius: '999px', 
                padding: '6px 18px', 
                fontSize: '16px', 
                fontWeight: 700 
              }}>
                Colección Exclusiva
              </div>
            </div>

            {/* Título en Mayúsculas */}
            <h1 style={{ 
              fontSize: '50px', 
              fontWeight: 900, 
              color: '#111827', 
              margin: '0 0 10px 0', 
              lineHeight: 1.25, 
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {property.title}
            </h1>

            {/* Ubicación */}
            <p style={{ 
              color: '#4B5563', 
              fontSize: '26px', 
              fontWeight: 600, 
              margin: '0 0 22px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <MapPin size={28} color="#4B5563" /> {property.location}
            </p>

            {/* Precio */}
            <div style={{ marginBottom: '22px' }}>
              <p style={{ color: '#800020', fontSize: '15px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                PRECIO DE VENTA
              </p>
              <p style={{ fontSize: '76px', fontWeight: 900, color: '#800020', margin: '2px 0 0 0', lineHeight: 1 }}>
                ${fmt(property.price)} <span style={{ fontSize: '32px', color: '#6B7280', fontWeight: 700 }}>USD</span>
              </p>
            </div>

            {/* ATRIBUTOS DINÁMICOS: TERRENO O REGULAR */}
            {isLand ? (
              /* En Terreno / Parcela: NO muestra Habs ni Baños. Muestra solo Superficie en contenedor destacado central */
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(243, 244, 246, 0.9) 100%)', 
                border: '1.5px solid rgba(212, 175, 55, 0.5)', 
                borderRadius: '24px', 
                padding: '22px 28px', 
                textAlign: 'center', 
                marginBottom: '22px'
              }}>
                <p style={{ color: '#800020', fontSize: '16px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
                  SUPERFICIE TOTAL DEL TERRENO
                </p>
                <p style={{ color: '#111827', fontSize: '48px', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Ruler size={44} color="#111827" /> {property.sqm > 0 ? `${fmt(property.sqm)} m²` : 'Consultar metraje'}
                </p>
              </div>
            ) : (
              /* Bloques para inmuebles normales */
              <div style={{ display: 'flex', gap: '16px', marginBottom: '22px' }}>
                {validSpecs.map(s => {
                  const Icon = s.icon;
                  return (
                  <div key={s.label} style={{ 
                    flex: 1, 
                    background: '#F9FAFB', 
                    border: '1px solid #E5E7EB', 
                    borderRadius: '22px', 
                    padding: '18px 12px', 
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    <Icon size={32} color="#111827" style={{ marginBottom: '8px' }} />
                    <p style={{ color: '#111827', fontSize: '36px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                    <p style={{ color: '#6B7280', fontSize: '17px', margin: '4px 0 0 0', fontWeight: 600 }}>{s.label}</p>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Asesor */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '18px', 
              paddingTop: '20px', 
              borderTop: '1px solid #E5E7EB' 
            }}>
              <div style={{ 
                width: '62px', 
                height: '62px', 
                borderRadius: '50%', 
                background: '#800020', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#FFFFFF', 
                fontSize: '28px', 
                fontWeight: 900, 
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(128,0,32,0.3)'
              }}>
                {property.captador ? property.captador.charAt(0).toUpperCase() : 'R'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#9CA3AF', fontSize: '15px', fontWeight: 700, margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Asesor Inmobiliario
                </p>
                <p style={{ color: '#111827', fontSize: '26px', fontWeight: 900, margin: '2px 0 0 0' }}>
                  {property.captador || 'RIV Margarita Premier'}
                </p>
              </div>
              {advisorPhone && (
                <div style={{ 
                  background: 'rgba(37, 211, 102, 0.15)', 
                  border: '1px solid rgba(37, 211, 102, 0.4)', 
                  borderRadius: '18px', 
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Smartphone size={22} color="#128C7E" />
                  <span style={{ color: '#128C7E', fontSize: '19px', fontWeight: 800 }}>{advisorPhone}</span>
                </div>
              )}
            </div>

            {/* BOTÓN / INSIGNIA DE LLAMADO A LA ACCIÓN (CTA) - INTEGRADO */}
            <div style={{ 
              marginTop: '20px',
              background: 'linear-gradient(90deg, #800020 0%, #D4AF37 100%)', 
              color: '#FFFFFF', 
              padding: '22px 32px', 
              borderRadius: '999px', 
              textAlign: 'center', 
              boxShadow: '0 12px 36px rgba(128, 0, 32, 0.4)', 
              border: '1.5px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px'
            }}>
              <Smartphone size={28} color="#FFFFFF" />
              <span style={{ fontSize: '25px', fontWeight: 900, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                ¡Escríbenos por WhatsApp / DM!
              </span>
            </div>
          </div>
        </div>



        {/* ── WhatsApp – Plantilla A: Full Foto 1:1 con Logo ───────────────── */}
        <div ref={waARef} style={{ position: 'relative', width: '1080px', height: '1080px', background: '#000', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
          <img src={base64Img || property.image} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} alt="" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(128,0,32,0.6) 0%, rgba(0,0,0,0.85) 100%)' }} />

          {/* Top Bar con Logo */}
          <div style={{ position: 'absolute', top: 56, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '20px', padding: '10px 24px' }}>
              <img src="/logo-riv.svg" style={{ height: '44px', objectFit: 'contain' }} alt="RIV Margarita Premier" crossOrigin="anonymous" />
            </div>
            <div style={{ background: '#800020', borderRadius: '16px', padding: '10px 24px' }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: '22px', margin: 0 }}>En Venta</p>
            </div>
          </div>

          {/* Bottom Content */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '56px' }}>
            <h1 style={{ fontSize: '64px', fontWeight: 900, color: '#fff', margin: '0 0 12px', lineHeight: 1.1 }}>{property.title}</h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '26px', margin: '0 0 28px' }}>📍 {property.location}</p>
            <p style={{ fontSize: '84px', fontWeight: 900, color: '#fff', margin: '0 0 36px', lineHeight: 1 }}>${fmt(property.price)} <span style={{ fontSize: '28px', fontWeight: 400, color: '#D4AF37' }}>USD</span></p>

            <div style={{ display: 'flex', gap: '16px' }}>
              {validSpecs.map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', borderRadius: '20px', padding: '18px 12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <p style={{ color: '#fff', fontSize: '32px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', margin: '4px 0 0' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── WhatsApp – Plantilla B: Panel Premium 1:1 con Logo ───────────── */}
        <div ref={waBRef} style={{ width: '1080px', height: '1080px', background: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Foto top */}
          <div style={{ position: 'relative', height: '560px', overflow: 'hidden', flexShrink: 0 }}>
            <img src={base64Img || property.image} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            <div style={{ position: 'absolute', top: 32, left: 32, background: 'rgba(255,255,255,0.92)', borderRadius: '20px', padding: '10px 24px', border: '1px solid rgba(128,0,32,0.15)' }}>
              <img src="/logo-riv.svg" style={{ height: '42px', objectFit: 'contain' }} alt="RIV Margarita Premier" crossOrigin="anonymous" />
            </div>
            <div style={{ position: 'absolute', top: 32, right: 32, background: '#800020', borderRadius: '16px', padding: '10px 24px' }}>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: '20px', margin: 0 }}>En Venta</p>
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

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${validSpecs.length}, 1fr)`, gap: '16px', flex: 1 }}>
              {validSpecs.map(s => {
                const Icon = s.icon;
                return (
                <div key={s.label} style={{ background: '#F9FAFB', border: '2px solid #F3F4F6', borderRadius: '20px', padding: '20px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={36} color="#111" style={{ marginBottom: '8px' }} />
                  <p style={{ color: '#111', fontSize: '36px', fontWeight: 900, margin: 0 }}>{s.v}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '15px', margin: '4px 0 0' }}>{s.label}</p>
                </div>
              )})}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '2px solid #F3F4F6', paddingTop: '24px', marginTop: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#800020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 900, flexShrink: 0 }}>
                {property.captador ? property.captador.charAt(0).toUpperCase() : 'R'}
              </div>
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '15px', margin: 0 }}>Asesor Inmobiliario</p>
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
      <div style={{ width: '100%', aspectRatio: '0.56', background: '#0F0F0F', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,12,10,0.92) 0%, rgba(0,0,0,0.2) 65%, rgba(0,0,0,0.6) 100%)' }} />
        {/* Top Header */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '10px', background: 'rgba(255,255,255,0.9)', borderRadius: '3px' }} />
          <div style={{ width: '32px', height: '10px', background: '#D4AF37', borderRadius: '5px' }} />
        </div>
        {/* Floating Card */}
        <div style={{ position: 'absolute', bottom: '26px', left: '8px', right: '8px', background: 'rgba(255,255,255,0.92)', borderRadius: '8px', padding: '6px' }}>
          <div style={{ width: '30%', height: '4px', background: '#800020', borderRadius: '2px', marginBottom: '3px' }} />
          <div style={{ width: '85%', height: '6px', background: '#111', borderRadius: '2px', marginBottom: '3px' }} />
          <div style={{ width: '50%', height: '4px', background: '#666', borderRadius: '2px', marginBottom: '4px' }} />
          <div style={{ width: '100%', height: '11px', background: 'rgba(212,175,55,0.25)', borderRadius: '3px', border: '0.5px solid #D4AF37' }} />
        </div>
        {/* CTA */}
        <div style={{ position: 'absolute', bottom: '6px', left: '10px', right: '10px', height: '14px', background: 'linear-gradient(90deg, #800020, #D4AF37)', borderRadius: '999px' }} />
      </div>
    ) : (
      <div style={{ width: '100%', aspectRatio: '0.56', background: '#0a0a0c', borderRadius: '10px', overflow: 'hidden', position: 'relative', fontSize: 0 }}>
        <img src={property.image} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} alt="" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 65%, rgba(0,0,0,0.6) 100%)' }} />
        {/* Top Header */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '10px', background: 'rgba(12,12,16,0.7)', border: '0.5px solid #D4AF37', borderRadius: '3px' }} />
          <div style={{ width: '32px', height: '10px', background: '#800020', borderRadius: '5px' }} />
        </div>
        {/* Floating Glass Card */}
        <div style={{ position: 'absolute', bottom: '26px', left: '8px', right: '8px', background: 'rgba(16,18,27,0.78)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px' }}>
          <div style={{ width: '30%', height: '4px', background: '#D4AF37', borderRadius: '2px', marginBottom: '3px' }} />
          <div style={{ width: '85%', height: '6px', background: '#fff', borderRadius: '2px', marginBottom: '3px' }} />
          <div style={{ width: '50%', height: '4px', background: 'rgba(255,255,255,0.7)', borderRadius: '2px', marginBottom: '4px' }} />
          <div style={{ width: '100%', height: '11px', background: 'rgba(212,175,55,0.2)', borderRadius: '3px', border: '0.5px solid rgba(212,175,55,0.5)' }} />
        </div>
        {/* CTA */}
        <div style={{ position: 'absolute', bottom: '6px', left: '10px', right: '10px', height: '14px', background: 'linear-gradient(90deg, #25D366, #128C7E)', borderRadius: '999px' }} />
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
