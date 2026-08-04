'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  MapPin, Bed, Bath, Maximize,
  Plus, Search, Download, X, ChevronRight,
  Wand2, Loader2, AlertCircle
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import type { Property } from '../context/DataContext';
import { fuzzySearch, applyAIFilters, type AIFilters } from '../lib/searchEngine';

// ─── Exportar a CSV ─────────────────────────────────────────────────────────
function exportToCSV(properties: Property[]) {
  const headers = ['ID', 'Título', 'Precio (USD)', 'Ubicación', 'Habitaciones', 'Baños', 'M²', 'Estado', 'Captador'];
  const rows = properties.map(p => [
    p.id, p.title, p.price, p.location, p.beds, p.baths, p.sqm, p.status, p.captador
  ]);
  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventario_riv_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
const AI_MIN_WORDS = 3;
// Tiempo de espera tras el último keystroke antes de llamar a Gemini
const AI_DEBOUNCE_MS = 700;

export default function Inventario() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { properties } = useData();
  const { isAdmin } = useAuth();

  const [searchQuery, setSearchQuery]       = useState(searchParams.get('q') ?? '');
  const [activeFilter, setActiveFilter]     = useState('Todas');
  const [aiFilters, setAiFilters]           = useState<AIFilters | null>(null);
  const [isAILoading, setIsAILoading]       = useState(false);
  const [aiError, setAiError]               = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determina si la query tiene suficientes palabras para disparar IA
  const shouldUseAI = (q: string) =>
    q.trim().split(/\s+/).filter(Boolean).length >= AI_MIN_WORDS;

  // ─── Handler del input de búsqueda ─────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setAiError(false);

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
  }, []);

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
  }, []);

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

  const isAIActive = !!aiFilters && !isAILoading && !!searchQuery.trim();

  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content">

      {/* HEADER */}
      <header className="bg-white px-4 pt-6 pb-3 sticky top-0 z-30 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Inventario</h1>
            <p className="text-xs text-gray-400 mt-0.5">{filteredProperties.length} inmuebles encontrados</p>
          </div>
          <button
            onClick={() => exportToCSV(filteredProperties)}
            className="flex items-center gap-1.5 px-3 py-2 bg-vinotinto/10 text-vinotinto rounded-xl text-xs font-bold hover:bg-vinotinto/20 transition-colors"
          >
            <Download size={14} />
            Exportar
          </button>
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
            💡 Escribe 3 o más palabras para activar la búsqueda con IA
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
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 text-sm font-bold rounded-full whitespace-nowrap border transition-all ${
              activeFilter === f
                ? 'bg-vinotinto text-white border-vinotinto shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:border-vinotinto/40'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* LISTADO */}
      <div className="px-4 pb-28 space-y-4">
        {filteredProperties.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 mt-2">
            <Search className="mx-auto text-gray-300 mb-3" size={44} />
            <p className="text-gray-500 font-semibold">Sin resultados</p>
            <p className="text-sm text-gray-400 mt-1">
              {isAIActive ? 'La IA no encontró propiedades con esos criterios.' : 'Intenta con otra búsqueda o filtro'}
            </p>
            {isAIActive && (
              <button
                onClick={handleClear}
                className="mt-3 text-xs text-vinotinto font-bold underline underline-offset-2"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          filteredProperties.map((prop) => (
            <div
              key={prop.id}
              onClick={() => router.push(`/inventario/${prop.id}`)}
              className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
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

                <div className="flex items-center text-xs text-gray-500 mb-3">
                  <MapPin size={12} className="mr-1 text-vinotinto/60" />
                  {prop.location}
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
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => router.push('/inventario/registro')}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom)+1rem)] right-5 w-14 h-14 bg-vinotinto text-white rounded-full flex items-center justify-center shadow-lg shadow-vinotinto/30 active:scale-90 transition-transform z-20"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
