'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  MapPin, Check, ArrowRight, ArrowLeft, UserCheck, CheckCircle,
  Home, Building2, Store, Maximize2, TreePine, Briefcase, Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ImageUploader from '../../components/ImageUploader';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import {
  MARGARITA_LOCATIONS,
  PROPERTY_TYPES,
  type PropertyType,
} from '../../context/DataContext';

// ─── Icono por tipo ───────────────────────────────────────────────────────────
const TYPE_ICONS: Record<PropertyType, React.ReactNode> = {
  'Apartamento':     <Building2 size={18} />,
  'Casa / Quinta':   <Home size={18} />,
  'Townhouse':       <Layers size={18} />,
  'Penthouse':       <Maximize2 size={18} />,
  'Local Comercial': <Store size={18} />,
  'Oficina':         <Briefcase size={18} />,
  'Terreno':         <TreePine size={18} />,
};

// ─── Config de campos por tipo ────────────────────────────────────────────────
interface TypeConfig {
  label: string;
  showBeds: boolean;
  showBaths: boolean;
  showSqm: boolean;
  bedsLabel: string;
  sqmLabel: string;
  priceLabel: string;
  pricePlaceholder: string;
  sqmPlaceholder: string;
  amenities: string[];
  descriptionHint: string;
}

const TYPE_CONFIG: Record<PropertyType, TypeConfig> = {
  'Apartamento': {
    label: 'Apartamento',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'm²',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 55000',
    sqmPlaceholder: '85',
    amenities: [
      'Piscina', 'Planta Eléctrica', 'Pozo de Agua', 'Vigilancia 24/7',
      'Amoblado', 'Vista al Mar', 'Gimnasio', 'Ascensor', 'Estacionamiento Techado',
      'Área de BBQ', 'Jacuzzi', 'Baño de Visitas',
    ],
    descriptionHint: 'Describe piso, acabados, vista, áreas comunes...',
  },
  'Casa / Quinta': {
    label: 'Casa / Quinta',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'm² construidos',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 95000',
    sqmPlaceholder: '180',
    amenities: [
      'Piscina', 'Planta Eléctrica', 'Pozo de Agua', 'Vigilancia 24/7',
      'Amoblado', 'Vista al Mar', 'Estacionamiento Techado', 'Área de BBQ',
      'Jardín', 'Cuarto de Servicio', 'Depósito', 'Rancho / Palapa',
    ],
    descriptionHint: 'Describe el terreno, niveles, jardín, acabados, garaje...',
  },
  'Townhouse': {
    label: 'Townhouse',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'm²',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 75000',
    sqmPlaceholder: '140',
    amenities: [
      'Piscina', 'Planta Eléctrica', 'Vigilancia 24/7', 'Amoblado',
      'Vista al Mar', 'Área de BBQ', 'Estacionamiento Techado',
      'Terraza Privada', 'Depósito',
    ],
    descriptionHint: 'Indica niveles, distribución, áreas del conjunto...',
  },
  'Penthouse': {
    label: 'Penthouse',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'm² (incluye terraza)',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 180000',
    sqmPlaceholder: '280',
    amenities: [
      'Terraza Privada', 'Jacuzzi', 'Vista al Mar', 'Ascensor Privado',
      'Piscina', 'Planta Eléctrica', 'Vigilancia 24/7', 'Amoblado',
      'Estacionamiento Techado', 'Gimnasio',
    ],
    descriptionHint: 'Describe vista panorámica, terraza, jacuzzi, acceso...',
  },
  'Local Comercial': {
    label: 'Local Comercial',
    showBeds: false, showBaths: true, showSqm: true,
    bedsLabel: '',
    sqmLabel: 'm²',
    priceLabel: 'Precio de venta / Alquiler (USD)',
    pricePlaceholder: 'Ej: 35000',
    sqmPlaceholder: '60',
    amenities: [
      'Aire Acondicionado', 'Vitrinas', 'A pie de calle',
      'Almacén / Depósito', 'Estacionamiento', 'Planta Eléctrica',
      'Baño de Visitas', 'Área de Oficinas',
    ],
    descriptionHint: 'Describe el uso actual, tráfico de la zona, acceso vehicular...',
  },
  'Oficina': {
    label: 'Oficina',
    showBeds: false, showBaths: true, showSqm: true,
    bedsLabel: '',
    sqmLabel: 'm²',
    priceLabel: 'Precio de venta / Alquiler (USD)',
    pricePlaceholder: 'Ej: 28000',
    sqmPlaceholder: '45',
    amenities: [
      'Aire Acondicionado', 'Ascensor', 'Estacionamiento', 'Vigilancia 24/7',
      'Planta Eléctrica', 'Sala de Reuniones', 'Área de Recepción',
    ],
    descriptionHint: 'Número de cubículos, sala de reuniones, piso del edificio...',
  },
  'Terreno': {
    label: 'Terreno',
    showBeds: false, showBaths: false, showSqm: true,
    bedsLabel: '',
    sqmLabel: 'm² del terreno',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 25000',
    sqmPlaceholder: '500',
    amenities: [
      'Frente de Carretera', 'Escritura Limpia', 'Servicios Públicos',
      'Vista al Mar', 'Agua Propia', 'Urbanizado',
    ],
    descriptionHint: 'Describe la topografía, uso de suelo, frente, fondo, linderos...',
  },
};

