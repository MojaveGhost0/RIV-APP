'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, User, X } from 'lucide-react';
import { normalize } from '../lib/searchEngine';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export default function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecciona una opción...',
  searchPlaceholder = 'Buscar...',
  label,
  required = false,
  className = '',
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find(o => o.value === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalize(query);
    return options.filter(
      o =>
        normalize(o.label).includes(q) ||
        (o.description && normalize(o.description).includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>{label} {required && '*'}</span>
          <span className="text-[10px] text-gray-400 font-normal">
            {options.length} {options.length === 1 ? 'disponible' : 'disponibles'}
          </span>
        </label>
      )}

      {/* Botón trigger del Combobox */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none font-medium text-gray-800 text-sm flex items-center justify-between transition-all hover:bg-white text-left"
      >
        <div className="flex items-center gap-2 truncate">
          <User size={16} className="text-vinotinto shrink-0" />
          <span className={selectedOption ? 'text-gray-900 font-semibold' : 'text-gray-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform shrink-0 ml-2 ${isOpen ? 'rotate-180 text-vinotinto' : ''}`}
        />
      </button>

      {/* Menú desplegable flotante con buscador integrado */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-100 bg-gray-50/70">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-vinotinto/30 focus:border-vinotinto bg-white text-gray-800 placeholder-gray-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400 font-medium">
                No se encontraron resultados para &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left p-3 transition-colors flex items-center justify-between text-xs group ${
                      isSelected
                        ? 'bg-vinotinto/10 text-vinotinto font-bold'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            isSelected ? 'bg-vinotinto text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {opt.description}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={14} className="text-vinotinto shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
