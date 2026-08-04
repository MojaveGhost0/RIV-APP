'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  /** ISO date string — se asigna automáticamente al registrar */
  createdAt?: string;
}

export interface Appointment {
  id: string;          // FIX #3 — Unificado a string (antes string|number causaba fallos en delete/update)
  tipo: string;
  titulo: string;
  cliente: string;
  fecha: string;
  hora: string;
  asesores: string[];
  estado: string;
}

interface DataContextType {
  properties: Property[];
  appointments: Appointment[];
  addProperty: (property: Omit<Property, 'id' | 'createdAt'>) => Promise<string>;
  deleteProperty: (id: string) => Promise<void>;
  updatePropertyStatus: (id: string, status: string) => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'estado'>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  updateAppointmentStatus: (id: string, status: string) => Promise<void>;
}

// =============================================================================
// HELPER — Fecha local en formato YYYY-MM-DD (FIX #4 — Timezone correcta)
// toISOString() devuelve UTC y en Venezuela (UTC-4) puede dar el día siguiente.
// =============================================================================
const localToday = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

// =============================================================================
// DEFAULT SEED DATA
// =============================================================================
const DEFAULT_PROPERTIES: Property[] = [
  {
    id: '1',
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
    id: '2',
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
    id: '123',
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
    id: '4',
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
    id: '5',
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
    id: '6',
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

// FIX #3 — IDs unificados a string (antes eran number 1,2,3... lo que causaba
//           que delete/update fallaran al comparar tras JSON.parse)
// FIX #4 — fecha usa localToday() en vez de toISOString() para timezone correcta
const today = localToday();
const DEFAULT_CITAS: Appointment[] = [
  { id: '1', tipo: 'Mostrar Propiedad',  titulo: 'Villa Exclusiva Costa Azul', cliente: 'María López',        fecha: '2026-07-16', hora: '14:30', asesores: ['Juan García'],                         estado: 'Pendiente'  },
  { id: '2', tipo: 'Captar Propiedad',   titulo: 'Apto Pampatar',              cliente: 'Juan Gómez',          fecha: '2026-07-17', hora: '10:00', asesores: ['Amado Lovera'],                       estado: 'Pendiente'  },
  { id: '3', tipo: 'Cita en Oficina',    titulo: 'Firma de Contrato',          cliente: 'Familia Rodríguez',   fecha: '2026-07-14', hora: '16:00', asesores: ['Juan García'],                         estado: 'Completada' },
  { id: '4', tipo: 'Mostrar Propiedad',  titulo: 'Penthouse Playa El Agua',    cliente: 'Luis Fernández',      fecha: '2026-07-13', hora: '09:00', asesores: ['Amado Lovera', 'Gerardo Garcia'],     estado: 'Completada' },
  { id: '5', tipo: 'Mostrar Propiedad',  titulo: 'Visita Local Comercial',     cliente: 'Pedro Sánchez',       fecha: today,        hora: '15:00', asesores: ['Gerardo Garcia'],                     estado: 'Pendiente'  },
  { id: '6', tipo: 'Firma',              titulo: 'Firma Opción a Compra',      cliente: 'Carlos Roa',          fecha: today,        hora: '17:30', asesores: ['Juan García', 'Amado Lovera'],        estado: 'Pendiente'  },
];

// =============================================================================
// CONTEXT CREATION
// =============================================================================
const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar datos de Supabase al montar
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propsRes, appsRes] = await Promise.all([
          supabase.from('properties').select('*').order('created_at', { ascending: false }),
          supabase.from('appointments').select('*').order('fecha', { ascending: true })
        ]);

        if (propsRes.data) {
          // Supabase devuelve el nombre exacto de la tabla, normalizamos
          setProperties(propsRes.data as Property[]);
        }
        if (appsRes.data) {
          setAppointments(appsRes.data as Appointment[]);
        }
      } catch (error) {
        console.error('Error fetching data from Supabase:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    fetchData();
  }, []);

  // Add Property
  const addProperty = async (newProp: Omit<Property, 'id' | 'createdAt'>): Promise<string> => {
    const { data, error } = await supabase
      .from('properties')
      .insert([newProp])
      .select('id')
      .single();

    if (error) {
      console.error('Error adding property:', error);
      throw error;
    }

    const property: Property = {
      ...newProp,
      id: data.id,
      createdAt: new Date().toISOString(),
    };
    setProperties(prev => [property, ...prev]);
    return data.id;
  };

  // Delete Property
  const deleteProperty = async (id: string) => {
    setProperties(prev => prev.filter(prop => prop.id !== id));
    await supabase.from('properties').delete().eq('id', id);
  };

  // Update Property Status
  const updatePropertyStatus = async (id: string, status: string) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    await supabase.from('properties').update({ status }).eq('id', id);
  };

  // Add Appointment
  const addAppointment = async (newApp: Omit<Appointment, 'id' | 'estado'>) => {
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
      estado: 'Pendiente'
    };
    setAppointments(prev => [appointment, ...prev]);
  };

  // Delete Appointment
  const deleteAppointment = async (id: string) => {
    setAppointments(prev => prev.filter(app => app.id !== id));
    await supabase.from('appointments').delete().eq('id', id);
  };

  // Update Appointment Status
  const updateAppointmentStatus = async (id: string, status: string) => {
    setAppointments(prev => prev.map(app => app.id === id ? { ...app, estado: status } : app));
    await supabase.from('appointments').update({ estado: status }).eq('id', id);
  };

  return (
    <DataContext.Provider value={{
      properties,
      appointments,
      addProperty,
      deleteProperty,
      updatePropertyStatus,
      addAppointment,
      deleteAppointment,
      updateAppointmentStatus
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
