'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  MapPin, Check, ArrowRight, ArrowLeft, UserCheck, CheckCircle,
  Home, Building2, Store, Maximize2, TreePine, Briefcase, Layers,
  Phone, User, CircleDollarSign, CreditCard, AlertTriangle, Info,
  Search, ChevronDown, ChevronUp, Plus, Users, X, CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ImageUploader from '../../components/ImageUploader';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { normalize } from '../../lib/searchEngine';
import {
  MARGARITA_LOCATIONS,
  PROPERTY_TYPES,
  type PropertyType,
} from '../../context/DataContext';

// â”€â”€â”€ Icono por tipo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TYPE_ICONS: Record<PropertyType, React.ReactNode> = {
  'Apartamento':     <Building2 size={18} />,
  'Casa / Quinta':   <Home size={18} />,
  'Townhouse':       <Layers size={18} />,
  'Penthouse':       <Maximize2 size={18} />,
  'Local Comercial': <Store size={18} />,
  'Oficina':         <Briefcase size={18} />,
  'Terreno':         <TreePine size={18} />,
};

// â”€â”€â”€ Config de campos por tipo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    sqmLabel: 'mÂ²',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 55000',
    sqmPlaceholder: '85',
    amenities: [
      'Piscina', 'Planta ElÃ©ctrica', 'Pozo de Agua', 'Vigilancia 24/7',
      'Amoblado', 'Vista al Mar', 'Gimnasio', 'Ascensor', 'Estacionamiento Techado',
      'Ãrea de BBQ', 'Jacuzzi', 'BaÃ±o de Visitas',
    ],
    descriptionHint: 'Describe piso, acabados, vista, Ã¡reas comunes...',
  },
  'Casa / Quinta': {
    label: 'Casa / Quinta',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'mÂ² construidos',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 95000',
    sqmPlaceholder: '180',
    amenities: [
      'Piscina', 'Planta ElÃ©ctrica', 'Pozo de Agua', 'Vigilancia 24/7',
      'Amoblado', 'Vista al Mar', 'Estacionamiento Techado', 'Ãrea de BBQ',
      'JardÃ­n', 'Cuarto de Servicio', 'DepÃ³sito', 'Rancho / Palapa',
    ],
    descriptionHint: 'Describe el terreno, niveles, jardÃ­n, acabados, garaje...',
  },
  'Townhouse': {
    label: 'Townhouse',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'mÂ²',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 75000',
    sqmPlaceholder: '140',
    amenities: [
      'Piscina', 'Planta ElÃ©ctrica', 'Vigilancia 24/7', 'Amoblado',
      'Vista al Mar', 'Ãrea de BBQ', 'Estacionamiento Techado',
      'Terraza Privada', 'DepÃ³sito',
    ],
    descriptionHint: 'Indica niveles, distribuciÃ³n, Ã¡reas del conjunto...',
  },
  'Penthouse': {
    label: 'Penthouse',
    showBeds: true, showBaths: true, showSqm: true,
    bedsLabel: 'Habitaciones',
    sqmLabel: 'mÂ² (incluye terraza)',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 180000',
    sqmPlaceholder: '280',
    amenities: [
      'Terraza Privada', 'Jacuzzi', 'Vista al Mar', 'Ascensor Privado',
      'Piscina', 'Planta ElÃ©ctrica', 'Vigilancia 24/7', 'Amoblado',
      'Estacionamiento Techado', 'Gimnasio',
    ],
    descriptionHint: 'Describe vista panorÃ¡mica, terraza, jacuzzi, acceso...',
  },
  'Local Comercial': {
    label: 'Local Comercial',
    showBeds: false, showBaths: true, showSqm: true,
    bedsLabel: '',
    sqmLabel: 'mÂ²',
    priceLabel: 'Precio de venta / Alquiler (USD)',
    pricePlaceholder: 'Ej: 35000',
    sqmPlaceholder: '60',
    amenities: [
      'Aire Acondicionado', 'Vitrinas', 'A pie de calle',
      'AlmacÃ©n / DepÃ³sito', 'Estacionamiento', 'Planta ElÃ©ctrica',
      'BaÃ±o de Visitas', 'Ãrea de Oficinas',
    ],
    descriptionHint: 'Describe el uso actual, trÃ¡fico de la zona, acceso vehicular...',
  },
  'Oficina': {
    label: 'Oficina',
    showBeds: false, showBaths: true, showSqm: true,
    bedsLabel: '',
    sqmLabel: 'mÂ²',
    priceLabel: 'Precio de venta / Alquiler (USD)',
    pricePlaceholder: 'Ej: 28000',
    sqmPlaceholder: '45',
    amenities: [
      'Aire Acondicionado', 'Ascensor', 'Estacionamiento', 'Vigilancia 24/7',
      'Planta ElÃ©ctrica', 'Sala de Reuniones', 'Ãrea de RecepciÃ³n',
    ],
    descriptionHint: 'NÃºmero de cubÃ­culos, sala de reuniones, piso del edificio...',
  },
  'Terreno': {
    label: 'Terreno',
    showBeds: false, showBaths: false, showSqm: true,
    bedsLabel: '',
    sqmLabel: 'mÂ² del terreno',
    priceLabel: 'Precio de venta (USD)',
    pricePlaceholder: 'Ej: 25000',
    sqmPlaceholder: '500',
    amenities: [
      'Frente de Carretera', 'Escritura Limpia', 'Servicios PÃºblicos',
      'Vista al Mar', 'Agua Propia', 'Urbanizado',
    ],
    descriptionHint: 'Describe la topografÃ­a, uso de suelo, frente, fondo, linderos...',
  },
};

// â”€â”€â”€ Opciones de NegociaciÃ³n y Pago â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FORMAS_NEGOCIACION_PRESETS = [
  'Precio negociable',
  'Precio fijo (no negociable)',
  'Acepta financiamiento corto plazo',
  'Acepta permuta / vehÃ­culo',
  'Acepta inmueble menor valor',
  'Escucha ofertas razonables',
];

const METODOS_PAGO_PRESETS = [
  'Efectivo USD (Cash)',
  'Transferencia Zelle',
  'Cripto / USDT (Binance)',
  'Transferencia Internacional (USA/PanamÃ¡/Europa)',
  'Transferencia Nacional BolÃ­vares (Tasa BCV)',
  'DepÃ³sito en Cuenta Custodia USD',
];

