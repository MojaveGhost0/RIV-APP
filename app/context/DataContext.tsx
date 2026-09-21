'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// =============================================================================
// UBICACIONES DE MARGARITA
// =============================================================================
export const MARGARITA_LOCATIONS: string[] = [
  // Municipio Maneiro
  'Pampatar, Maneiro, Isla de Margarita',
  'El Cardón, Maneiro, Isla de Margarita',
  'Guarame, Maneiro, Isla de Margarita',
  'Los Millanes, Maneiro, Isla de Margarita',
  'Av. Aldonza Manrique, Maneiro, Isla de Margarita',
  'Urb. El Morro, Maneiro, Isla de Margarita',
  'Urb. Jorge Coll, Maneiro, Isla de Margarita',
  'Urb. Maneiro, Maneiro, Isla de Margarita',
  'Urb. Paraíso 1, Maneiro, Isla de Margarita',
  'Urb. Paraíso 2, Maneiro, Isla de Margarita',
  'Playa Pampatar, Maneiro, Isla de Margarita',
  'Los Uveros, Maneiro, Isla de Margarita',

  // Municipio Mariño
  'Porlamar, Mariño, Isla de Margarita',
  'Los Robles, Mariño, Isla de Margarita',
  'Costa Azul, Mariño, Isla de Margarita',
  'Urb. Ferrol, Mariño, Isla de Margarita',
  'Urb. San Marino, Mariño, Isla de Margarita',
  'Urb. Bella Vista, Mariño, Isla de Margarita',
  'Urb. Las Margaritas, Mariño, Isla de Margarita',
  'La Granja, Mariño, Isla de Margarita',
  'La Costera, Mariño, Isla de Margarita',
  'Av. Santiago Mariño, Mariño, Isla de Margarita',
  'Av. 4 de Mayo, Mariño, Isla de Margarita',
  'Sector Los Cocos, Mariño, Isla de Margarita',
  'Urb. El Pilar, Mariño, Isla de Margarita',
  'Centro de Porlamar, Mariño, Isla de Margarita',

  // Municipio Arismendi
  'La Asunción, Arismendi, Isla de Margarita',
  'Santa Ana, Arismendi, Isla de Margarita',
  'El Cercado, Arismendi, Isla de Margarita',
  'Los Bagres, Arismendi, Isla de Margarita',
  'Urb. El Peñón, Arismendi, Isla de Margarita',
  'Sector La Fuente, Arismendi, Isla de Margarita',
  'Juan Griego, Arismendi, Isla de Margarita',
  'El Maco, Arismendi, Isla de Margarita',
  'Urb. El Caney, Arismendi, Isla de Margarita',

  // Municipio Díaz
  'San Juan Bautista, Díaz, Isla de Margarita',
  'Tacuantar, Díaz, Isla de Margarita',
  'El Espinal, Díaz, Isla de Margarita',
  'Urb. Las Delicias, Díaz, Isla de Margarita',
  'Sector La Sabana, Díaz, Isla de Margarita',

  // Municipio García
  'Santa Ana del Norte, García, Isla de Margarita',
  'El Salado, García, Isla de Margarita',
  'La Sierra, García, Isla de Margarita',
  'Urb. El Bosque, García, Isla de Margarita',

  // Municipio Gómez
  'Santa Ana del Norte, Gómez, Isla de Margarita',
  'La Vecindad, Gómez, Isla de Margarita',
  'Boca Río, Gómez, Isla de Margarita',
  'Los Barales, Gómez, Isla de Margarita',

  // Municipio Marcano
  'El Agua, Marcano, Isla de Margarita',
  'Playa El Agua, Marcano, Isla de Margarita',
  'Pedro González, Marcano, Isla de Margarita',
  'Manzanillo, Marcano, Isla de Margarita',
  'Playa Parguito, Marcano, Isla de Margarita',
  'Playa Guacuco, Marcano, Isla de Margarita',
  'Los Manantiales, Marcano, Isla de Margarita',
  'El Tirano, Marcano, Isla de Margarita',

  // Municipio Tubores
  'Villa Rosa, Tubores, Isla de Margarita',
  'Los Barales, Tubores, Isla de Margarita',
  'Urb. Los Samanes, Tubores, Isla de Margarita',

  // Municipio Villalba
  'Punta de Piedras, Villalba, Isla de Margarita',
  'La Guardia, Villalba, Isla de Margarita',
  'Urb. Los Mangos, Villalba, Isla de Margarita',

  // Municipio Antolín del Campo
  'El Espinal, Antolín del Campo, Isla de Margarita',
  'Playa El Ángel, Antolín del Campo, Isla de Margarita',
  'Playa Caribe, Antolín del Campo, Isla de Margarita',
  'Playa Guacuco, Antolín del Campo, Isla de Margarita',
  'Playa La Mula, Antolín del Campo, Isla de Margarita',

  // Municipio Macanao (Península)
  'Boca del Río, Macanao, Isla de Margarita',
  'La Restinga, Macanao, Isla de Margarita',
  'Laguna de La Restinga, Macanao, Isla de Margarita',
  'Playa La Guardia, Macanao, Isla de Margarita',
  'El Manglillo, Macanao, Isla de Margarita',
  'Urb. Los Roques, Macanao, Isla de Margarita',

  // Isla de Coche
  'San Pedro de Coche, Isla de Coche',
  'La Uva, Isla de Coche',
  'El Bichar, Isla de Coche',
];

