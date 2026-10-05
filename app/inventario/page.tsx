'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  MapPin, Bed, Bath, Maximize,
  Plus, Search, Download, X, ChevronRight,
  Wand2, Loader2, AlertCircle, Home, Building2, Store, Layers, Maximize2, TreePine, Briefcase, FileText,
  SlidersHorizontal, Filter, Check, RotateCcw, ExternalLink,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, PROPERTY_TYPES } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Property, PropertyType } from '../context/DataContext';
import { fuzzySearch, applyAIFilters, normalize, type AIFilters } from '../lib/searchEngine';
import { containerVariants, itemVariants } from '../lib/motion';
import BrandLogo from '../components/BrandLogo';

// Icono pequeño por tipo (para el badge de las tarjetas)
const TYPE_BADGE: Partial<Record<PropertyType, { icon: React.ReactNode; label: string }>> = {
  'Apartamento':     { icon: <Building2 size={10} />,  label: 'Apto' },
  'Casa / Quinta':   { icon: <Home size={10} />,        label: 'Casa' },
  'Townhouse':       { icon: <Layers size={10} />,      label: 'Townhouse' },
  'Penthouse':       { icon: <Maximize2 size={10} />,   label: 'PH' },
  'Local Comercial': { icon: <Store size={10} />,       label: 'Local' },
  'Oficina':         { icon: <Briefcase size={10} />,   label: 'Oficina' },
  'Terreno':         { icon: <TreePine size={10} />,    label: 'Terreno' },
};

const MUNICIPIOS_MARGARITA = [
  'Todos',
  'Maneiro',
  'Mariño',
  'Arismendi',
  'Antolín del Campo',
  'García',
  'Gómez',
  'Marcano',
  'Díaz',
  'Tubores',
  'Macanao',
  'Villalba',
];