// â”€â”€â”€ Formateo de precio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatPriceDisplay(val: string): string {
  const num = parseInt(val.replace(/\D/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('es-VE');
}

// â”€â”€â”€ Helpers de Propietarios Registrados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface RegisteredOwner {
  nombre: string;
  telefono: string;
  formasNegociacionTags: string[];
  formasNegociacionExtra: string;
  metodosPagoTags: string[];
  metodosPagoExtra: string;
  totalProperties: number;
  propertyTitles: string[];
}

function parseNegociacion(raw: string): { tags: string[]; extra: string } {
  if (!raw) return { tags: [], extra: '' };
  const tags: string[] = [];
  FORMAS_NEGOCIACION_PRESETS.forEach(preset => {
    if (raw.toLowerCase().includes(preset.toLowerCase())) {
      tags.push(preset);
    }
  });
  let extra = raw;
  FORMAS_NEGOCIACION_PRESETS.forEach(preset => {
    const reg = new RegExp(preset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    extra = extra.replace(reg, '');
  });
  extra = extra.replace(/^[.\s,;-]+|[.\s,;-]+$/g, '').trim();
  return { tags, extra };
}

function parseMetodosPago(raw: string): { tags: string[]; extra: string } {
  if (!raw) return { tags: [], extra: '' };
  const tags: string[] = [];
  METODOS_PAGO_PRESETS.forEach(preset => {
    if (raw.toLowerCase().includes(preset.toLowerCase())) {
      tags.push(preset);
    }
  });
  let extra = raw;
  METODOS_PAGO_PRESETS.forEach(preset => {
    const reg = new RegExp(preset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    extra = extra.replace(reg, '');
  });
  extra = extra.replace(/^[.\s,;-]+|[.\s,;-]+$/g, '').trim();
  return { tags, extra };
}

function extractPhoneFromText(text: string): string {
  if (!text) return '';
  const match = text.match(/(?:TelÃ©fono(?:\s*Propietario)?:\s*)([+0-9\s\-]{7,20})/i) ||
                text.match(/(\+?58\s*4\d{2}[\s\-]?\d{7}|04\d{2}[\s\-]?\d{7})/);
  if (!match) return '';
  return match[1].trim();
}

export default function RegistroPropiedad() {
  const router = useRouter();
  const { properties, crmLogs, addProperty, addCrmLog } = useData();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Propietarios Registrados y Selector
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [selectedOwner, setSelectedOwner] = useState<RegisteredOwner | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [showCustomizeTerms, setShowCustomizeTerms] = useState(false);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  // Tipo seleccionado
  const [selectedType, setSelectedType] = useState<PropertyType>('Apartamento');
  const config = useMemo(() => TYPE_CONFIG[selectedType], [selectedType]);

  const [formData, setFormData] = useState({
    // Inmueble
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

    // Propietario y NegociaciÃ³n
    propietarioNombre: '',
    propietarioTelefono: '',
    formasNegociacionTags: [] as string[],
    formasNegociacionExtra: '',
    metodosPagoTags: [] as string[],
    metodosPagoExtra: '',
  });

  // Directorio unificado de propietarios a partir de properties y crmLogs
  const registeredOwners = useMemo<RegisteredOwner[]>(() => {
    const map = new Map<string, RegisteredOwner>();

    properties.forEach(p => {
      const name = (p.propietarioNombre || '').trim();
      if (!name || name.length < 3) return;
      const key = normalize(name);

      const parsedNeg = parseNegociacion(p.formasNegociacion || '');
      const parsedPago = parseMetodosPago(p.metodosPago || '');

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          nombre: name,
          telefono: p.propietarioTelefono || '',
          formasNegociacionTags: parsedNeg.tags,
          formasNegociacionExtra: parsedNeg.extra,
          metodosPagoTags: parsedPago.tags,
          metodosPagoExtra: parsedPago.extra,
          totalProperties: 1,
          propertyTitles: p.title ? [p.title] : [],
        });
      } else {
        existing.totalProperties += 1;
        if (p.title && !existing.propertyTitles.includes(p.title)) {
          existing.propertyTitles.push(p.title);
        }
        if (!existing.telefono && p.propietarioTelefono) {
          existing.telefono = p.propietarioTelefono;
        }
        if (existing.formasNegociacionTags.length === 0 && parsedNeg.tags.length > 0) {
          existing.formasNegociacionTags = parsedNeg.tags;
          existing.formasNegociacionExtra = parsedNeg.extra;
        }
        if (existing.metodosPagoTags.length === 0 && parsedPago.tags.length > 0) {
          existing.metodosPagoTags = parsedPago.tags;
          existing.metodosPagoExtra = parsedPago.extra;
        }
      }
    });

    (crmLogs || []).forEach(log => {
      const name = (log.cliente || '').trim();
      if (!name || name.length < 3) return;
      const key = normalize(name);

      const note = log.notas || '';
      const phone = extractPhoneFromText(note);
      const negMatch = note.match(/Formas de NegociaciÃ³n:\s*([^\n]+)/i);
      const pagoMatch = note.match(/MÃ©todos de Pago(?: Aceptados)?:\s*([^\n]+)/i);
      const parsedNeg = parseNegociacion(negMatch ? negMatch[1].trim() : '');
      const parsedPago = parseMetodosPago(pagoMatch ? pagoMatch[1].trim() : '');

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          nombre: name,
          telefono: phone,
          formasNegociacionTags: parsedNeg.tags,
          formasNegociacionExtra: parsedNeg.extra,
          metodosPagoTags: parsedPago.tags,
          metodosPagoExtra: parsedPago.extra,
          totalProperties: 0,
          propertyTitles: [],
        });
      } else {
        if (!existing.telefono && phone) existing.telefono = phone;
        if (existing.formasNegociacionTags.length === 0 && parsedNeg.tags.length > 0) {
          existing.formasNegociacionTags = parsedNeg.tags;
          existing.formasNegociacionExtra = parsedNeg.extra;
        }
        if (existing.metodosPagoTags.length === 0 && parsedPago.tags.length > 0) {
          existing.metodosPagoTags = parsedPago.tags;
          existing.metodosPagoExtra = parsedPago.extra;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [properties, crmLogs]);

  // Si no hay propietarios registrados, el modo inicial es 'new'
  useEffect(() => {
    if (registeredOwners.length === 0) {
      setOwnerMode('new');
    }
  }, [registeredOwners.length]);

  // Cerrar dropdown de propietarios al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
        setOwnerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Propietarios filtrados por bÃºsqueda
  const filteredOwners = useMemo(() => {
    const q = normalize(ownerSearchQuery.trim());
    if (!q) return registeredOwners;
    return registeredOwners.filter(o => {
      const normName = normalize(o.nombre);
      const rawPhone = o.telefono.replace(/\D/g, '');
      const qDigits = q.replace(/\D/g, '');
      const matchesName = normName.includes(q);
      const matchesPhone = qDigits.length > 0 && rawPhone.includes(qDigits);
      return matchesName || matchesPhone;
    });
  }, [registeredOwners, ownerSearchQuery]);

  // Manejadores de selecciÃ³n de propietario
  const handleSelectExistingOwner = (owner: RegisteredOwner) => {
    setSelectedOwner(owner);
    setOwnerDropdownOpen(false);
    setOwnerSearchQuery('');
    
    // Asegurar tags de negociaciÃ³n y pago por defecto si estaban vacÃ­os
    const negTags = owner.formasNegociacionTags.length > 0
      ? owner.formasNegociacionTags
      : (owner.formasNegociacionExtra ? [] : ['Precio negociable']);
      
    const pagoTags = owner.metodosPagoTags.length > 0
      ? owner.metodosPagoTags
      : (owner.metodosPagoExtra ? [] : ['Efectivo USD (Cash)']);

    setFormData(prev => ({
      ...prev,
      propietarioNombre: owner.nombre,
      propietarioTelefono: owner.telefono || prev.propietarioTelefono,
      formasNegociacionTags: negTags,
      formasNegociacionExtra: owner.formasNegociacionExtra || '',
      metodosPagoTags: pagoTags,
      metodosPagoExtra: owner.metodosPagoExtra || '',
    }));
  };

  const handleDeselectOwner = () => {
    setSelectedOwner(null);
    setOwnerSearchQuery('');
    setShowCustomizeTerms(false);
    setFormData(prev => ({
      ...prev,
      propietarioNombre: '',
      propietarioTelefono: '',
      formasNegociacionTags: [],
      formasNegociacionExtra: '',
      metodosPagoTags: [],
      metodosPagoExtra: '',
    }));
  };

  const handleSwitchToNew = () => {
    setOwnerMode('new');
    setSelectedOwner(null);
    setShowCustomizeTerms(false);
    setFormData(prev => ({
      ...prev,
      propietarioNombre: '',
      propietarioTelefono: '',
      formasNegociacionTags: [],
      formasNegociacionExtra: '',
      metodosPagoTags: [],
      metodosPagoExtra: '',
    }));
  };

  const handleSwitchToExisting = () => {
    setOwnerMode('existing');
    setShowCustomizeTerms(false);
  };

  // UbicaciÃ³n custom dropdown
  const [locQuery, setLocQuery] = useState('');
  const [locOpen, setLocOpen] = useState(false);
  const locRef = useRef<HTMLDivElement>(null);

  // Filtrar ubicaciones segÃºn lo que escribe
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

  // â”€â”€â”€ DetecciÃ³n de duplicados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const duplicateProperty = useMemo(() => {
    if (!formData.titulo.trim() || !formData.ubicacion.trim()) return null;
    const normTitle = normalize(formData.titulo);
    const normLoc = normalize(formData.ubicacion);
    const rawPhone = formData.propietarioTelefono.replace(/\D/g, '');
    const normPhone = rawPhone.length >= 7 ? rawPhone.slice(-10) : '';

    return properties.find(p => {
      const pTitle = normalize(p.title);
      const pLoc = normalize(p.location);
      const pRawPhone = (p.propietarioTelefono ?? '').replace(/\D/g, '');
      const pPhone = pRawPhone.length >= 7 ? pRawPhone.slice(-10) : '';

      // Criterio 1: Mismo tÃ­tulo y misma ubicaciÃ³n
      const sameTitleAndLoc = pTitle === normTitle && pLoc === normLoc;
      // Criterio 2: Mismo telÃ©fono de propietario y misma ubicaciÃ³n o tÃ­tulo
      const samePhoneAndLoc = normPhone.length >= 7 && pPhone === normPhone && (pLoc === normLoc || pTitle === normTitle);

      return sameTitleAndLoc || samePhoneAndLoc;
    });
  }, [formData.titulo, formData.ubicacion, formData.propietarioTelefono, properties]);

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

  const handleNegociacionToggle = (tag: string) => {
    setFormData(prev => {
      const isSelected = prev.formasNegociacionTags.includes(tag);
      return {
        ...prev,
        formasNegociacionTags: isSelected
          ? prev.formasNegociacionTags.filter(t => t !== tag)
          : [...prev.formasNegociacionTags, tag],
      };
    });
  };

  const handleMetodoPagoToggle = (tag: string) => {
    setFormData(prev => {
      const isSelected = prev.metodosPagoTags.includes(tag);
      return {
        ...prev,
        metodosPagoTags: isSelected
          ? prev.metodosPagoTags.filter(t => t !== tag)
          : [...prev.metodosPagoTags, tag],
      };
    });
  };

  const handleUploadComplete = (urls: string[]) => {
    setFormData(prev => ({ ...prev, imagenes: urls }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (['area', 'habitaciones', 'banos'].includes(name)) {
      if (value.startsWith('-')) return;
      const num = Number(value);
      if (!isNaN(num) && num < 0) return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // â”€â”€â”€ ValidaciÃ³n estricta ("a juro llenar toda la info") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const stepValidation = useMemo(() => {
    // Paso 1: Datos del Inmueble
    const step1Valid = Boolean(
      formData.titulo.trim().length >= 4 &&
      formData.ubicacion.trim().length >= 3 &&
      parseInt(formData.precio.replace(/\D/g, '')) > 0 &&
      parseInt(formData.area) > 0 &&
      (!config.showBeds || (formData.habitaciones !== '' && parseInt(formData.habitaciones) >= 0)) &&
      (!config.showBaths || (formData.banos !== '' && parseInt(formData.banos) >= 0))
    );

    // Paso 2: Detalles y Comodidades
    const step2Valid = Boolean(
      formData.descripcion.trim().length >= 15 &&
      formData.amenities.length >= 1
    );

    // Paso 3: Propietario y NegociaciÃ³n
    const phoneDigits = formData.propietarioTelefono.replace(/\D/g, '');
    const hasNegociacion = formData.formasNegociacionTags.length > 0 || formData.formasNegociacionExtra.trim().length > 0;
    const hasMetodoPago = formData.metodosPagoTags.length > 0 || formData.metodosPagoExtra.trim().length > 0;
    const step3Valid = selectedOwner
      ? Boolean(formData.propietarioNombre.trim().length >= 3 && phoneDigits.length >= 7)
      : Boolean(
          formData.propietarioNombre.trim().length >= 3 &&
          phoneDigits.length >= 7 &&
          hasNegociacion &&
          hasMetodoPago
        );

    // Paso 4: Fotos
    const step4Valid = formData.imagenes.length > 0;

    return {
      step1: step1Valid,
      step2: step2Valid,
      step3: step3Valid,
      step4: step4Valid,
      allValid: step1Valid && step2Valid && step3Valid && step4Valid && !duplicateProperty,
    };
  }, [formData, config, duplicateProperty, selectedOwner]);

  const canProceed = () => {
    if (step === 1) return stepValidation.step1;
    if (step === 2) return stepValidation.step2;
    if (step === 3) return stepValidation.step3;
    if (step === 4) return stepValidation.step4;
    return stepValidation.allValid;
  };

  const handleSubmit = async () => {
    // 1. VerificaciÃ³n de duplicados
    if (duplicateProperty) {
      setSubmitError(`No es posible registrar: Ya existe un inmueble duplicado ("${duplicateProperty.title}" en ${duplicateProperty.location}).`);
      return;
    }

    // 2. VerificaciÃ³n estricta de campos obligatorios
    if (!stepValidation.allValid) {
      setSubmitError('Debes completar toda la informaciÃ³n requerida en cada uno de los pasos antes de publicar.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const formasNegociacionFinal = [
        ...formData.formasNegociacionTags,
        formData.formasNegociacionExtra.trim(),
      ].filter(Boolean).join('. ');

      const metodosPagoFinal = [
        ...formData.metodosPagoTags,
        formData.metodosPagoExtra.trim(),
      ].filter(Boolean).join('. ');

      // Guardar propiedad en inventario
      const newId = await addProperty({
        title: formData.titulo.trim(),
        price: Number(formData.precio.replace(/\D/g, '')),
        location: formData.ubicacion.trim(),
        beds: Number(formData.habitaciones) || 0,
        baths: Number(formData.banos) || 0,
        sqm: Number(formData.area) || 0,
        description: formData.descripcion.trim(),
        image: formData.imagenes[0],
        images: formData.imagenes,
        status: formData.status,
        captador: user?.nombre ?? 'Asesor',
        amenities: formData.amenities,
        propertyType: selectedType,
        propietarioNombre: formData.propietarioNombre.trim(),
        propietarioTelefono: formData.propietarioTelefono.trim(),
        formasNegociacion: formasNegociacionFinal,
        metodosPago: metodosPagoFinal,
      });

      // Entrada automÃ¡tica al CRM
      try {
        await addCrmLog({
          cliente: formData.propietarioNombre.trim(),
          asesor: user?.nombre ?? 'Asesor',
          tipo_interaccion: 'CaptaciÃ³n de Inmueble',
          notas: `CaptaciÃ³n de Inmueble: ${formData.titulo.trim()} (${selectedType}) en ${formData.ubicacion.trim()}`,
        });
      } catch (crmErr) {
        console.warn('Aviso: no se pudo sincronizar de inmediato el log de CRM:', crmErr);
      }

      setIsSubmitting(false);
      setSubmitted(true);
      showToast('Inmueble publicado con éxito. ¡Tus cambios han sido guardados!', 'success');
      setTimeout(() => router.push(`/inventario/${newId}`), 1500);
    } catch (err: any) {
      console.error('Error al registrar inmueble:', err);
      setIsSubmitting(false);
      const errMsg = err?.message || 'Error al guardar el inmueble. Revisa tu conexión.';
      setSubmitError(errMsg);
      showToast(errMsg, 'error');
    }
  };

  // â”€â”€â”€ Pantalla de Ã©xito â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-gray-50"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, delay: 0.1 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"
        >
          <CheckCircle size={40} className="text-green-500" />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Â¡Inmueble Publicado con Ã‰xito!</h2>
        <p className="text-sm text-gray-500 mb-2">
          Ya estÃ¡ disponible en el inventario y registrado automÃ¡ticamente en el <strong>CRM</strong>.
        </p>
        <p className="text-xs text-gray-400 mt-2">Redirigiendo a la ficha tÃ©cnica...</p>
      </motion.div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 pt-4 mb-3">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          className="p-2 -ml-2 text-gray-500 hover:text-vinotinto transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">Registrar Inmueble</h1>
          <p className="text-[11px] text-gray-400 font-medium">Paso {step} de {totalSteps}</p>
        </div>
        <div className="w-8" />
      </header>

      {/* â”€â”€ TABS DE TIPO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 px-4">
          Tipo de propiedad *
        </p>
        <div className="relative">
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
            <div className="flex-shrink-0 w-8" />
          </div>
        </div>
      </div>

      <div className="px-4">

      {/* STEPPER (5 PASOS) */}
      <div className="flex justify-between items-center mb-5 relative">
        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full overflow-hidden">
          <div
            className="h-full bg-vinotinto transition-all duration-500"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
        {[1, 2, 3, 4, 5].map((i) => {
          const stepNames = ['Inmueble', 'Detalles', 'Propietario', 'Fotos', 'RevisiÃ³n'];
          return (
            <div key={i} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  // Permitir ir a pasos anteriores libremente
                  if (i < step) setStep(i);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                  step > i
                    ? 'bg-vinotinto text-white scale-90'
                    : step === i
                    ? 'bg-vinotinto text-white ring-4 ring-vinotinto/20'
                    : 'bg-white text-gray-400 border border-gray-200'
                }`}
              >
                {step > i ? <Check size={14} /> : i}
              </button>
              <span className={`text-[9px] mt-1 font-semibold ${step === i ? 'text-vinotinto' : 'text-gray-400'}`}>
                {stepNames[i - 1]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ALERTA DE DUPLICADOS */}
      {duplicateProperty && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 shadow-sm"
        >
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-extrabold text-amber-800">Posible Inmueble Duplicado</p>
            <p className="mt-0.5">
              Ya existe registrado el inmueble <strong>&ldquo;{duplicateProperty.title}&rdquo;</strong> en {duplicateProperty.location} (Captador: {duplicateProperty.captador}). Modifica el tÃ­tulo o ubicaciÃ³n para evitar duplicar el inventario.
            </p>
          </div>
        </motion.div>
      )}

      {/* FORMULARIO */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">

        {/* ASESOR CAPTADOR */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl mb-5">
          <UserCheck className="text-vinotinto shrink-0" size={18} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Asesor Captador</p>
            <p className="text-sm font-bold text-gray-800">{user?.nombre ?? 'Asesor'}</p>
          </div>
        </div>

        {/* â”€â”€ CONTENIDO DEL FORMULARIO ANIMADO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
          >

            {/* â”€â”€ PASO 1: DATOS BÃSICOS DEL INMUEBLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <h2 className="text-base font-bold text-vinotinto flex items-center gap-1.5">
                    <Home size={18} /> 1. Datos del Inmueble
                  </h2>
                  <p className="text-xs text-gray-400">
                    Tipo actual: <span className="font-bold text-gray-700">{selectedType}</span>
                  </p>
                </div>

                {/* TÃ­tulo */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    TÃ­tulo del Inmueble *
                  </label>
                  <input
                    type="text" name="titulo" value={formData.titulo}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                    placeholder={`Ej: ${selectedType} en Pampatar con vista al mar`}
                  />
                  {formData.titulo.trim().length > 0 && formData.titulo.trim().length < 4 && (
                    <p className="text-[10px] text-red-500 mt-1">El tÃ­tulo debe tener al menos 4 caracteres.</p>
                  )}
                </div>

                {/* UbicaciÃ³n â€” dropdown custom */}
                <div ref={locRef} className="relative">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    <MapPin size={13} className="inline mr-1 text-vinotinto" />
                    UbicaciÃ³n en Margarita *
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
                      className="w-full p-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                      placeholder="Escribe o selecciona sector / urbanizaciÃ³n..."
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">
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
                      className="w-full pl-7 pr-14 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-semibold"
                      placeholder={config.pricePlaceholder}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">USD</span>
                  </div>
                </div>

                {/* mÂ², Habs., BaÃ±os */}
                <div className={`grid gap-3 ${
                  config.showBeds && config.showBaths ? 'grid-cols-3'
                  : config.showBaths ? 'grid-cols-2'
                  : 'grid-cols-1'
                }`}>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{config.sqmLabel} *</label>
                    <input
                      type="number" name="area" value={formData.area}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                      placeholder={config.sqmPlaceholder}
                      min="1"
                    />
                  </div>

                  {config.showBeds && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        {config.bedsLabel} *
                      </label>
                      <input
                        type="number" name="habitaciones" value={formData.habitaciones}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                        placeholder="3"
                        min="0"
                      />
                    </div>
                  )}

                  {config.showBaths && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">BaÃ±os *</label>
                      <input
                        type="number" name="banos" value={formData.banos}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                        placeholder="2"
                        min="0"
                      />
                    </div>
                  )}
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Estado de PublicaciÃ³n *</label>
                  <select
                    name="status" value={formData.status} onChange={handleInputChange}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none bg-white text-sm font-medium"
                  >
                    <option value="Activa">âœ… Activa</option>
                    <option value="Suspendida">â¸ Suspendida</option>
                    <option value="Vendida">âœ”ï¸ Vendida</option>
                  </select>
                </div>
              </div>
            )}

            {/* â”€â”€ PASO 2: DESCRIPCIÃ“N Y COMODIDADES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <h2 className="text-base font-bold text-vinotinto flex items-center gap-1.5">
                    <Layers size={18} /> 2. DescripciÃ³n y Comodidades
                  </h2>
                  <p className="text-xs text-gray-400">Describe el inmueble y selecciona sus atractivos principales.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    DescripciÃ³n Detallada *
                  </label>
                  <textarea
                    name="descripcion" value={formData.descripcion}
                    onChange={handleInputChange} rows={5}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none resize-none text-sm"
                    placeholder={config.descriptionHint}
                  />
                  <div className="flex justify-between items-center mt-1 text-[11px]">
                    <span className={formData.descripcion.trim().length >= 15 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                      {formData.descripcion.trim().length} caracteres (mÃ­nimo 15 obligatorios)
                    </span>
                    {formData.descripcion.trim().length < 15 && (
                      <span className="text-red-500 font-medium">Falta informaciÃ³n</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Comodidades del Inmueble * (Selecciona al menos 1)
                  </label>
                  <p className="text-[11px] text-gray-400 mb-2.5">
                    Seleccionadas: <strong className="text-vinotinto">{formData.amenities.length}</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {config.amenities.map(amenity => {
                      const isSelected = formData.amenities.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => handleAmenityToggle(amenity)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-vinotinto text-white border-vinotinto shadow-sm shadow-vinotinto/20 scale-105'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-vinotinto/50'
                          }`}
                        >
                          {isSelected ? 'âœ“ ' : '+ '}{amenity}
                        </button>
                      );
                    })}
                  </div>
                  {formData.amenities.length === 0 && (
                    <p className="text-[10px] text-red-500 mt-2">Debes seleccionar al menos una comodidad.</p>
                  )}
                </div>
              </div>
            )}

            {/* â”€â”€ PASO 3: DATOS DEL PROPIETARIO Y NEGOCIACIÃ“N (DESPLEGABLE / AUTO-LLENADO) â”€â”€ */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <h2 className="text-base font-bold text-vinotinto flex items-center gap-1.5">
                    <User size={18} /> 3. Propietario y NegociaciÃ³n
                  </h2>
                  <p className="text-xs text-gray-400">
                    Selecciona un propietario ya registrado en la agencia o registra uno nuevo.
                  </p>
                </div>

                {/* SELECTOR DE MODO: Propietario Existente vs Nuevo */}
                <div className="bg-gray-100/90 p-1 rounded-xl flex gap-1 border border-gray-200/80">
                  <button
                    type="button"
                    onClick={handleSwitchToExisting}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      ownerMode === 'existing'
                        ? 'bg-white text-vinotinto shadow-sm border border-vinotinto/20'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Search size={14} />
                    <span>Buscar Registrado</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      ownerMode === 'existing' ? 'bg-vinotinto/10 text-vinotinto' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {registeredOwners.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchToNew}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      ownerMode === 'new'
                        ? 'bg-white text-vinotinto shadow-sm border border-vinotinto/20'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Plus size={14} />
                    <span>+ Nuevo Propietario</span>
                  </button>
                </div>

                {/* â”€â”€ MODO 1: PROPIETARIO EXISTENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {ownerMode === 'existing' && (
                  <div className="space-y-4">
                    {/* CASO A: AÃºn no hay propietario seleccionado -> Desplegable de bÃºsqueda */}
                    {!selectedOwner ? (
                      <div className="space-y-3">
                        <div className="relative" ref={ownerDropdownRef}>
                          <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                            <span>Seleccionar Propietario Registrado *</span>
                            <span className="text-[11px] font-normal text-gray-400">
                              {filteredOwners.length} disponibles
                            </span>
                          </label>
                          <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={ownerSearchQuery}
                              onChange={e => {
                                setOwnerSearchQuery(e.target.value);
                                setOwnerDropdownOpen(true);
                              }}
                              onFocus={() => setOwnerDropdownOpen(true)}
                              placeholder="Escribe el nombre o telÃ©fono del propietario..."
                              className="w-full pl-9 pr-8 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setOwnerDropdownOpen(!ownerDropdownOpen)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <ChevronDown size={16} className={`transition-transform ${ownerDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {/* MenÃº Desplegable flotante */}
                          {ownerDropdownOpen && (
                            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-gray-100">
                              {filteredOwners.length > 0 ? (
                                filteredOwners.map(owner => (
                                  <button
                                    key={owner.nombre}
                                    type="button"
                                    onClick={() => handleSelectExistingOwner(owner)}
                                    className="w-full text-left p-3 hover:bg-vinotinto/5 transition-all flex items-center justify-between group"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-full bg-vinotinto/10 text-vinotinto font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-vinotinto group-hover:text-white transition-colors">
                                        {owner.nombre.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-gray-800 group-hover:text-vinotinto transition-colors">
                                          {owner.nombre}
                                        </p>
                                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                          <Phone size={10} className="text-gray-400" />
                                          {owner.telefono || 'Sin telÃ©fono guardado'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                                        {owner.totalProperties} {owner.totalProperties === 1 ? 'inmueble' : 'inmuebles'}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="p-4 text-center space-y-2">
                                  <p className="text-xs text-gray-500">
                                    No encontramos ningÃºn propietario registrado con &ldquo;{ownerSearchQuery}&rdquo;
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOwnerMode('new');
                                      setFormData(prev => ({ ...prev, propietarioNombre: ownerSearchQuery }));
                                      setOwnerDropdownOpen(false);
                                    }}
                                    className="text-xs text-vinotinto font-bold hover:underline inline-flex items-center gap-1"
                                  >
                                    <Plus size={13} /> Registrar &ldquo;{ownerSearchQuery}&rdquo; como nuevo cliente
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Listado rÃ¡pido de sugerencias si no se ha abierto el dropdown */}
                        {!ownerDropdownOpen && registeredOwners.length > 0 && (
                          <div className="bg-gray-50/80 border border-gray-200/60 rounded-xl p-3">
                            <p className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                              <Users size={12} className="text-vinotinto" /> Propietarios Registrados Recientemente
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {registeredOwners.slice(0, 5).map(o => (
                                <button
                                  key={o.nombre}
                                  type="button"
                                  onClick={() => handleSelectExistingOwner(o)}
                                  className="text-xs bg-white border border-gray-200 hover:border-vinotinto text-gray-700 hover:text-vinotinto font-medium px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span className="w-4 h-4 rounded-full bg-vinotinto/10 text-vinotinto text-[9px] font-bold flex items-center justify-center">
                                    {o.nombre.charAt(0).toUpperCase()}
                                  </span>
                                  <span>{o.nombre}</span>
                                  {o.totalProperties > 0 && (
                                    <span className="text-[10px] text-gray-400">({o.totalProperties})</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* CASO B: Propietario Seleccionado -> Ficha Confirmada con Auto-llenado */
                      <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border-2 border-emerald-400/80 rounded-2xl p-4 space-y-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-base shadow-sm">
                              {selectedOwner.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wide">
                                  <CheckCircle2 size={11} /> Propietario Registrado
                                </span>
                                {selectedOwner.totalProperties > 0 && (
                                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                    {selectedOwner.totalProperties} {selectedOwner.totalProperties === 1 ? 'inmueble' : 'inmuebles'}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base font-bold text-gray-900 mt-1">
                                {selectedOwner.nombre}
                              </h3>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleDeselectOwner}
                            className="text-xs font-bold text-gray-600 hover:text-vinotinto bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs hover:border-vinotinto/40 transition flex items-center gap-1"
                          >
                            <X size={13} /> Cambiar
                          </button>
                        </div>

                        {/* Datos cargados automÃ¡ticamente */}
                        <div className="bg-white rounded-xl p-3 border border-emerald-100 space-y-2 text-xs">
                          {/* TelÃ©fono */}
                          <div className="flex items-center justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-500 flex items-center gap-1 font-medium">
                              <Phone size={13} className="text-emerald-600" /> TelÃ©fono de Contacto:
                            </span>
                            {formData.propietarioTelefono.replace(/\D/g, '').length >= 7 ? (
                              <span className="font-bold text-emerald-800 font-mono">
                                {formData.propietarioTelefono}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="tel"
                                  name="propietarioTelefono"
                                  value={formData.propietarioTelefono}
                                  onChange={handleInputChange}
                                  placeholder="Ingresa telÃ©fono aquÃ­"
                                  className="p-1 border border-red-300 rounded text-xs font-mono"
                                />
                              </div>
                            )}
                          </div>

                          {/* Condiciones de NegociaciÃ³n */}
                          <div className="py-1 border-b border-gray-100">
                            <span className="text-gray-500 block text-[11px] mb-1 font-medium flex items-center gap-1">
                              <CircleDollarSign size={13} className="text-emerald-600" /> Formas de NegociaciÃ³n Registradas:
                            </span>
                            <div className="font-semibold text-gray-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/60">
                              {[...formData.formasNegociacionTags, formData.formasNegociacionExtra.trim()].filter(Boolean).join('. ') || 'Precio negociable'}
                            </div>
                          </div>

                          {/* MÃ©todos de Pago */}
                          <div className="py-1">
                            <span className="text-gray-500 block text-[11px] mb-1 font-medium flex items-center gap-1">
                              <CreditCard size={13} className="text-emerald-600" /> MÃ©todos de Pago Aceptados:
                            </span>
                            <div className="font-semibold text-gray-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/60">
                              {[...formData.metodosPagoTags, formData.metodosPagoExtra.trim()].filter(Boolean).join('. ') || 'Efectivo USD (Cash)'}
                            </div>
                          </div>
                        </div>

                        {/* AcordeÃ³n opcional para personalizar condiciones de este inmueble */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowCustomizeTerms(!showCustomizeTerms)}
                            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 transition"
                          >
                            {showCustomizeTerms ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {showCustomizeTerms ? 'Cerrar ajuste de condiciones' : 'Personalizar condiciones para este inmueble en particular (Opcional)'}
                          </button>

                          {showCustomizeTerms && (
                            <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-4">
                              {/* Formas de NegociaciÃ³n */}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                                  <CircleDollarSign size={14} className="text-vinotinto" />
                                  Formas de NegociaciÃ³n para este inmueble
                                </label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {FORMAS_NEGOCIACION_PRESETS.map(preset => {
                                    const active = formData.formasNegociacionTags.includes(preset);
                                    return (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleNegociacionToggle(preset)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                          active
                                            ? 'bg-vinotinto text-white border-vinotinto shadow-xs'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-vinotinto/40'
                                        }`}
                                      >
                                        {active ? 'âœ“ ' : '+ '}{preset}
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="text"
                                  name="formasNegociacionExtra"
                                  value={formData.formasNegociacionExtra}
                                  onChange={handleInputChange}
                                  placeholder="Condiciones adicionales..."
                                  className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs bg-white"
                                />
                              </div>

                              {/* MÃ©todos de Pago */}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                                  <CreditCard size={14} className="text-vinotinto" />
                                  MÃ©todos de Pago para este inmueble
                                </label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {METODOS_PAGO_PRESETS.map(preset => {
                                    const active = formData.metodosPagoTags.includes(preset);
                                    return (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleMetodoPagoToggle(preset)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                          active
                                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-500/40'
                                        }`}
                                      >
                                        {active ? 'âœ“ ' : '+ '}{preset}
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="text"
                                  name="metodosPagoExtra"
                                  value={formData.metodosPagoExtra}
                                  onChange={handleInputChange}
                                  placeholder="Detalles de pago adicionales..."
                                  className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-emerald-100/70 text-emerald-900 border border-emerald-300/60 rounded-xl p-2.5 flex items-center gap-2 text-xs font-medium">
                          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                          <span>Â¡Todo listo! No necesitas reescribir ningÃºn dato. Pulsa <strong>Siguiente</strong> para continuar.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* â”€â”€ MODO 2: NUEVO PROPIETARIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {ownerMode === 'new' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-900 text-xs">
                      <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Registrando Nuevo Cliente Propietario</p>
                        <p className="text-amber-800 text-[11px] mt-0.5">
                          Llena los datos a continuaciÃ³n. Este cliente quedarÃ¡ registrado en el CRM y podrÃ¡s seleccionarlo directamente en futuras captaciones.
                        </p>
                      </div>
                    </div>

                    {/* Nombre del Propietario */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nombre del Propietario *
                      </label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          name="propietarioNombre"
                          value={formData.propietarioNombre}
                          onChange={handleInputChange}
                          placeholder="Ej: Carlos Mendoza GÃ³mez"
                          className="w-full pl-9 pr-3 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm"
                        />
                      </div>
                      {formData.propietarioNombre.trim().length > 0 && formData.propietarioNombre.trim().length < 3 && (
                        <p className="text-[10px] text-red-500 mt-1">El nombre debe tener al menos 3 caracteres.</p>
                      )}
                    </div>

                    {/* TelÃ©fono del Propietario */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        TelÃ©fono del Propietario *
                      </label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          name="propietarioTelefono"
                          value={formData.propietarioTelefono}
                          onChange={handleInputChange}
                          placeholder="Ej: +58 414 1234567 / 0414 9876543"
                          className="w-full pl-9 pr-3 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-sm font-medium"
                        />
                      </div>
                      {formData.propietarioTelefono.replace(/\D/g, '').length > 0 && formData.propietarioTelefono.replace(/\D/g, '').length < 7 && (
                        <p className="text-[10px] text-red-500 mt-1">Ingresa un nÃºmero de telÃ©fono vÃ¡lido (mÃ­nimo 7 dÃ­gitos).</p>
                      )}
                    </div>

                    {/* Formas de NegociaciÃ³n */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <CircleDollarSign size={14} className="text-vinotinto" />
                        Formas de NegociaciÃ³n * (Selecciona opciones y/o describe)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {FORMAS_NEGOCIACION_PRESETS.map(preset => {
                          const active = formData.formasNegociacionTags.includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleNegociacionToggle(preset)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                active
                                  ? 'bg-vinotinto text-white border-vinotinto shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-vinotinto/40'
                              }`}
                            >
                              {active ? 'âœ“ ' : '+ '}{preset}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        name="formasNegociacionExtra"
                        value={formData.formasNegociacionExtra}
                        onChange={handleInputChange}
                        placeholder="Condiciones adicionales (ej: 50% inicial y 4 cuotas mensuales)..."
                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs"
                      />
                      {formData.formasNegociacionTags.length === 0 && !formData.formasNegociacionExtra.trim() && (
                        <p className="text-[10px] text-red-500 mt-1">Indica al menos una condiciÃ³n o forma de negociaciÃ³n.</p>
                      )}
                    </div>

                    {/* CÃ³mo puede aceptar el dinero de la negociaciÃ³n / MÃ©todos de pago */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <CreditCard size={14} className="text-vinotinto" />
                        Â¿CÃ³mo acepta el dinero de la negociaciÃ³n? * (MÃ©todos de Pago)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {METODOS_PAGO_PRESETS.map(preset => {
                          const active = formData.metodosPagoTags.includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleMetodoPagoToggle(preset)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                active
                                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-500/40'
                              }`}
                            >
                              {active ? 'âœ“ ' : '+ '}{preset}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        name="metodosPagoExtra"
                        value={formData.metodosPagoExtra}
                        onChange={handleInputChange}
                        placeholder="Detalles de pago (ej: Cuenta Zelle a nombre de titular o transferencia en PanamÃ¡)..."
                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto outline-none text-xs"
                      />
                      {formData.metodosPagoTags.length === 0 && !formData.metodosPagoExtra.trim() && (
                        <p className="text-[10px] text-red-500 mt-1">Indica al menos una forma de recepciÃ³n de dinero.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-blue-900 text-xs">
                  <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    Al publicar el inmueble, estos datos se vincularÃ¡n automÃ¡ticamente al <strong>CRM de Clientes</strong> con el registro de captaciÃ³n.
                  </p>
                </div>
              </div>
            )}

            {/* â”€â”€ PASO 4: IMÃGENES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <h2 className="text-base font-bold text-vinotinto flex items-center gap-1.5">
                    ðŸ“¸ 4. FotografÃ­as
                  </h2>
                  <p className="text-xs text-gray-400">
                    Sube al menos 1 imagen. La primera foto serÃ¡ la imagen de portada.
                  </p>
                </div>

                <ImageUploader onUploadComplete={handleUploadComplete} maxImages={10} />
                
                {formData.imagenes.length > 0 ? (
                  <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-green-800 text-xs flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <span><strong>{formData.imagenes.length}</strong> foto(s) lista(s) para publicar.</span>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <span>Es obligatorio subir al menos una foto para continuar.</span>
                  </div>
                )}
              </div>
            )}

            {/* â”€â”€ PASO 5: REVISIÃ“N Y PUBLICAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <h2 className="text-base font-bold text-vinotinto flex items-center gap-1.5">
                    âœ… 5. Revisar y Confirmar PublicaciÃ³n
                  </h2>
                  <p className="text-xs text-gray-400">Verifica que todos los datos sean correctos antes de guardar.</p>
                </div>

                {/* Badge tipo */}
                <div className="flex items-center justify-between p-3 bg-vinotinto/5 border border-vinotinto/15 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-vinotinto">{TYPE_ICONS[selectedType]}</span>
                    <span className="text-sm font-bold text-vinotinto">{selectedType}</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                    {formData.status}
                  </span>
                </div>

                {/* Resumen Inmueble */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Inmueble</p>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-200/50">
                    <span className="text-gray-500">TÃ­tulo:</span>
                    <span className="font-bold text-gray-800 text-right max-w-[60%]">{formData.titulo}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-200/50">
                    <span className="text-gray-500">UbicaciÃ³n:</span>
                    <span className="font-semibold text-gray-800 text-right max-w-[60%]">{formData.ubicacion}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-200/50">
                    <span className="text-gray-500">Precio:</span>
                    <span className="font-black text-vinotinto text-sm">
                      ${parseInt(formData.precio).toLocaleString('es-VE')} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-gray-500">CaracterÃ­sticas:</span>
                    <span className="font-semibold text-gray-800">
                      {[
                        formData.area ? `${formData.area} mÂ²` : null,
                        config.showBeds && formData.habitaciones ? `${formData.habitaciones} hab` : null,
                        config.showBaths && formData.banos ? `${formData.banos} baÃ±os` : null,
                      ].filter(Boolean).join(' Â· ')}
                    </span>
                  </div>
                </div>

                {/* Resumen Propietario y NegociaciÃ³n */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Propietario y NegociaciÃ³n</p>
                    {selectedOwner ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Propietario Registrado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Nuevo Cliente
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-200/50">
                    <span className="text-gray-500">Propietario:</span>
                    <span className="font-bold text-gray-800">{formData.propietarioNombre}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-200/50">
                    <span className="text-gray-500">TelÃ©fono:</span>
                    <span className="font-bold text-vinotinto">{formData.propietarioTelefono}</span>
                  </div>
                  <div className="text-xs py-1 border-b border-gray-200/50">
                    <span className="text-gray-500 block mb-1">Condiciones de NegociaciÃ³n:</span>
                    <span className="font-medium text-gray-800 bg-white p-2 rounded-lg border border-gray-200 block">
                      {[...formData.formasNegociacionTags, formData.formasNegociacionExtra.trim()].filter(Boolean).join('. ')}
                    </span>
                  </div>
                  <div className="text-xs py-1">
                    <span className="text-gray-500 block mb-1">MÃ©todos de Pago Aceptados:</span>
                    <span className="font-medium text-gray-800 bg-white p-2 rounded-lg border border-gray-200 block">
                      {[...formData.metodosPagoTags, formData.metodosPagoExtra.trim()].filter(Boolean).join('. ')}
                    </span>
                  </div>
                </div>

                {/* Resumen Fotos */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500">FotografÃ­as adjuntas:</span>
                  <span className="font-bold text-green-700">{formData.imagenes.length} imagen(es)</span>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700 text-xs flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* BOTONES DE NAVEGACIÃ“N */}
      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition"
          >
            <ArrowLeft size={16} /> AtrÃ¡s
          </button>
        )}

        {step < totalSteps ? (
          <motion.button
            whileHover={{ scale: canProceed() ? 1.02 : 1 }}
            whileTap={{ scale: canProceed() ? 0.96 : 1 }}
            type="button"
            onClick={() => {
              if (canProceed()) {
                setSubmitError('');
                setStep(step + 1);
              } else {
                setSubmitError('Por favor completa todos los campos requeridos marcados con *');
              }
            }}
            disabled={!canProceed()}
            className={`flex-[2] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
              canProceed()
                ? 'bg-gradient-to-r from-vinotinto to-vinotinto-light text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            Siguiente <ArrowRight size={18} />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !stepValidation.allValid || Boolean(duplicateProperty)}
            className="flex-[2] py-3.5 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-60 disabled:shadow-none transition-all"
          >
            {isSubmitting ? (
              <>Guardando...</>
            ) : (
              <>Publicar Inmueble <Check size={18} /></>
            )}
          </motion.button>
        )}
      </div>

      </div>{/* /px-4 wrapper */}
    </div>
  );
}