// =============================================================================
// TIPOS DE PROPIEDAD
// =============================================================================
export const PROPERTY_TYPES = [
  'Apartamento',
  'Casa / Quinta',
  'Townhouse',
  'Penthouse',
  'Local Comercial',
  'Oficina',
  'Terreno',
] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

// =============================================================================
// INTERFACES
// =============================================================================
export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  beds: number;
  baths: number;
  sqm: number;
  description: string;
  image: string;
  images: string[];
  status: string;
  captador: string;
  amenities?: string[];
  propertyType?: PropertyType;
  propietarioNombre?: string;
  propietarioTelefono?: string;
  formasNegociacion?: string;
  metodosPago?: string;
  /** ISO date string — se asigna automáticamente al registrar */
  createdAt?: string;
  created_at?: string;
}

export interface Appointment {
  id: string;          // FIX #3 — Unificado a string (antes string|number causaba fallos en delete/update)
  tipo: string;
  titulo: string;
  cliente?: string;
  fecha: string;
  hora: string;
  asesores: string[];
  estado: string;
  reminder_sent?: boolean;
  created_at?: string;
}

export interface CrmLog {
  id: string;
  cliente: string;
  asesor: string;
  tipo_interaccion: string;
  notas: string;
  created_at?: string;
}

interface DataContextType {
  properties: Property[];
  appointments: Appointment[];
  crmLogs: CrmLog[];
  dataError: string | null;
  addProperty: (property: Omit<Property, 'id' | 'createdAt' | 'created_at'>) => Promise<string>;
  updateProperty: (id: string, updates: Partial<Omit<Property, 'id' | 'createdAt' | 'created_at'>>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  updatePropertyStatus: (id: string, status: string) => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'estado'>) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Omit<Appointment, 'id'>>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  updateAppointmentStatus: (id: string, status: string) => Promise<void>;
  addCrmLog: (log: Omit<CrmLog, 'id' | 'created_at'>) => Promise<void>;
  updateCrmLog: (id: string, updates: Partial<Omit<CrmLog, 'id' | 'created_at'>>) => Promise<void>;
  deleteCrmLog: (id: string) => Promise<void>;
}

// =============================================================================
// HELPER — Fecha local en formato YYYY-MM-DD (FIX #4 — Timezone correcta)
// toISOString() devuelve UTC y en Venezuela (UTC-4) puede dar el día siguiente.
// =============================================================================
const localToday = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