// ─── Exportar Inventario a PDF ─────────────────────────────────────────────
function exportToPDF(properties: Property[], filterDescription?: string) {
  if (!properties || properties.length === 0) {
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 269mm

  const COLOR_PRIMARY: [number, number, number] = [128, 0, 32];
  const COLOR_GOLD: [number, number, number] = [212, 175, 55];
  const COLOR_DARK: [number, number, number] = [31, 41, 55];
  const COLOR_MUTED: [number, number, number] = [107, 114, 128];
  const COLOR_ROW_ALT: [number, number, number] = [249, 250, 251];
  const COLOR_BORDER: [number, number, number] = [229, 231, 235];

  const columns = [
    { header: '#', width: 10, align: 'center' as const },
    { header: 'Inmueble / Título', width: 68, align: 'left' as const },
    { header: 'Tipo', width: 28, align: 'left' as const },
    { header: 'Ubicación', width: 54, align: 'left' as const },
    { header: 'Hab / Bñ / M²', width: 32, align: 'center' as const },
    { header: 'Precio (USD)', width: 28, align: 'right' as const },
    { header: 'Estado', width: 24, align: 'center' as const },
    { header: 'Captador', width: 25, align: 'left' as const },
  ];

  let currentY = 14;

  const drawHeader = (isFirstPage: boolean) => {
    // Barra superior decorativa
    pdf.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    pdf.rect(marginX, 10, contentWidth, 2.5, 'F');

    if (isFirstPage) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      pdf.text('RIV MARGARITA PREMIER', marginX, 19);

      pdf.setFontSize(9);
      pdf.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
      pdf.text('REPORTE GENERAL DE INVENTARIO INMOBILIARIO', marginX, 24);

      if (filterDescription) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
        pdf.text('Criterios:', marginX, 28);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
        const safeFilterDesc = filterDescription.length > 92 ? filterDescription.slice(0, 89) + '...' : filterDescription;
        pdf.text(safeFilterDesc, marginX + 15, 28);
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      
      const dateStr = `Fecha: ${new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      const totalStr = `Total Inmuebles: ${properties.length}`;
      const activasCount = properties.filter(p => p.status === 'Activa').length;
      const activasVal = properties
        .filter(p => p.status === 'Activa')
        .reduce((sum, p) => sum + (p.price || 0), 0);
      const summaryStr = `Activos: ${activasCount} | Catálogo Activo: $${activasVal.toLocaleString('es-VE')} USD`;

      pdf.text(dateStr, pageWidth - marginX, 18, { align: 'right' });
      pdf.text(totalStr, pageWidth - marginX, 22, { align: 'right' });
      pdf.text(summaryStr, pageWidth - marginX, 26, { align: 'right' });

      pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, 30, marginX + contentWidth, 30);

      currentY = 33;
    } else {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      pdf.text('RIV MARGARITA PREMIER · Reporte de Inventario', marginX, 18);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      pdf.text(new Date().toLocaleDateString('es-VE'), pageWidth - marginX, 18, { align: 'right' });

      pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, 21, marginX + contentWidth, 21);

      currentY = 24;
    }

    // Cabecera de la tabla
    const headerHeight = 7;
    pdf.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    pdf.rect(marginX, currentY, contentWidth, headerHeight, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);

    let colX = marginX;
    columns.forEach(col => {
      let textX = colX + 2;
      if (col.align === 'center') textX = colX + col.width / 2;
      else if (col.align === 'right') textX = colX + col.width - 2;

      pdf.text(col.header, textX, currentY + 4.8, { align: col.align });
      colX += col.width;
    });

    currentY += headerHeight;
  };

  drawHeader(true);

  const rowHeight = 7.5;
  const bottomLimit = pageHeight - 14;

  properties.forEach((prop, index) => {
    if (currentY + rowHeight > bottomLimit) {
      pdf.addPage('a4', 'landscape');
      drawHeader(false);
    }

    if (index % 2 === 1) {
      pdf.setFillColor(COLOR_ROW_ALT[0], COLOR_ROW_ALT[1], COLOR_ROW_ALT[2]);
      pdf.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }

    pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    pdf.setLineWidth(0.15);
    pdf.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);

    let colX = marginX;

    // 1. #
    pdf.text(String(index + 1), colX + columns[0].width / 2, currentY + 4.8, { align: 'center' });
    colX += columns[0].width;

    // 2. Inmueble
    pdf.setFont('helvetica', 'bold');
    const safeTitle = (prop.title || 'Sin título').length > 36
      ? (prop.title || '').slice(0, 34) + '...'
      : prop.title || 'Sin título';
    pdf.text(safeTitle, colX + 2, currentY + 4.8);
    colX += columns[1].width;

    // 3. Tipo
    pdf.setFont('helvetica', 'normal');
    const safeType = (prop.propertyType || '-').length > 16
      ? (prop.propertyType || '').slice(0, 14) + '...'
      : prop.propertyType || '-';
    pdf.text(safeType, colX + 2, currentY + 4.8);
    colX += columns[2].width;

    // 4. Ubicación
    pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    const safeLoc = (prop.location || '-').length > 30
      ? (prop.location || '').slice(0, 28) + '...'
      : prop.location || '-';
    pdf.text(safeLoc, colX + 2, currentY + 4.8);
    colX += columns[3].width;

    // 5. Specs
    pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    const specs = `${prop.beds || 0}h · ${prop.baths || 0}b · ${prop.sqm || 0}m²`;
    pdf.text(specs, colX + columns[4].width / 2, currentY + 4.8, { align: 'center' });
    colX += columns[4].width;

    // 6. Precio
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    const priceText = `$${(prop.price || 0).toLocaleString('es-VE')}`;
    pdf.text(priceText, colX + columns[5].width - 2, currentY + 4.8, { align: 'right' });
    colX += columns[5].width;

    // 7. Estado
    const status = prop.status || 'Activa';
    const badgeW = 18;
    const badgeH = 4.5;
    const badgeX = colX + (columns[6].width - badgeW) / 2;
    const badgeY = currentY + (rowHeight - badgeH) / 2;

    if (status === 'Activa') {
      pdf.setFillColor(222, 247, 236);
      pdf.rect(badgeX, badgeY, badgeW, badgeH, 'F');
      pdf.setTextColor(3, 84, 63);
    } else if (status === 'Vendida') {
      pdf.setFillColor(254, 240, 138);
      pdf.rect(badgeX, badgeY, badgeW, badgeH, 'F');
      pdf.setTextColor(133, 77, 14);
    } else {
      pdf.setFillColor(243, 244, 246);
      pdf.rect(badgeX, badgeY, badgeW, badgeH, 'F');
      pdf.setTextColor(75, 85, 99);
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text(status, colX + columns[6].width / 2, currentY + 4.6, { align: 'center' });
    colX += columns[6].width;

    // 8. Captador
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    const safeCaptador = (prop.captador || 'Sin asignar').length > 15
      ? (prop.captador || '').slice(0, 13) + '...'
      : prop.captador || 'Sin asignar';
    pdf.text(safeCaptador, colX + 2, currentY + 4.8);

    currentY += rowHeight;
  });

  // Pie de página con numeración
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);

    pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, pageHeight - 10, marginX + contentWidth, pageHeight - 10);
    pdf.text('RIV Margarita Premier · Documento confidencial para uso inmobiliario', marginX, pageHeight - 6);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 6, { align: 'right' });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = filterDescription ? `inventario_filtrado_${dateStamp}.pdf` : `inventario_riv_${dateStamp}.pdf`;
  pdf.save(fileName);
}

// ─── Llamada a la API de búsqueda IA ───────────────────────────────────────
async function fetchAIFilters(query: string): Promise<AIFilters | null> {
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data: AIFilters & { error?: string } = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

const STATUS_FILTERS = ['Todas', 'Activa', 'Vendida', 'Suspendida'];

// Cuántas palabras mínimas para activar IA (consultas cortas usan solo fuzzy)
const AI_MIN_WORDS = 2;
// Tiempo de espera tras el último keystroke antes de llamar a Gemini
const AI_DEBOUNCE_MS = 800;

export default function Inventario() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { properties } = useData();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery]       = useState(searchParams.get('q') ?? '');
  const [activeFilter, setActiveFilter]     = useState('Todas');
  const [aiFilters, setAiFilters]           = useState<AIFilters | null>(null);
  const [isAILoading, setIsAILoading]       = useState(false);
  const [aiError, setAiError]               = useState(false);
  // Paso 5 — true solo cuando los resultados mostrados vienen realmente del motor IA
  const [isAIResultSet, setIsAIResultSet]   = useState(false);
  const [isExporting, setIsExporting]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estados para modal de exportación personalizada
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode]               = useState<'custom' | 'view'>('custom');
  const [exportType, setExportType]               = useState<string>('Todos');
  const [exportMunicipio, setExportMunicipio]     = useState<string>('Todos');
  const [exportZoneKeyword, setExportZoneKeyword] = useState<string>('');
  const [exportMinPrice, setExportMinPrice]       = useState<string>('');
  const [exportMaxPrice, setExportMaxPrice]       = useState<string>('');
  const [exportMinBeds, setExportMinBeds]         = useState<string>('Todos');
  const [exportStatus, setExportStatus]           = useState<string>('Activa');

  const handleResetExportFilters = useCallback(() => {
    setExportType('Todos');
    setExportMunicipio('Todos');
    setExportZoneKeyword('');
    setExportMinPrice('');
    setExportMaxPrice('');
    setExportMinBeds('Todos');
    setExportStatus('Activa');
  }, []);

  // Determina si la query tiene suficientes palabras para disparar IA
  const shouldUseAI = (q: string) =>
    q.trim().split(/\s+/).filter(Boolean).length >= AI_MIN_WORDS;

  // ─── Handler del input de búsqueda ─────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setAiError(false);

    // Paso 4 — Sincronizar con la URL para que el estado sea bookmarkeable y se restaure al refrescar
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.replace(`/inventario?${params.toString()}`, { scroll: false });

    // Limpiar timer anterior
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setAiFilters(null);
      setIsAILoading(false);
      return;
    }

    if (!shouldUseAI(value)) {
      // Query corta → solo fuzzy, no llamar a IA
      setAiFilters(null);
      setIsAILoading(false);
      return;
    }

    // Mostrar spinner mientras esperamos el debounce
    setIsAILoading(true);

    debounceRef.current = setTimeout(async () => {
      const result = await fetchAIFilters(value);
      if (result) {
        setAiFilters(result);
      } else {
        // La IA falló o no está configurada → fuzzy como fallback
        setAiFilters(null);
        setAiError(true);
      }
      setIsAILoading(false);
    }, AI_DEBOUNCE_MS);
  }, [router, searchParams]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Limpiar todo
  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchQuery('');
    setAiFilters(null);
    setIsAILoading(false);
    setAiError(false);
    // Paso 4 — Limpiar también el param ?q de la URL
    router.replace('/inventario', { scroll: false });
  }, [router]);

  // ─── Motor de búsqueda combinado ──────────────────────────────────────────
  const filteredProperties = useMemo(() => {
    // Aplicar filtro de estado primero
    const byStatus = activeFilter === 'Todas'
      ? properties
      : properties.filter(p => p.status === activeFilter);

    if (!searchQuery.trim()) return byStatus;

    // Si la IA devolvió filtros → usarlos
    if (aiFilters && !isAILoading) {
      const aiResults = applyAIFilters(byStatus, aiFilters);
      // Si la IA no encontró nada, caer a fuzzy como fallback
      return aiResults.length > 0 ? aiResults : fuzzySearch(byStatus, searchQuery);
    }

    // Fuzzy local (instantáneo, mientras IA procesa o para queries cortas)
    return fuzzySearch(byStatus, searchQuery);
  }, [properties, searchQuery, activeFilter, aiFilters, isAILoading]);

  // Paso 5 — Efecto separado para actualizar isAIResultSet (evita efecto secundario en useMemo)
  useEffect(() => {
    if (!searchQuery.trim() || !aiFilters || isAILoading) {
      setIsAIResultSet(false);
      return;
    }
    const byStatus = activeFilter === 'Todas'
      ? properties
      : properties.filter(p => p.status === activeFilter);
    const aiResults = applyAIFilters(byStatus, aiFilters);
    setIsAIResultSet(aiResults.length > 0);
  }, [properties, searchQuery, activeFilter, aiFilters, isAILoading]);

  // Inmuebles a exportar según la configuración del modal
  const exportTargetProperties = useMemo(() => {
    if (exportMode === 'view') {
      return filteredProperties;
    }

    return properties.filter(p => {
      // Estado
      if (exportStatus !== 'Todas' && p.status !== exportStatus) {
        return false;
      }
      // Tipo de inmueble
      if (exportType !== 'Todos' && p.propertyType !== exportType) {
        return false;
      }
      // Municipio
      if (exportMunicipio !== 'Todos') {
        const normLoc = normalize(p.location || '');
        const normMun = normalize(exportMunicipio);
        if (!normLoc.includes(normMun)) {
          return false;
        }
      }
      // Palabra clave en zona / urbanización
      if (exportZoneKeyword.trim()) {
        const normLoc = normalize(p.location || '');
        const normKey = normalize(exportZoneKeyword);
        if (!normLoc.includes(normKey)) {
          return false;
        }
      }
      // Precio mínimo
      if (exportMinPrice !== '') {
        const minVal = parseFloat(exportMinPrice);
        if (!isNaN(minVal) && (p.price || 0) < minVal) {
          return false;
        }
      }
      // Precio máximo
      if (exportMaxPrice !== '') {
        const maxVal = parseFloat(exportMaxPrice);
        if (!isNaN(maxVal) && (p.price || 0) > maxVal) {
          return false;
        }
      }
      // Mínimo de habitaciones
      if (exportMinBeds !== 'Todos') {
        const minBedsVal = parseInt(exportMinBeds, 10);
        if (!isNaN(minBedsVal) && (p.beds || 0) < minBedsVal) {
          return false;
        }
      }

      return true;
    });
  }, [
    exportMode,
    filteredProperties,
    properties,
    exportStatus,
    exportType,
    exportMunicipio,
    exportZoneKeyword,
    exportMinPrice,
    exportMaxPrice,
    exportMinBeds,
  ]);

  // Descripción textual de los criterios seleccionados
  const exportFilterDescription = useMemo(() => {
    if (exportMode === 'view') {
      const parts: string[] = ['Vista actual'];
      if (activeFilter !== 'Todas') parts.push(`Estado: ${activeFilter}`);
      if (searchQuery.trim()) parts.push(`Búsqueda: "${searchQuery}"`);
      return parts.join(' · ');
    }

    const parts: string[] = [];
    if (exportType !== 'Todos') parts.push(exportType);
    else parts.push('Todos los tipos');

    if (exportMunicipio !== 'Todos') parts.push(`Mcpio. ${exportMunicipio}`);
    if (exportZoneKeyword.trim()) parts.push(`Zona: "${exportZoneKeyword.trim()}"`);

    if (exportMinPrice || exportMaxPrice) {
      if (exportMinPrice && exportMaxPrice) {
        parts.push(`$${Number(exportMinPrice).toLocaleString('es-VE')} - $${Number(exportMaxPrice).toLocaleString('es-VE')} USD`);
      } else if (exportMinPrice) {
        parts.push(`Desde $${Number(exportMinPrice).toLocaleString('es-VE')} USD`);
      } else if (exportMaxPrice) {
        parts.push(`Hasta $${Number(exportMaxPrice).toLocaleString('es-VE')} USD`);
      }
    }

    if (exportMinBeds !== 'Todos') {
      parts.push(`Mín. ${exportMinBeds} hab`);
    }

    if (exportStatus !== 'Todas') {
      parts.push(exportStatus);
    }

    return parts.join(' · ');
  }, [
    exportMode,
    activeFilter,
    searchQuery,
    exportType,
    exportMunicipio,
    exportZoneKeyword,
    exportMinPrice,
    exportMaxPrice,
    exportMinBeds,
    exportStatus,
  ]);

  const handleExecuteExport = () => {
    if (exportTargetProperties.length === 0) {
      showToast('No hay inmuebles que coincidan con los filtros seleccionados.', 'info');
      return;
    }

    setIsExporting(true);
    try {
      exportToPDF(exportTargetProperties, exportFilterDescription);
      setIsExportModalOpen(false);
      showToast('Inventario PDF generado correctamente.');
    } catch (err) {
      console.error('Error al exportar inventario a PDF:', err);
      showToast('Hubo un error al generar el PDF del inventario.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Paso 5 — isAIActive es true solo si los resultados actuales son realmente de la IA
  const isAIActive = isAIResultSet && !isAILoading && !!searchQuery.trim();

  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content">

      {/* HEADER */}
      <header className="bg-white px-4 pt-6 pb-3 sticky top-0 z-30 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Inventario</h1>
            <p className="text-xs text-gray-400 mt-0.5">{filteredProperties.length} inmuebles encontrados</p>
          </div>
          <div className="flex items-center gap-2">
            <BrandLogo size="xs" className="shrink-0" />
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-vinotinto/10 text-vinotinto rounded-xl text-xs font-bold hover:bg-vinotinto/20 transition-colors"
              title="Exportar inventario a PDF"
            >
              <SlidersHorizontal size={14} />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Busca: '3 hab cerca del mar con piscina menos de 80k'..."
            className={`w-full pl-9 pr-10 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 transition bg-gray-100 ${
              isAIActive
                ? 'border-vinotinto/40 bg-white focus:ring-vinotinto ring-1 ring-vinotinto/20'
                : 'border-gray-200 focus:ring-vinotinto focus:bg-white'
            }`}
          />

          {/* Icono derecho: spinner, X o Wand */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isAILoading ? (
              <Loader2 size={15} className="text-vinotinto animate-spin" />
            ) : searchQuery ? (
              <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 transition">
                <X size={15} />
              </button>
            ) : (
              <Wand2 size={15} className="text-gray-300" />
            )}
          </div>
        </div>

        {/* CHIP DE BÚSQUEDA IA */}
        {isAIActive && aiFilters?.interpretacion && (
          <div className="flex items-center gap-2 mt-2 px-1 animate-fade-in-up">
            <div className="flex items-center gap-1.5 bg-vinotinto/5 border border-vinotinto/20 rounded-full px-3 py-1">
              <Wand2 size={11} className="text-vinotinto shrink-0" />
              <p className="text-xs text-vinotinto font-semibold leading-none">
                {aiFilters.interpretacion}
              </p>
              <button
                onClick={handleClear}
                className="text-vinotinto/50 hover:text-vinotinto transition ml-1"
                title="Limpiar búsqueda"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        )}

        {/* AVISO si IA no disponible y se usó fuzzy */}
        {isAIActive && !aiFilters?.interpretacion && (
          <div className="flex items-center gap-1.5 mt-2 px-1">
            <Wand2 size={11} className="text-vinotinto" />
            <p className="text-xs text-vinotinto font-semibold">Búsqueda inteligente activa</p>
          </div>
        )}

        {/* HINT para el usuario: qué pasa si escriben poco */}
        {!isAILoading && !isAIActive && searchQuery.trim() && !shouldUseAI(searchQuery) && (
          <p className="text-[10px] text-gray-400 mt-1.5 px-1">
            💡 Escribe 2 o más palabras para activar la búsqueda con IA
          </p>
        )}

        {/* ERROR de IA (API no configurada o fallo) */}
        {aiError && searchQuery && shouldUseAI(searchQuery) && (
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <AlertCircle size={11} className="text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-600 font-medium">
              IA no disponible · Usando búsqueda local
            </p>
          </div>
        )}
      </header>

      {/* FILTROS DE ESTADO */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {STATUS_FILTERS.map(f => (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 text-sm font-bold rounded-full whitespace-nowrap border transition-all ${
              activeFilter === f
                ? 'bg-vinotinto text-white border-vinotinto shadow-sm shadow-vinotinto/20'
                : 'bg-white border-gray-200 text-gray-600 hover:border-vinotinto/40'
            }`}
          >
            {f}
          </motion.button>
        ))}
      </div>

      {/* LISTADO */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-4 pb-28 space-y-4"
      >
        {filteredProperties.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 mt-2">
            <Search className="mx-auto text-gray-300 mb-3" size={44} />
            <p className="text-gray-500 font-semibold">Sin resultados</p>
            <p className="text-sm text-gray-400 mt-1 px-6">
              {isAIActive
                ? 'La búsqueda inteligente no encontró propiedades con esos criterios.'
                : activeFilter !== 'Todas'
                ? `No hay inmuebles con estado "${activeFilter}" que coincidan.`
                : 'Intenta con otra búsqueda o ajusta los filtros.'}
            </p>
            <div className="flex flex-col items-center gap-2 mt-4">
              {searchQuery && (
                <button
                  onClick={handleClear}
                  className="text-xs text-vinotinto font-bold underline underline-offset-2"
                >
                  Limpiar búsqueda
                </button>
              )}
              {activeFilter !== 'Todas' && (
                <button
                  onClick={() => setActiveFilter('Todas')}
                  className="text-xs text-gray-500 font-medium underline underline-offset-2"
                >
                  Ver todas las propiedades
                </button>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence>
          {filteredProperties.map((prop) => (
            <motion.div
              layout
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              key={prop.id}
              onClick={() => router.push(`/inventario/${prop.id}`)}
              className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] transition-shadow"
            >
              {/* IMAGEN */}
              <div className="relative w-full h-48 bg-gray-200">
                <img
                  src={prop.image}
                  alt={prop.title}
                  className="w-full h-full object-cover"
                />
                {/* BADGE ESTADO */}
                <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm shadow-sm ${
                  prop.status === 'Activa'
                    ? 'bg-green-500/90 text-white'
                    : prop.status === 'Vendida'
                    ? 'bg-gray-700/90 text-white'
                    : 'bg-amber-400/90 text-white'
                }`}>
                  {prop.status}
                </span>

                {/* BADGE TIPO DE PROPIEDAD */}
                {prop.propertyType && TYPE_BADGE[prop.propertyType] && (
                  <span className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white rounded-full text-[9px] font-bold">
                    {TYPE_BADGE[prop.propertyType]!.icon}
                    {TYPE_BADGE[prop.propertyType]!.label}
                  </span>
                )}

                {/* BADGE IA — solo cuando la IA encontró esta propiedad */}
                {isAIActive && (
                  <span className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 bg-vinotinto/80 backdrop-blur-sm text-white rounded-full text-[9px] font-bold">
                    <Wand2 size={9} /> IA
                  </span>
                )}
              </div>

              {/* INFO */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-base text-gray-800 leading-tight flex-1 pr-2">{prop.title}</h3>
                  <span className="font-extrabold text-base text-vinotinto whitespace-nowrap">
                    ${prop.price.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <MapPin size={12} className="mr-1 text-vinotinto/60 shrink-0" />
                    <span className="truncate">{prop.location}</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.location + ', Venezuela')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Ver en Google Maps"
                    className="ml-2 shrink-0 flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold transition-colors active:scale-95"
                  >
                    <ExternalLink size={11} />
                    <span className="text-[10px]">Maps</span>
                  </a>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                  <div className="flex gap-4 text-sm text-gray-600 font-medium">
                    <div className="flex items-center gap-1">
                      <Bed size={14} className="text-gray-400" />
                      <span>{prop.beds}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath size={14} className="text-gray-400" />
                      <span>{prop.baths}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Maximize size={14} className="text-gray-400" />
                      <span>{prop.sqm}m²</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        )}
      </motion.div>

      <button
        onClick={() => router.push('/inventario/registro')}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom)+1rem)] right-5 w-14 h-14 bg-vinotinto text-white rounded-full flex items-center justify-center shadow-lg shadow-vinotinto/30 active:scale-90 transition-transform z-20"
      >
        <Plus size={28} />
      </button>

      {/* MODAL DE EXPORTACIÓN PERSONALIZADA */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-container bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Encabezado del Modal */}
              <div className="bg-gradient-to-r from-vinotinto to-vinotinto/90 text-white p-4 sm:p-5 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300 bg-white/10 px-2.5 py-0.5 rounded-full mb-1">
                      <SlidersHorizontal size={11} />
                      Exportación de Catálogo
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold">Exportar Inventario a PDF</h2>
                    <p className="text-xs text-white/80 mt-0.5">
                      Filtra por características específicas o exporta tu vista actual
                    </p>
                  </div>
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tabs de Modo */}
                <div className="flex bg-black/20 p-1 rounded-xl mt-3 sm:mt-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setExportMode('custom')}
                    className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      exportMode === 'custom'
                        ? 'bg-white text-vinotinto shadow-sm'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <SlidersHorizontal size={13} />
                    Filtros Específicos
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportMode('view')}
                    className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      exportMode === 'view'
                        ? 'bg-white text-vinotinto shadow-sm'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <Layers size={13} />
                    Vista Actual ({filteredProperties.length})
                  </button>
                </div>
              </div>

              {/* Contenido del Formulario */}
              <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 flex-1 overflow-y-auto">
                {exportMode === 'custom' ? (
                  <>
                    <div className="flex justify-between items-center pb-1 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Características del Inmueble
                      </span>
                      <button
                        type="button"
                        onClick={handleResetExportFilters}
                        className="text-[11px] text-gray-400 hover:text-vinotinto flex items-center gap-1 font-medium transition"
                      >
                        <RotateCcw size={11} />
                        Restablecer filtros
                      </button>
                    </div>

                    {/* Fila 1: Tipo de Inmueble & Municipio */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Tipo de Inmueble
                        </label>
                        <select
                          value={exportType}
                          onChange={e => setExportType(e.target.value)}
                          className="w-full text-xs sm:text-sm font-medium border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                        >
                          <option value="Todos">Todos los tipos</option>
                          {PROPERTY_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Municipio / Zona
                        </label>
                        <select
                          value={exportMunicipio}
                          onChange={e => setExportMunicipio(e.target.value)}
                          className="w-full text-xs sm:text-sm font-medium border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                        >
                          {MUNICIPIOS_MARGARITA.map(mun => (
                            <option key={mun} value={mun}>
                              {mun === 'Todos' ? 'Todos los municipios' : `Municipio ${mun}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sector o Urbanización específico (opcional) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Sector, Urb. o Palabra en Ubicación <span className="text-[10px] font-normal text-gray-400">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={exportZoneKeyword}
                        onChange={e => setExportZoneKeyword(e.target.value)}
                        placeholder="Ej: Pampatar, Costa Azul, Playa El Ángel..."
                        className="w-full text-xs sm:text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                      />
                    </div>

                    {/* Fila 2: Rango de Precio USD */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Rango de Precio (USD)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="Mínimo"
                            value={exportMinPrice}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === '' || (!v.startsWith('-') && Number(v) >= 0)) setExportMinPrice(v);
                            }}
                            className="w-full text-xs sm:text-sm pl-6 pr-2 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="Máximo"
                            value={exportMaxPrice}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === '' || (!v.startsWith('-') && Number(v) >= 0)) setExportMaxPrice(v);
                            }}
                            className="w-full text-xs sm:text-sm pl-6 pr-2 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fila 3: Habitaciones Mínimas & Estado */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Mínimo de Habitaciones
                        </label>
                        <select
                          value={exportMinBeds}
                          onChange={e => setExportMinBeds(e.target.value)}
                          className="w-full text-xs sm:text-sm font-medium border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                        >
                          <option value="Todos">Cualquier cantidad</option>
                          <option value="1">1 o más habitaciones</option>
                          <option value="2">2 o más habitaciones</option>
                          <option value="3">3 o más habitaciones</option>
                          <option value="4">4 o más habitaciones</option>
                          <option value="5">5 o más habitaciones</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Estado del Inmueble
                        </label>
                        <select
                          value={exportStatus}
                          onChange={e => setExportStatus(e.target.value)}
                          className="w-full text-xs sm:text-sm font-medium border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto"
                        >
                          <option value="Activa">Solo Activas (Disponibles)</option>
                          <option value="Todas">Todas (Activas, Vendidas, etc.)</option>
                          <option value="Vendida">Solo Vendidas</option>
                          <option value="Suspendida">Solo Suspendidas</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                      <FileText size={16} className="text-vinotinto" />
                      Exportar lo que ves en pantalla
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Se exportarán exactamente los <strong className="text-gray-900">{filteredProperties.length}</strong> inmuebles que están visibles en tu listado, respetando la búsqueda actual {searchQuery ? `("${searchQuery}")` : ''} y el filtro de estado seleccionado (<span className="text-vinotinto font-semibold">{activeFilter}</span>).
                    </p>
                  </div>
                )}

                {/* Resumen dinámico del resultado */}
                <div className="p-3 bg-vinotinto/5 border border-vinotinto/15 rounded-xl">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-bold text-vinotinto uppercase tracking-wider">
                      Resumen a exportar
                    </span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-vinotinto text-white">
                      {exportTargetProperties.length} {exportTargetProperties.length === 1 ? 'inmueble' : 'inmuebles'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 leading-snug line-clamp-2">
                    {exportFilterDescription || 'Todos los inmuebles del catálogo'}
                  </p>
                </div>
              </div>

              {/* Botones del Modal */}
              <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteExport}
                  disabled={exportTargetProperties.length === 0 || isExporting}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-vinotinto text-white text-xs font-bold rounded-xl shadow-md shadow-vinotinto/20 hover:bg-vinotinto/90 transition disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {isExporting ? 'Generando PDF...' : `Exportar ${exportTargetProperties.length} Inmuebles`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

