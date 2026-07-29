'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

export interface Appointment {
  id: string | number;
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
  addProperty: (property: Omit<Property, 'id'>) => string;
  deleteProperty: (id: string) => void;
  updatePropertyStatus: (id: string, status: string) => void;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'estado'>) => void;
  deleteAppointment: (id: string | number) => void;
  updateAppointmentStatus: (id: string | number, status: string) => void;
}

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
    amenities: ["Piscina", "Vigilancia 24/7", "Planta Eléctrica"]
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
    amenities: ["Planta Eléctrica", "Vigilancia 24/7", "Pozo de Agua", "Estacionamiento Techado"]
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
    amenities: ['Amoblado', 'Vista al Mar', 'Ascensor', 'Piscina']
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
    amenities: ["Seguridad 24H", "Área de BBQ"]
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
    amenities: ["Jacuzzi", "Terraza Privada", "Vista 360", "Ascensor Privado"]
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
    amenities: ["Aire Acondicionado", "Vitrinas", "A pie de calle"]
  }
];

const today = new Date().toISOString().slice(0, 10);
const DEFAULT_CITAS: Appointment[] = [
  { id: 1, tipo: 'Mostrar Propiedad',  titulo: 'Villa Exclusiva Costa Azul', cliente: 'María López',        fecha: '2026-07-16', hora: '14:30', asesores: ['Juan Garcia'],  estado: 'Pendiente'   },
  { id: 2, tipo: 'Captar Propiedad',   titulo: 'Apto Pampatar',              cliente: 'Juan Gómez',          fecha: '2026-07-17', hora: '10:00', asesores: ['Amado Lovera'],     estado: 'Pendiente'   },
  { id: 3, tipo: 'Cita en Oficina',    titulo: 'Firma de Contrato',          cliente: 'Familia Rodríguez',   fecha: '2026-07-14', hora: '16:00', asesores: ['Juan Garcia'],  estado: 'Completada'  },
  { id: 4, tipo: 'Mostrar Propiedad',  titulo: 'Penthouse Playa El Agua',    cliente: 'Luis Fernández',      fecha: '2026-07-13', hora: '09:00', asesores: ['Amado Lovera', 'Gerardo Garcia'], estado: 'Completada'  },
  { id: 5, tipo: 'Mostrar Propiedad',  titulo: 'Visita Local Comercial',     cliente: 'Pedro Sánchez',       fecha: today,       hora: '15:00', asesores: ['Gerardo Garcia'],estado: 'Pendiente'   },
  { id: 6, tipo: 'Firma',              titulo: 'Firma Opción a Compra',      cliente: 'Carlos Roa',          fecha: today,       hora: '17:30', asesores: ['Juan Garcia', 'Amado Lovera'],  estado: 'Pendiente'   },
];

// =============================================================================
// CONTEXT CREATION
// =============================================================================
const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial data
  useEffect(() => {
    const storedProperties = localStorage.getItem('riv_properties_v4');
    const storedAppointments = localStorage.getItem('riv_appointments_v4');

    if (storedProperties) {
      setProperties(JSON.parse(storedProperties));
    } else {
      setProperties(DEFAULT_PROPERTIES);
      localStorage.setItem('riv_properties_v4', JSON.stringify(DEFAULT_PROPERTIES));
    }

    if (storedAppointments) {
      setAppointments(JSON.parse(storedAppointments));
    } else {
      setAppointments(DEFAULT_CITAS);
      localStorage.setItem('riv_appointments_v4', JSON.stringify(DEFAULT_CITAS));
    }

    setIsLoaded(true);
  }, []);

  // Save properties when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('riv_properties_v4', JSON.stringify(properties));
    }
  }, [properties, isLoaded]);

  // Save appointments when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('riv_appointments_v4', JSON.stringify(appointments));
    }
  }, [appointments, isLoaded]);

  // Add Property
  const addProperty = (newProp: Omit<Property, 'id'>) => {
    const newId = Date.now().toString();
    const property: Property = {
      ...newProp,
      id: newId
    };
    setProperties(prev => [property, ...prev]);
    return newId;
  };

  // Delete Property
  const deleteProperty = (id: string) => {
    setProperties(prev => prev.filter(prop => prop.id !== id));
  };

  // Update Property Status
  const updatePropertyStatus = (id: string, status: string) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  // Add Appointment
  const addAppointment = (newApp: Omit<Appointment, 'id' | 'estado'>) => {
    const newId = Date.now();
    const appointment: Appointment = {
      ...newApp,
      id: newId,
      estado: 'Pendiente'
    };
    setAppointments(prev => [appointment, ...prev]);
  };

  // Delete Appointment
  const deleteAppointment = (id: string | number) => {
    setAppointments(prev => prev.filter(app => app.id !== id));
  };

  // Update Appointment Status
  const updateAppointmentStatus = (id: string | number, status: string) => {
    setAppointments(prev => prev.map(app => app.id === id ? { ...app, estado: status } : app));
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