// =============================================================================
// DEFAULT SEED DATA (DT-03: IDs con formato UUID estándar)
// =============================================================================
const DEFAULT_PROPERTIES: Property[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    title: "Apartamento Vista al Mar",
    price: 45000,
    location: "Pampatar, Margarita",
    beds: 3,
    baths: 2,
    sqm: 85,
    description: "Hermoso apartamento de oportunidad con excelente vista al mar. Ubicado en zona residencial tranquila con piscina, vigilancia y áreas comunes bien cuidadas.",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"
    ],
    status: "Activa",
    captador: "Gerardo Garcia",
    amenities: ["Piscina", "Vigilancia 24/7", "Planta Eléctrica"],
    createdAt: "2026-07-10T10:00:00.000Z",
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    title: "Villa Exclusiva Costa Azul",
    price: 120000,
    location: "Costa Azul, Porlamar",
    beds: 4,
    baths: 4,
    sqm: 250,
    description: "Espectacular quinta de lujo ubicada en una de las mejores urbanizaciones cerradas de la isla. Cuenta con acabados de primera, amplio jardín, parrillera y estacionamiento para 4 vehículos.",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600607687931-cebf10cb8cb0?auto=format&fit=crop&w=800&q=80"
    ],
    status: "Activa",
    captador: "Juan Garcia",
    amenities: ["Planta Eléctrica", "Vigilancia 24/7", "Pozo de Agua", "Estacionamiento Techado"],
    createdAt: "2026-07-12T09:00:00.000Z",
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    title: 'Exclusivo Apartamento Vista al Mar',
    price: 85000,
    location: 'Pampatar, Isla de Margarita',
    beds: 3,
    baths: 2,
    sqm: 110,
    description: 'Hermoso apartamento completamente amoblado con vista panorámica al mar Caribe. Cuenta con acabados de primera, cocina italiana, aire acondicionado central y áreas sociales con piscina infinita.',
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687931-cebf10cb8cb0?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'Activa',
    captador: 'Amado Lovera',
    amenities: ['Amoblado', 'Vista al Mar', 'Ascensor', 'Piscina'],
    createdAt: "2026-07-15T14:00:00.000Z",
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    title: 'Townhouse en Conjunto Residencial',
    price: 65000,
    location: 'Playa El Ángel, Margarita',
    beds: 3,
    baths: 3,
    sqm: 140,
    description: 'Moderno townhouse de 2 niveles. Ideal para familias, excelente distribución y seguridad 24 horas.',
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80"],
    status: "Activa",
    captador: "Amado Lovera",
    amenities: ["Seguridad 24H", "Área de BBQ"],
    createdAt: "2026-06-20T11:00:00.000Z",
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    title: 'Penthouse de Lujo',
    price: 210000,
    location: 'Av. Aldonza Manrique',
    beds: 4,
    baths: 5,
    sqm: 320,
    description: 'Impresionante penthouse con vista 360, terraza privada, jacuzzi y ascensor directo al apartamento.',
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80"],
    status: "Vendida",
    captador: "Juan Garcia",
    amenities: ["Jacuzzi", "Terraza Privada", "Vista 360", "Ascensor Privado"],
    createdAt: "2026-05-10T08:00:00.000Z",
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    title: 'Local Comercial Céntrico',
    price: 35000,
    location: 'Av. Santiago Mariño, Porlamar',
    beds: 0,
    baths: 1,
    sqm: 60,
    description: 'Excelente local a pie de calle con alto tráfico peatonal, ideal para boutique o tienda de tecnología.',
    image: "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=800&q=80"],
    status: "Activa",
    captador: "Gerardo Garcia",
    amenities: ["Aire Acondicionado", "Vitrinas", "A pie de calle"],
    createdAt: "2026-07-01T10:00:00.000Z",
  }
];

const today = localToday();
const DEFAULT_CITAS: Appointment[] = [
  { id: '10000000-0000-0000-0000-000000000001', tipo: 'Mostrar Propiedad',  titulo: 'Villa Exclusiva Costa Azul', cliente: 'María López',        fecha: '2026-07-16', hora: '14:30', asesores: ['Juan García'],                         estado: 'Pendiente'  },
  { id: '10000000-0000-0000-0000-000000000002', tipo: 'Captar Propiedad',   titulo: 'Apto Pampatar',              cliente: 'Juan Gómez',          fecha: '2026-07-17', hora: '10:00', asesores: ['Amado Lovera'],                       estado: 'Pendiente'  },
  { id: '10000000-0000-0000-0000-000000000003', tipo: 'Cita en Oficina',    titulo: 'Firma de Contrato',          cliente: 'Familia Rodríguez',   fecha: '2026-07-14', hora: '16:00', asesores: ['Juan García'],                         estado: 'Completada' },
  { id: '10000000-0000-0000-0000-000000000004', tipo: 'Mostrar Propiedad',  titulo: 'Penthouse Playa El Agua',    cliente: 'Luis Fernández',      fecha: '2026-07-13', hora: '09:00', asesores: ['Amado Lovera', 'Gerardo Garcia'],     estado: 'Completada' },
  { id: '10000000-0000-0000-0000-000000000005', tipo: 'Mostrar Propiedad',  titulo: 'Visita Local Comercial',     cliente: 'Pedro Sánchez',       fecha: today,        hora: '15:00', asesores: ['Gerardo Garcia'],                     estado: 'Pendiente'  },
  { id: '10000000-0000-0000-0000-000000000006', tipo: 'Firma',              titulo: 'Firma Opción a Compra',      cliente: 'Carlos Roa',          fecha: today,        hora: '17:30', asesores: ['Juan García', 'Amado Lovera'],        estado: 'Pendiente'  },
];

