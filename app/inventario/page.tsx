'use client';

import { useState, useMemo } from 'react';
import { MapPin, Bed, Bath, Maximize, Filter, Plus, Search, Download, X, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import type { Property } from '../context/DataContext';

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

const STATUS_FILTERS = ['Todas', 'Activa', 'Vendida', 'Suspendida'];

export default function Inventario() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { properties } = useData();
  const { isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [activeFilter, setActiveFilter] = useState('Todas');

  // Motor de búsqueda: filtra por título, ubicación y captador
  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return properties.filter(prop => {
      const matchesSearch = !q ||
        prop.title.toLowerCase().includes(q) ||
        prop.location.toLowerCase().includes(q) ||
        prop.captador.toLowerCase().includes(q) ||
        String(prop.price).includes(q) ||
        String(prop.beds).includes(q);
      const matchesFilter = activeFilter === 'Todas' || prop.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [properties, searchQuery, activeFilter]);

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

        {/* SEARCH BAR */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, zona, precio..."
            className="w-full pl-9 pr-9 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-vinotinto focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* FILTROS RÁPIDOS */}
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
            <p className="text-sm text-gray-400 mt-1">Intenta con otra búsqueda o filtro</p>
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