// ─── Formateo de precio ───────────────────────────────────────────────────────
function formatPriceDisplay(val: string): string {
  const num = parseInt(val.replace(/\D/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('es-VE');
}

export default function RegistroPropiedad() {
  const router = useRouter();
  const { addProperty } = useData();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Tipo seleccionado
  const [selectedType, setSelectedType] = useState<PropertyType>('Apartamento');
  const config = useMemo(() => TYPE_CONFIG[selectedType], [selectedType]);

  const [formData, setFormData] = useState({
    titulo: '',
    precio: '',
    habitaciones: '',
    banos: '',
    area: '',
    descripcion: '',
    ubicacion: '',
    imagenes: [] as string[],
    status: 'Activa',
    amenities: [] as string[],
  });

  // Ubicación custom dropdown
  const [locQuery, setLocQuery]     = useState('');
  const [locOpen, setLocOpen]       = useState(false);
  const locRef                       = useRef<HTMLDivElement>(null);

  // Filtrar ubicaciones según lo que escribe
  const filteredLocs = useMemo(() => {
    const q = locQuery.toLowerCase().trim();
    if (!q) return MARGARITA_LOCATIONS.slice(0, 8);
    return MARGARITA_LOCATIONS.filter(l => l.toLowerCase().includes(q)).slice(0, 8);
  }, [locQuery]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locRef.current && !locRef.current.contains(e.target as Node)) {
        setLocOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectLocation = (loc: string) => {
    setFormData(prev => ({ ...prev, ubicacion: loc }));
    setLocQuery(loc);
    setLocOpen(false);
  };

  const handleTypeChange = (t: PropertyType) => {
    setSelectedType(t);
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter(a => TYPE_CONFIG[t].amenities.includes(a)),
      habitaciones: TYPE_CONFIG[t].showBeds ? prev.habitaciones : '',
      banos: TYPE_CONFIG[t].showBaths ? prev.banos : '',
    }));
  };

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => {
      const isSelected = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: isSelected
          ? prev.amenities.filter(a => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  const handleUploadComplete = (urls: string[]) => {
    setFormData(prev => ({ ...prev, imagenes: urls }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const canProceed = () => {
    if (step === 1) return formData.titulo.trim() && formData.precio && formData.ubicacion.trim();
    if (step === 3) return formData.imagenes.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (formData.imagenes.length === 0) {
      alert('Por favor sube al menos una foto de la propiedad.');
      return;
    }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 800));

    const newId = addProperty({
      title: formData.titulo,
      price: Number(formData.precio.replace(/\D/g, '')),
      location: formData.ubicacion,
      beds: Number(formData.habitaciones) || 0,
      baths: Number(formData.banos) || 0,
      sqm: Number(formData.area) || 0,
      description: formData.descripcion,
      image: formData.imagenes[0],
      images: formData.imagenes,
      status: formData.status,
      captador: user?.nombre ?? 'Asesor',
      amenities: formData.amenities,
      propertyType: selectedType,
    });

    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(() => router.push(`/inventario/${newId}`), 1500);
  };

  // ─── Pantalla de éxito ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800 mb-2">¡Inmueble Publicado!</h2>
        <p className="text-sm text-gray-500">Ya está visible en el inventario de toda la agencia.</p>
        <p className="text-xs text-gray-400 mt-3">Redirigiendo al detalle...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 pt-4 mb-4">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          className="p-2 -ml-2 text-gray-500 hover:text-vinotinto transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Registrar Inmueble</h1>
        <div className="w-8" />
      </header>

      {/* ── TABS DE TIPO ─────────────────────────────────── */}
      {/* Extienden de borde a borde para que el scroll funcione */}
      <div className="mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5 px-4">
          Tipo de propiedad
        </p>
        <div className="relative">
          {/* Fade derecho para indicar que hay más */}
          <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none z-10" />
          <div
            className="flex gap-2 overflow-x-auto px-4 pb-2"
            style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {PROPERTY_TYPES.map((type) => {
              const active = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-vinotinto text-white border-vinotinto shadow-md shadow-vinotinto/20'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-vinotinto/40'
                  }`}
                >
                  {TYPE_ICONS[type]}
                  <span>{type}</span>
                </button>
              );
            })}
            {/* Spacer final para que el último tab no quede tapado por el fade */}
            <div className="flex-shrink-0 w-8" />
          </div>
        </div>
      </div>

      {/* Resto con padding lateral normal */}
      <div className="px-4">

      {/* STEPPER */}
      <div className="flex justify-between items-center mb-6 relative">
        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full overflow-hidden">
          <div
            className="h-full bg-vinotinto transition-all duration-500"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
              step > i
                ? 'bg-vinotinto text-white scale-90'
                : step === i
                ? 'bg-vinotinto text-white ring-4 ring-vinotinto/20'
                : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            {step > i ? <Check size={16} /> : i}
          </div>
        ))}
      </div>

      {/* FORMULARIO */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">

        {/* ASESOR CAPTADOR */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl mb-5">
          <UserCheck className="text-vinotinto shrink-0" size={18} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Captado por</p>
            <p className="text-sm font-bold text-gray-800">{user?.nombre ?? 'Asesor'}</p>
          </div>
        </div>

        {/* ── PASO 1: DATOS BÁSICOS ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-vinotinto mb-1">📋 Datos Básicos</h2>
            <p className="text-xs text-gray-400 mb-4">
              Tipo seleccionado: <span className="font-bold text-gray-600">{selectedType}</span>
            </p>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título del Inmueble *
              </label>
              <input
                type="text" name="titulo" value={formData.titulo}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none"
                placeholder={`Ej: ${selectedType} en Pampatar`}
              />
            </div>

            {/* Ubicación — dropdown custom */}
            <div ref={locRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={13} className="inline mr-1 text-vinotinto" />
                Ubicación *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locQuery || formData.ubicacion}
                  onChange={e => {
                    const v = e.target.value;
                    setLocQuery(v);
                    setFormData(prev => ({ ...prev, ubicacion: v }));
                    setLocOpen(true);
                  }}
                  onFocus={() => setLocOpen(true)}
                  className="w-full p-3 pr-10 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none"
                  placeholder="Escribe o selecciona una zona..."
                  autoComplete="off"
                />
                <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-vinotinto/40 pointer-events-none" />
              </div>

              {/* Dropdown de sugerencias */}
              {locOpen && filteredLocs.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {filteredLocs.map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onMouseDown={() => selectLocation(loc)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-vinotinto/5 transition-colors flex items-center gap-2 border-b border-gray-50 last:border-0 ${
                          formData.ubicacion === loc ? 'text-vinotinto font-semibold bg-vinotinto/5' : 'text-gray-700'
                        }`}
                      >
                        <MapPin size={12} className="text-vinotinto/40 shrink-0" />
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Precio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {config.priceLabel} *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                <input
                  type="text"
                  name="precio"
                  inputMode="numeric"
                  value={formData.precio ? formatPriceDisplay(formData.precio) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, precio: raw }));
                  }}
                  className="w-full pl-7 pr-14 p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none"
                  placeholder={config.pricePlaceholder}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-bold">USD</span>
              </div>
              {formData.precio && parseInt(formData.precio) > 0 && (
                <p className="text-[10px] text-vinotinto font-semibold mt-1">
                  = ${parseInt(formData.precio).toLocaleString('es-VE')} USD
                </p>
              )}
            </div>

            {/* m², Habs., Baños — dinámico según tipo */}
            <div className={`grid gap-3 ${
              config.showBeds && config.showBaths ? 'grid-cols-3'
              : config.showBaths ? 'grid-cols-2'
              : 'grid-cols-1'
            }`}>
              {/* m² siempre visible */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{config.sqmLabel}</label>
                <input
                  type="number" name="area" value={formData.area}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-1 focus:ring-vinotinto outline-none"
                  placeholder={config.sqmPlaceholder}
                />
                {formData.area && parseInt(formData.area) > 0 && (
                  <p className="text-[10px] text-gray-400 text-center mt-0.5">
                    ≈ {Math.round(parseInt(formData.area) * 10.764)} ft²
                  </p>
                )}
              </div>

              {/* Habitaciones — solo si aplica */}
              {config.showBeds && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {config.bedsLabel}
                  </label>
                  <input
                    type="number" name="habitaciones" value={formData.habitaciones}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-1 focus:ring-vinotinto outline-none"
                    placeholder="3"
                  />
                </div>
              )}

              {/* Baños — solo si aplica */}
              {config.showBaths && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Baños</label>
                  <input
                    type="number" name="banos" value={formData.banos}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-1 focus:ring-vinotinto outline-none"
                    placeholder="2"
                  />
                </div>
              )}
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                name="status" value={formData.status} onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none bg-white"
              >
                <option value="Activa">✅ Activa</option>
                <option value="Suspendida">⏸ Suspendida</option>
                <option value="Vendida">✔️ Vendida</option>
              </select>
            </div>
          </div>
        )}

        {/* ── PASO 2: DESCRIPCIÓN Y COMODIDADES ─────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-vinotinto mb-4">📝 Descripción</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción detallada
              </label>
              <textarea
                name="descripcion" value={formData.descripcion}
                onChange={handleInputChange} rows={6}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none resize-none"
                placeholder={config.descriptionHint}
              />
              <p className="text-xs text-gray-400 mt-1">
                {formData.descripcion.length} caracteres · Una buena descripción atrae más clientes.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-vinotinto mb-1">✨ Comodidades</h2>
              <p className="text-xs text-gray-500 mb-3">
                Comodidades disponibles para <strong>{selectedType}</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {config.amenities.map(amenity => {
                  const isSelected = formData.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => handleAmenityToggle(amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-vinotinto text-white border-vinotinto shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-vinotinto/50'
                      }`}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 3: IMÁGENES ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-vinotinto mb-1">📸 Fotografías</h2>
            <p className="text-xs text-gray-500 mb-4">
              Las fotos se suben a Cloudinary. La primera será la foto de portada.
            </p>
            <ImageUploader onUploadComplete={handleUploadComplete} maxImages={10} />
            {formData.imagenes.length > 0 && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-green-800 text-xs flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500 shrink-0" />
                <span><strong>{formData.imagenes.length}</strong> foto(s) lista(s).</span>
              </div>
            )}
          </div>
        )}

        {/* ── PASO 4: REVISIÓN ──────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-vinotinto mb-4">✅ Revisar y Publicar</h2>

            {/* Badge tipo */}
            <div className="flex items-center gap-2 p-3 bg-vinotinto/5 border border-vinotinto/15 rounded-xl">
              <span className="text-vinotinto">{TYPE_ICONS[selectedType]}</span>
              <span className="text-sm font-bold text-vinotinto">{selectedType}</span>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Título',        value: formData.titulo || '—' },
                { label: 'Ubicación',     value: formData.ubicacion || '—' },
                { label: 'Precio',        value: formData.precio ? `$${parseInt(formData.precio).toLocaleString('es-VE')} USD` : '—' },
                {
                  label: 'Características',
                  value: [
                    formData.area ? `${formData.area} m²` : null,
                    config.showBeds && formData.habitaciones ? `${formData.habitaciones} hab` : null,
                    config.showBaths && formData.banos ? `${formData.banos} baños` : null,
                  ].filter(Boolean).join(' · ') || '—'
                },
                { label: 'Estado',        value: formData.status },
                { label: 'Fotos',         value: `${formData.imagenes.length} imagen(es)` },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-800 text-right max-w-[60%]">{item.value}</span>
                </div>
              ))}
              <div className="py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 block mb-1">Comodidades</span>
                <span className="text-sm font-semibold text-gray-800">
                  {formData.amenities.length > 0 ? formData.amenities.join(', ') : 'Ninguna seleccionada'}
                </span>
              </div>
            </div>

            {formData.imagenes.length === 0 && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700 text-sm">
                ⚠️ Debes subir al menos una foto en el paso 3.
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Atrás
          </button>
        )}

        {step < totalSteps ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className={`flex-[2] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
              canProceed()
                ? 'bg-vinotinto text-white active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Siguiente <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || formData.imagenes.length === 0}
            className="flex-[2] py-3.5 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-60"
          >
            {isSubmitting ? 'Guardando...' : <>Publicar Inmueble <Check size={18} /></>}
          </button>
        )}
      </div>
      </div>{/* /px-4 wrapper */}
    </div>
  );
}