// =============================================================================
// CONTEXT CREATION
// =============================================================================
const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [crmLogs, setCrmLogs] = useState<CrmLog[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  // Cargar datos de Supabase al montar — con distinción de error real vs lista vacía (LOG-05)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propsRes, appsRes, crmRes] = await Promise.all([
          supabase.from('properties').select('*').order('created_at', { ascending: false }),
          supabase.from('appointments').select('*').order('fecha', { ascending: true }),
          supabase.from('crm_logs').select('*').order('created_at', { ascending: false }),
        ]);

        const anyError = propsRes.error || appsRes.error || crmRes.error;
        if (anyError) {
          const errMsg = propsRes.error?.message || appsRes.error?.message || crmRes.error?.message || 'Error de conexión o permisos';
          console.warn('Error al cargar datos desde Supabase (LOG-05):', errMsg);
          setDataError(errMsg);
          // Modo fallback de demostración si hubo error
          setProperties(DEFAULT_PROPERTIES);
          setAppointments(DEFAULT_CITAS);
          return;
        }

        setDataError(null);
        const propsData = (propsRes.data as any[] | null)?.map(p => ({
          ...p,
          createdAt: p.createdAt || p.created_at,
          created_at: p.created_at || p.createdAt,
        })) as Property[] | null;
        setProperties(propsData ?? []);

        if (appsRes.data) setAppointments(appsRes.data as Appointment[]);
        if (crmRes.data) setCrmLogs(crmRes.data as CrmLog[]);
      } catch (err: any) {
        const errMsg = err?.message || 'Error de red o conexión a Supabase';
        console.error('Excepción al conectar con Supabase:', err);
        setDataError(errMsg);
        setProperties(DEFAULT_PROPERTIES);
        setAppointments(DEFAULT_CITAS);
      }
    };

    fetchData();
  }, []);

  // Add Property con soporte para campos de propietario y fallback preventivo
  const addProperty = useCallback(async (newProp: Omit<Property, 'id' | 'createdAt' | 'created_at'>): Promise<string> => {
    let dataId: string;
    let dataCreatedAt: string | undefined;
    try {
      const { data, error } = await supabase
        .from('properties')
        .insert([newProp])
        .select('id, created_at')
        .single();

      if (error) throw error;
      dataId = data.id;
      dataCreatedAt = data.created_at;
    } catch (err: any) {
      // Si las columnas de propietario aún no han sido migradas en la BD de Supabase, reintentar sin ellas
      const isColError = err?.message?.includes('does not exist') || err?.code === '42703';
      if (isColError) {
        console.warn('Supabase: Columnas de propietario aún no creadas en BD. Guardando campos base...', err);
        const { propietarioNombre, propietarioTelefono, formasNegociacion, metodosPago, ...baseProp } = newProp;
        const { data: retryData, error: retryError } = await supabase
          .from('properties')
          .insert([baseProp])
          .select('id, created_at')
          .single();

        if (retryError) throw retryError;
        dataId = retryData.id;
        dataCreatedAt = retryData.created_at;
      } else {
        console.error('Error adding property:', err);
        throw err;
      }
    }

    const timestamp = dataCreatedAt || new Date().toISOString();
    const property: Property = {
      ...newProp,
      id: dataId,
      createdAt: timestamp,
      created_at: timestamp,
    };
    setProperties(prev => [property, ...prev]);
    return dataId;
  }, []);

  // Delete Property con Rollback (LOG-01)
  const deleteProperty = useCallback(async (id: string) => {
    let previousState: Property[] = [];
    setProperties(prev => {
      previousState = prev;
      return prev.filter(prop => prop.id !== id);
    });

    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar propiedad en Supabase. Revirtiendo estado local (LOG-01):', err);
      setProperties(previousState);
      throw err;
    }
  }, []);

  // Update Property Status con Rollback (LOG-02)
  const updatePropertyStatus = useCallback(async (id: string, status: string) => {
    let previousState: Property[] = [];
    setProperties(prev => {
      previousState = prev;
      return prev.map(p => p.id === id ? { ...p, status } : p);
    });

    try {
      const { error } = await supabase.from('properties').update({ status }).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar status de propiedad. Revirtiendo estado local (LOG-02):', err);
      setProperties(previousState);
      throw err;
    }
  }, []);

  // Update Property completo con Rollback
  const updateProperty = useCallback(async (id: string, updates: Partial<Omit<Property, 'id' | 'createdAt' | 'created_at'>>) => {
    let previousState: Property[] = [];
    setProperties(prev => {
      previousState = prev;
      return prev.map(p => p.id === id ? { ...p, ...updates } : p);
    });

    try {
      const { error } = await supabase.from('properties').update(updates).eq('id', id);
      if (error) {
        // Fallback defensivo si alguna columna aún no existe en Supabase
        const { propietarioNombre, propietarioTelefono, formasNegociacion, metodosPago, ...coreUpdates } = updates as any;
        const { error: coreError } = await supabase.from('properties').update(coreUpdates).eq('id', id);
        if (coreError) throw coreError;
      }
    } catch (err) {
      console.error('Error al actualizar propiedad en Supabase. Revirtiendo estado local:', err);
      setProperties(previousState);
      throw err;
    }
  }, []);

  // Add Appointment
  const addAppointment = useCallback(async (newApp: Omit<Appointment, 'id' | 'estado'>) => {
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ ...newApp, estado: 'Pendiente' }])
      .select('id')
      .single();

    if (error) {
      console.error('Error adding appointment:', error);
      throw error;
    }

    const appointment: Appointment = {
      ...newApp,
      id: data.id,
      estado: 'Pendiente',
      reminder_sent: false,
    };
    setAppointments(prev => [...prev, appointment].sort((a, b) => a.fecha.localeCompare(b.fecha)));

    // Fire and forget notification
    fetch('/api/notifications/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    }).catch(err => console.error('Error al enviar notificacion de cita:', err));
  }, []);

  // Update Appointment completo con Rollback
  const updateAppointment = useCallback(async (id: string, updates: Partial<Omit<Appointment, 'id'>>) => {
    let previousState: Appointment[] = [];
    setAppointments(prev => {
      previousState = prev;
      return prev.map(app => app.id === id ? { ...app, ...updates } : app);
    });

    try {
      const { error } = await supabase.from('appointments').update(updates).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar cita en Supabase. Revirtiendo estado local:', err);
      setAppointments(previousState);
      throw err;
    }
  }, []);

  // Delete Appointment con Rollback (ROB-04)
  const deleteAppointment = useCallback(async (id: string) => {
    let previousState: Appointment[] = [];
    setAppointments(prev => {
      previousState = prev;
      return prev.filter(app => app.id !== id);
    });

    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar cita en Supabase. Revirtiendo estado local (ROB-04):', err);
      setAppointments(previousState);
      throw err;
    }
  }, []);

  // Update Appointment Status con Rollback (LOG-02)
  const updateAppointmentStatus = useCallback(async (id: string, status: string) => {
    let previousState: Appointment[] = [];
    setAppointments(prev => {
      previousState = prev;
      return prev.map(app => app.id === id ? { ...app, estado: status } : app);
    });

    try {
      const { error } = await supabase.from('appointments').update({ estado: status }).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar status de cita. Revirtiendo estado local (LOG-02):', err);
      setAppointments(previousState);
      throw err;
    }
  }, []);

  // Add CRM Log
  const addCrmLog = useCallback(async (newLog: Omit<CrmLog, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('crm_logs')
      .insert([newLog])
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Error adding CRM log:', error);
      throw error;
    }

    const log: CrmLog = {
      ...newLog,
      id: data.id,
      created_at: data.created_at,
    };
    setCrmLogs(prev => [log, ...prev]);
  }, []);

  // Update CRM Log con Rollback
  const updateCrmLog = useCallback(async (id: string, updates: Partial<Omit<CrmLog, 'id' | 'created_at'>>) => {
    let previousState: CrmLog[] = [];
    setCrmLogs(prev => {
      previousState = prev;
      return prev.map(log => log.id === id ? { ...log, ...updates } : log);
    });

    try {
      const { error } = await supabase.from('crm_logs').update(updates).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar registro CRM en Supabase. Revirtiendo estado local:', err);
      setCrmLogs(previousState);
      throw err;
    }
  }, []);

  // Delete CRM Log con Rollback
  const deleteCrmLog = useCallback(async (id: string) => {
    let previousState: CrmLog[] = [];
    setCrmLogs(prev => {
      previousState = prev;
      return prev.filter(log => log.id !== id);
    });

    try {
      const { error } = await supabase.from('crm_logs').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al eliminar registro CRM en Supabase. Revirtiendo estado local:', err);
      setCrmLogs(previousState);
      throw err;
    }
  }, []);

  return (
    <DataContext.Provider value={{
      properties,
      appointments,
      crmLogs,
      dataError,
      addProperty,
      updateProperty,
      deleteProperty,
      updatePropertyStatus,
      addAppointment,
      updateAppointment,
      deleteAppointment,
      updateAppointmentStatus,
      addCrmLog,
      updateCrmLog,
      deleteCrmLog,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData debe ser usado dentro de un <DataProvider>');
  }
  return context;
}
