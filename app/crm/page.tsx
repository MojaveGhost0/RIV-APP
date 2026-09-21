'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useData, type Property } from '../context/DataContext';
import {
  ShieldAlert, Plus, User, Calendar, FileText, Download, X, Search,
  ChevronDown, ChevronUp, Briefcase, Phone, MessageCircle, Home,
  ExternalLink, CircleDollarSign, CreditCard, MapPin, Edit2, Trash2, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import { normalize } from '../lib/searchEngine';

// SEC-05: Sanitización preventiva de texto contra scripts o tags HTML maliciosos
function sanitizeText(str: string): string {
  if (!str) return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '');
}

// Helper para extraer número de teléfono de notas o texto
function extractPhone(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:Teléfono(?:\s*Propietario)?:\s*)([+0-9\s\-]{7,20})/i) ||
                text.match(/(\+?58\s*4\d{2}[\s\-]?\d{7}|04\d{2}[\s\-]?\d{7})/);
  if (!match) return null;
  const raw = match[1].replace(/[^\d+]/g, '');
  return raw.length >= 7 ? raw : null;
}

// Helper para limpiar la descripción repetida de notas del CRM y evitar que ocupe espacio
function cleanInteractionNotes(notes: string): string {
  if (!notes) return '';
  if (notes.includes('[NUEVA CAPTACIÓN]')) {
    const inmMatch = notes.match(/Inmueble:\s*([^\n]+)/i);
    const locMatch = notes.match(/Ubicación:\s*([^\n]+)/i);
    if (inmMatch) {
      return `Captación de Inmueble: ${inmMatch[1].trim()}${locMatch ? ` en ${locMatch[1].trim()}` : ''}`;
    }
  }
  return notes
    .replace(/Descripción:[\s\S]*/gi, '')
    .trim();
}

interface OwnerPropertyItem {
  id?: string;
  title: string;
  location?: string;
  price?: number | string;
  status?: string;
  image?: string;
  sqm?: number;
  beds?: number;
  baths?: number;
  formasNegociacion?: string;
  metodosPago?: string;
}

// Extrae y recopila todas las propiedades asociadas a este cliente/propietario
function getClientProperties(clientName: string, clientHistory: any[], allProperties: Property[]): OwnerPropertyItem[] {
  const normClient = normalize(clientName);
  const result: OwnerPropertyItem[] = [];
  const addedIds = new Set<string>();

  // Teléfonos encontrados en las notas del cliente
  const clientPhones = clientHistory
    .map(h => extractPhone(h.notas || ''))
    .filter(Boolean) as string[];

  // 1. Buscar en el inventario de properties
  allProperties.forEach(p => {
    let matches = false;

    // Coincidencia por nombre de propietario
    if (p.propietarioNombre && normalize(p.propietarioNombre) === normClient) {
      matches = true;
    }

    // Coincidencia por teléfono de propietario
    if (!matches && p.propietarioTelefono && clientPhones.length > 0) {
      const pDigits = p.propietarioTelefono.replace(/\D/g, '');
      const pTail = pDigits.length >= 7 ? pDigits.slice(-10) : pDigits;
      const matchesPhone = clientPhones.some(ph => {
        const phDigits = ph.replace(/\D/g, '');
        const phTail = phDigits.length >= 7 ? phDigits.slice(-10) : phDigits;
        return phTail === pTail;
      });
      if (matchesPhone) matches = true;
    }

    // Coincidencia si alguna nota de captación menciona específicamente el título del inmueble
    if (!matches) {
      const mentionsTitle = clientHistory.some(h => {
        if (!h.notas) return false;
        const isCaptacion = (h.tipo && h.tipo.includes('Captación')) || h.notas.includes('Captación');
        return isCaptacion && normalize(h.notas).includes(normalize(p.title));
      });
      if (mentionsTitle) matches = true;
    }

    if (matches && !addedIds.has(p.id)) {
      addedIds.add(p.id);
      result.push({
        id: p.id,
        title: p.title,
        location: p.location,
        price: p.price,
        status: p.status,
        image: p.image,
        sqm: p.sqm,
        beds: p.beds,
        baths: p.baths,
        formasNegociacion: p.formasNegociacion,
        metodosPago: p.metodosPago,
      });
    }
  });

  return result;
}

// Genera el expediente completo de un cliente específico en PDF
function exportClientPDF(
  client: { name: string; history: any[]; lastInteraction: string },
  clientProps: OwnerPropertyItem[],
  clientPhone: string | null
) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  const COLOR_PRIMARY: [number, number, number] = [128, 0, 32];
  const COLOR_GOLD: [number, number, number] = [212, 175, 55];
  const COLOR_DARK: [number, number, number] = [31, 41, 55];
  const COLOR_MUTED: [number, number, number] = [107, 114, 128];
  const COLOR_BG_CARD: [number, number, number] = [249, 250, 251];
  const COLOR_BORDER: [number, number, number] = [229, 231, 235];

  let currentY = 14;

  const drawHeader = (isFirstPage: boolean) => {
    // Barra superior vinotinto
    pdf.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    pdf.rect(marginX, 10, contentWidth, 2.5, 'F');

    if (isFirstPage) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      pdf.text('RIV MARGARITA PREMIER', marginX, 19);

      pdf.setFontSize(8.5);
      pdf.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
      pdf.text('EXPEDIENTE INTEGRAL DE CLIENTE · CRM', marginX, 24);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      const dateStr = `Fecha: ${new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      pdf.text(dateStr, pageWidth - marginX, 19, { align: 'right' });
      pdf.text('Gestión Comercial Inmobiliaria', pageWidth - marginX, 24, { align: 'right' });

      pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, 28, marginX + contentWidth, 28);

      currentY = 32;
    } else {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      pdf.text(`RIV MARGARITA PREMIER · Expediente: ${client.name}`, marginX, 18);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      pdf.text(new Date().toLocaleDateString('es-VE'), pageWidth - marginX, 18, { align: 'right' });

      pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, 21, marginX + contentWidth, 21);

      currentY = 25;
    }
  };

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      pdf.addPage('a4', 'portrait');
      drawHeader(false);
      return true;
    }
    return false;
  };

  drawHeader(true);

  // 1. TARJETA RESUMEN CLIENTE
  const cardHeight = 26;
  pdf.setFillColor(COLOR_BG_CARD[0], COLOR_BG_CARD[1], COLOR_BG_CARD[2]);
  pdf.rect(marginX, currentY, contentWidth, cardHeight, 'F');
  pdf.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
  pdf.rect(marginX, currentY, 3, cardHeight, 'F');
  pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
  pdf.setLineWidth(0.2);
  pdf.rect(marginX, currentY, contentWidth, cardHeight, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  pdf.text(client.name, marginX + 6, currentY + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  pdf.text(`Teléfono: ${clientPhone || 'No registrado'}`, marginX + 6, currentY + 13);
  pdf.text(
    `Total Actividades: ${client.history.length} interacción(es)`,
    marginX + 6,
    currentY + 19
  );

  pdf.setFont('helvetica', 'bold');
  pdf.text(
    `Último Contacto: ${new Date(client.lastInteraction).toLocaleDateString('es-VE')}`,
    pageWidth - marginX - 6,
    currentY + 13,
    { align: 'right' }
  );

  const roleText = clientProps.length > 0 ? 'Propietario Activo' : 'Cliente / Prospecto';
  pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
  pdf.text(roleText, pageWidth - marginX - 6, currentY + 19, { align: 'right' });

  currentY += cardHeight + 8;

  // 2. INMUEBLES ASOCIADOS
  if (clientProps.length > 0) {
    checkPageBreak(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    pdf.text(`INMUEBLES VINCULADOS EN INVENTARIO (${clientProps.length})`, marginX, currentY);
    currentY += 4;

    clientProps.forEach((prop) => {
      checkPageBreak(28);
      const propBoxY = currentY;
      const propBoxH = 22;

      pdf.setFillColor(255, 255, 255);
      pdf.rect(marginX, propBoxY, contentWidth, propBoxH, 'F');
      pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
      pdf.setLineWidth(0.2);
      pdf.rect(marginX, propBoxY, contentWidth, propBoxH, 'S');

      // Título y Precio
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
      const safePropTitle = (prop.title || 'Inmueble').length > 55
        ? (prop.title || '').slice(0, 52) + '...'
        : prop.title || 'Inmueble';
      pdf.text(safePropTitle, marginX + 3, propBoxY + 5.5);

      pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      const priceStr = typeof prop.price === 'number' ? `$${prop.price.toLocaleString('es-VE')} USD` : String(prop.price || '');
      pdf.text(priceStr, pageWidth - marginX - 3, propBoxY + 5.5, { align: 'right' });

      // Ubicación y especificaciones
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      const specs = `${prop.sqm || 0} m² · ${prop.beds || 0} hab · ${prop.baths || 0} baños · Estado: ${prop.status || 'Activa'}`;
      pdf.text(`Ubicación: ${prop.location || 'No especificada'} (${specs})`, marginX + 3, propBoxY + 10.5);

      // Negociación y métodos de pago
      pdf.setFontSize(7);
      const negStr = `Negociación: ${prop.formasNegociacion || 'No especificada'}`;
      const pagoStr = `Pagos: ${prop.metodosPago || 'No especificado'}`;
      pdf.text(pdf.splitTextToSize(`${negStr} | ${pagoStr}`, contentWidth - 6), marginX + 3, propBoxY + 15.5);

      currentY += propBoxH + 3;
    });

    currentY += 5;
  }

  // 3. HISTORIAL DE INTERACCIONES
  checkPageBreak(15);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
  pdf.text(`HISTORIAL DE SEGUIMIENTO Y ACTIVIDADES (${client.history.length})`, marginX, currentY);
  currentY += 5;

  client.history.forEach((hist) => {
    const rawNotes = cleanInteractionNotes(hist.notas || '');
    const cleanNotes = sanitizeText(rawNotes);
    const dateFormatted = new Date(hist.fecha).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
    const isCaptacion = (hist.tipo || '').includes('Captación') || (hist.tipo || '').includes('Captar');

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    const lines = cleanNotes ? pdf.splitTextToSize(cleanNotes, contentWidth - 8) : [];
    const notesHeight = lines.length * 3.5;
    const itemHeight = 10 + notesHeight + 3;

    checkPageBreak(itemHeight);

    // Fondo del registro
    pdf.setFillColor(COLOR_BG_CARD[0], COLOR_BG_CARD[1], COLOR_BG_CARD[2]);
    pdf.rect(marginX, currentY, contentWidth, itemHeight, 'F');
    pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    pdf.setLineWidth(0.15);
    pdf.rect(marginX, currentY, contentWidth, itemHeight, 'S');

    // Indicador circular de tipo
    if (isCaptacion) {
      pdf.setFillColor(16, 185, 129);
    } else {
      pdf.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    }
    pdf.circle(marginX + 3.5, currentY + 4.5, 1.3, 'F');

    // Tipo y Asesor
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    pdf.text(hist.tipo || 'Interacción', marginX + 7, currentY + 5.5);

    if (hist.asesor) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      pdf.text(`(Asesor: ${hist.asesor})`, marginX + 8 + pdf.getTextWidth(hist.tipo || 'Interacción'), currentY + 5.5);
    }

    // Fecha
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    pdf.text(dateFormatted, pageWidth - marginX - 3, currentY + 5.5, { align: 'right' });

    // Notas
    if (lines.length > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(55, 65, 81);
      pdf.text(lines, marginX + 7, currentY + 9.5);
    }

    currentY += itemHeight + 2.5;
  });

  // Pie de página
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);

    pdf.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, pageHeight - 10, marginX + contentWidth, pageHeight - 10);
    pdf.text('RIV Margarita Premier · Documento confidencial de seguimiento comercial', marginX, pageHeight - 6);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 6, { align: 'right' });
  }

  const cleanFileName = client.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
  pdf.save(`Expediente_${cleanFileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function CRMPage() {
  const { user, isAdmin } = useAuth();
  const { crmLogs, addCrmLog, updateCrmLog, deleteCrmLog, appointments, properties, updateAppointment } = useData();

  const [search, setSearch] = useState('');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '',
    tipo_interaccion: 'Llamada',
    notas: ''
  });
  
  // Estado para exportación individual a PDF
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedClientForExport, setSelectedClientForExport] = useState<string>('');
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Estado para editar un registro existente del CRM
  const [editingLog, setEditingLog] = useState<{
    id: string;
    cliente: string;
    tipo_interaccion: string;
    notas: string;
  } | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // DT-04: Usa normalize compartido desde searchEngine.ts
  const myNombre = normalize(user?.nombre ?? '');

  // Derivar la lista de clientes (ya sea de citas o del crmLogs)
  const clientData = useMemo(() => {
    const clientsMap = new Map<string, any[]>();

    // 1. Integrar citas pasadas como historial también si lo deseamos (opcional, pero útil)
    appointments.forEach(app => {
      const isMyAppointment = app.asesores.some(a => normalize(a) === myNombre);
      if (isAdmin || isMyAppointment) {
        const clientName = (app.cliente || '').trim();
        // Si la cita no tiene cliente especificado (vacío), no se agrega al CRM
        if (!clientName) return;

        if (!clientsMap.has(clientName)) clientsMap.set(clientName, []);
        
        // LOG-07: Asegurar timezone explícita (-04:00 Margarita / Venezuela) para consistencia entre navegadores
        const horaIso = app.hora.length === 5 ? `${app.hora}:00` : app.hora;
        const fechaIso = new Date(`${app.fecha}T${horaIso}-04:00`).toISOString();

        clientsMap.get(clientName)?.push({
          id: `app-${app.id}`,
          tipo: 'Cita: ' + app.tipo,
          notas: `${app.titulo} - Estado: ${app.estado}`,
          fecha: fechaIso,
          asesor: app.asesores.join(', ')
        });
      }
    });

    // 2. Integrar crmLogs
    crmLogs.forEach(log => {
      const isMyLog = normalize(log.asesor) === myNombre;
      if (isAdmin || isMyLog) {
        const clientName = (log.cliente || '').trim();
        if (!clientName) return;

        if (!clientsMap.has(clientName)) clientsMap.set(clientName, []);
        clientsMap.get(clientName)?.push({
          id: log.id,
          tipo: log.tipo_interaccion,
          notas: log.notas,
          fecha: log.created_at,
          asesor: log.asesor
        });
      }
    });

    // Convertir el Map a array y ordenar
    const result = Array.from(clientsMap.entries()).map(([name, history]) => {
      // Ordenar historial del más reciente al más antiguo
      const sortedHistory = history.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      return {
        name,
        history: sortedHistory,
        lastInteraction: sortedHistory[0]?.fecha || new Date(0).toISOString()
      };
    });

    // Ordenar clientes por última interacción
    result.sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime());

    // Filtrar por búsqueda
    if (search) {
      const q = normalize(search);
      return result.filter(c => normalize(c.name).includes(q) || c.history.some(h => normalize(h.notas).includes(q)));
    }

    return result;
  }, [appointments, crmLogs, isAdmin, myNombre, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ROB-01: Validar tanto cliente como notas en la lógica JS antes de enviar
    if (!formData.cliente.trim() || !formData.notas.trim()) return;
    
    await addCrmLog({
      cliente: formData.cliente.trim(),
      asesor: user?.nombre ?? 'Desconocido',
      tipo_interaccion: formData.tipo_interaccion,
      notas: formData.notas.trim()
    });
    
    setIsModalOpen(false);
    setFormData({ cliente: '', tipo_interaccion: 'Llamada', notas: '' });
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de actividad?')) return;
    try {
      await deleteCrmLog(id);
    } catch (err) {
      console.error('Error al eliminar registro:', err);
      alert('No se pudo eliminar el registro.');
    }
  };

  const handleSaveEditLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !editingLog.notas.trim() || !editingLog.cliente.trim()) return;
    setIsSubmittingEdit(true);
    try {
      await updateCrmLog(editingLog.id, {
        cliente: editingLog.cliente.trim(),
        tipo_interaccion: editingLog.tipo_interaccion,
        notas: editingLog.notas.trim(),
      });
      setEditingLog(null);
    } catch (err) {
      console.error('Error al actualizar registro:', err);
      alert('No se pudo actualizar el registro.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Eliminar cliente del CRM (solo Admin)
  const handleDeleteClient = async (clientName: string) => {
    if (!isAdmin) {
      alert('Solo los administradores pueden eliminar clientes del CRM.');
      return;
    }

    const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente a "${clientName}" del CRM?\n\nEsta acción eliminará todos sus registros de seguimiento y desvinculará sus citas agendadas.`;
    if (!confirm(confirmMsg)) return;

    setIsDeletingClient(true);
    try {
      // 1. Eliminar logs del CRM de este cliente
      const clientLogs = crmLogs.filter(l => normalize(l.cliente) === normalize(clientName));
      for (const log of clientLogs) {
        await deleteCrmLog(log.id);
      }

      // 2. Desvincular citas con este cliente
      const clientApps = appointments.filter(a => normalize(a.cliente || '') === normalize(clientName));
      for (const app of clientApps) {
        await updateAppointment(app.id, { cliente: '' });
      }

      if (expandedClient === clientName) {
        setExpandedClient(null);
      }
      if (selectedClientForExport === clientName) {
        setSelectedClientForExport('');
      }
    } catch (err) {
      console.error('Error al eliminar cliente del CRM:', err);
      alert('No se pudo eliminar el cliente. Revisa tu conexión.');
    } finally {
      setIsDeletingClient(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content relative">
      <header className="bg-white px-4 pt-safe pt-6 pb-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">CRM Clientes</h1>
          <p className="text-xs text-gray-400 mt-0.5">{isAdmin ? 'Registro general de agencia' : `Mis clientes · ${user?.nombre}`}</p>
        </div>
        <button
          onClick={() => {
            if (clientData.length === 0) {
              alert('No hay clientes registrados para exportar.');
              return;
            }
            setSelectedClientForExport(expandedClient || clientData[0]?.name || '');
            setIsExportModalOpen(true);
          }}
          disabled={clientData.length === 0}
          className="flex items-center gap-1.5 text-xs font-bold bg-vinotinto/10 text-vinotinto px-3 py-2 rounded-xl transition-all hover:bg-vinotinto/20 active:scale-95 disabled:opacity-50"
          title="Exportar expediente de un cliente en PDF"
        >
          <FileText size={14} />
          Exportar PDF
        </button>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o nota..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none text-sm font-medium"
          />
        </div>

        <div className="space-y-4">
          {clientData.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 mt-4">
              <Briefcase className="mx-auto text-gray-300 mb-3" size={44} />
              <p className="text-gray-500 font-semibold">No hay clientes registrados.</p>
              <p className="text-sm text-gray-400 mt-1">Registra una interacción para empezar.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-28">
              {clientData.map((client) => {
                const clientProps = getClientProperties(client.name, client.history, properties);
                const clientPhone = client.history.map(h => extractPhone(h.notas || '')).find(Boolean) || null;

                return (
                  <div key={client.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedClient(expandedClient === client.name ? null : client.name)}
                      className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-full bg-vinotinto/10 flex items-center justify-center shrink-0">
                          <User size={20} className="text-vinotinto" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-800 text-sm">{client.name}</h3>
                            {clientProps.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-vinotinto/10 text-vinotinto flex items-center gap-1">
                                <Home size={10} /> {clientProps.length} inmueble{clientProps.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {client.history.length} interacción(es) · Última: {new Date(client.lastInteraction).toLocaleDateString('es-VE')}
                          </p>
                        </div>
                      </div>
                      <div className="text-gray-400">
                        {expandedClient === client.name ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedClient === client.name && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-100 bg-gray-50/50"
                        >
                          <div className="p-4 space-y-4">
                            
                            {/* 1. DATOS DEL CLIENTE / PROPIETARIO */}
                            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-sm space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                  <User size={12} className="text-vinotinto" /> Datos del Cliente
                                </span>
                                {clientProps.length > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Propietario Activo
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="text-sm font-bold text-gray-800">{client.name}</p>
                                  {clientPhone ? (
                                    <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                                      <Phone size={11} className="text-vinotinto" /> {clientPhone}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-gray-400 mt-0.5">Sin teléfono registrado</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {clientPhone && (
                                    <>
                                      <a
                                        href={`https://wa.me/${clientPhone.startsWith('+') ? clientPhone.slice(1) : clientPhone.startsWith('0') ? '58' + clientPhone.slice(1) : clientPhone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
                                      >
                                        <MessageCircle size={13} /> WhatsApp
                                      </a>
                                      <a
                                        href={`tel:${clientPhone}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition active:scale-95"
                                      >
                                        <Phone size={13} /> Llamar
                                      </a>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => exportClientPDF(client, clientProps, clientPhone)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-vinotinto/10 hover:bg-vinotinto/20 text-vinotinto rounded-xl text-xs font-bold transition active:scale-95"
                                    title="Descargar expediente completo en PDF"
                                  >
                                    <FileText size={13} /> Exportar PDF
                                  </button>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClient(client.name)}
                                      disabled={isDeletingClient}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition active:scale-95 border border-red-200 disabled:opacity-50"
                                      title="Eliminar este cliente del CRM"
                                    >
                                      <Trash2 size={13} /> Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 2. PROPIEDADES A SU NOMBRE */}
                            {clientProps.length > 0 && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between px-0.5">
                                  <h4 className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Home size={13} className="text-vinotinto" /> Propiedades a su nombre ({clientProps.length})
                                  </h4>
                                  <span className="text-[10px] text-gray-400">Inmuebles en inventario</span>
                                </div>

                                {clientProps.map((prop, pIdx) => (
                                  <div key={prop.id || `prop-${pIdx}`} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm space-y-2.5">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-2.5">
                                        {prop.image ? (
                                          <img src={prop.image} alt={prop.title} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-100" />
                                        ) : (
                                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-400">
                                            <Home size={20} />
                                          </div>
                                        )}
                                        <div>
                                          {prop.id ? (
                                            <Link
                                              href={`/inventario/${prop.id}`}
                                              className="text-sm font-bold text-gray-900 hover:text-vinotinto transition-colors flex items-center gap-1 line-clamp-1"
                                            >
                                              {prop.title} <ExternalLink size={12} className="shrink-0 text-gray-400" />
                                            </Link>
                                          ) : (
                                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{prop.title}</p>
                                          )}
                                          {prop.location && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 line-clamp-1">
                                              <MapPin size={11} className="text-vinotinto/70 shrink-0" /> {prop.location}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                            {prop.sqm ? <span>{prop.sqm} m²</span> : null}
                                            {prop.beds ? <span>· {prop.beds} hab</span> : null}
                                            {prop.baths ? <span>· {prop.baths} baños</span> : null}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        {prop.price && (
                                          <span className="text-sm font-black text-vinotinto block">
                                            {typeof prop.price === 'number' ? `$${prop.price.toLocaleString('es-VE')} USD` : prop.price}
                                          </span>
                                        )}
                                        {prop.status && (
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 border ${
                                            prop.status === 'Activa' ? 'bg-green-50 text-green-700 border-green-200'
                                            : prop.status === 'Vendida' ? 'bg-gray-100 text-gray-600 border-gray-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                          }`}>
                                            {prop.status}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Información de Negociación y Pagos */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                                      <div className="bg-gray-50 p-2.5 rounded-xl">
                                        <span className="text-gray-500 font-bold flex items-center gap-1 mb-1 text-[11px]">
                                          <CircleDollarSign size={12} className="text-vinotinto" /> Formas de Negociación
                                        </span>
                                        <p className="text-gray-800 font-medium text-xs leading-relaxed">
                                          {prop.formasNegociacion || 'No especificada'}
                                        </p>
                                      </div>

                                      <div className="bg-gray-50 p-2.5 rounded-xl">
                                        <span className="text-gray-500 font-bold flex items-center gap-1 mb-1 text-[11px]">
                                          <CreditCard size={12} className="text-emerald-700" /> Métodos de Pago
                                        </span>
                                        <p className="text-gray-800 font-medium text-xs leading-relaxed">
                                          {prop.metodosPago || 'No especificado'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 3. HISTORIAL DE INTERACCIONES Y SEGUIMIENTO */}
                            <div className="space-y-3 pt-1">
                              <h4 className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 px-0.5">
                                <Calendar size={13} className="text-vinotinto" /> Historial de Actividad ({client.history.length})
                              </h4>

                              {client.history.map((hist, idx) => {
                                const isCaptacion = hist.tipo.includes('Captación') || hist.tipo.includes('Captar');
                                const cleanedNotes = cleanInteractionNotes(hist.notas || '');
                                const isCrmRecord = !hist.id.startsWith('app-');
                                const isMyLog = normalize(hist.asesor || '') === myNombre;
                                const canManageLog = (isAdmin || isMyLog) && isCrmRecord;

                                return (
                                  <div key={hist.id} className="relative pl-4 border-l-2 border-vinotinto/20 pb-4 last:pb-0">
                                    <div className={`absolute w-2.5 h-2.5 rounded-full -left-[5px] top-1 border-2 border-white ${isCaptacion ? 'bg-emerald-600' : 'bg-vinotinto'}`} />
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded shadow-sm border inline-flex items-center gap-1 ${
                                          isCaptacion
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            : 'bg-white text-gray-800 border-gray-100'
                                        }`}>
                                          {isCaptacion && <Home size={12} className="text-emerald-700" />}
                                          {hist.tipo}
                                        </span>
                                        {hist.asesor && (
                                          <span className="text-[10px] text-gray-400 font-medium">
                                            {hist.asesor}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] text-gray-500 font-medium">
                                          {new Date(hist.fecha).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>

                                        {canManageLog && (
                                          <div className="flex items-center gap-0.5 ml-1">
                                            <button
                                              type="button"
                                              onClick={() => setEditingLog({
                                                id: hist.id,
                                                cliente: client.name,
                                                tipo_interaccion: hist.tipo,
                                                notas: hist.notas || '',
                                              })}
                                              title="Editar registro"
                                              className="p-1 text-gray-400 hover:text-vinotinto hover:bg-vinotinto/10 rounded-md transition"
                                            >
                                              <Edit2 size={12} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteLog(hist.id)}
                                              title="Eliminar registro"
                                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {cleanedNotes && (
                                      <div className="mt-2 bg-white p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line break-words">
                                          {sanitizeText(cleanedNotes)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              onClick={() => {
                                setFormData(prev => ({ ...prev, cliente: client.name }));
                                setIsModalOpen(true);
                              }}
                              className="w-full py-2.5 mt-2 bg-white border border-vinotinto/20 text-vinotinto text-xs font-bold rounded-xl hover:bg-vinotinto hover:text-white transition-colors"
                            >
                              + Añadir Registro de Seguimiento
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
          </div>
        )}
        </div>
      </div>

      {/* FAB para nuevo cliente/registro global */}
      <button
        onClick={() => {
          setFormData({ cliente: '', tipo_interaccion: 'Llamada', notas: '' });
          setIsModalOpen(true);
        }}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom)+1rem)] right-5 w-14 h-14 bg-vinotinto text-white rounded-full flex items-center justify-center shadow-lg shadow-vinotinto/30 active:scale-90 transition-transform z-20"
      >
        <Plus size={28} />
      </button>

      {/* MODAL */}
      <AnimatePresence>
      {isModalOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4 sm:items-center"
        >
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Nuevo Registro CRM</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
                <input type="text" name="cliente" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} required
                  placeholder="Ej: María López"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Interacción</label>
                <select name="tipo_interaccion" value={formData.tipo_interaccion} onChange={e => setFormData({...formData, tipo_interaccion: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none font-medium text-gray-800">
                  <option value="Llamada">📞 Llamada</option>
                  <option value="Captación de Inmueble">🏠 Captación de Inmueble</option>
                  <option value="Mensaje (WhatsApp)">💬 Mensaje (WhatsApp)</option>
                  <option value="Reunión Presencial">🤝 Reunión Presencial</option>
                  <option value="Visita a Inmueble">🏠 Visita a Inmueble</option>
                  <option value="Oferta Recibida">📝 Oferta Recibida</option>
                  <option value="Cierre / Venta">✅ Cierre / Venta</option>
                  <option value="Otro">📌 Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Detalles</label>
                <textarea name="notas" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} required
                  placeholder="Detalles de la conversación o avances..."
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none resize-none" />
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-vinotinto to-[#a60029] text-white rounded-xl font-bold shadow-lg shadow-vinotinto/20 transition-all"
              >
                Guardar Registro
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* MODAL EDICIÓN REGISTRO CRM */}
      <AnimatePresence>
      {editingLog && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        >
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Editar Registro CRM</h2>
                <p className="text-xs text-gray-400 mt-0.5">Modifica los detalles del registro</p>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingLog(null)} 
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditLog} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
                <input 
                  type="text" 
                  value={editingLog.cliente} 
                  onChange={e => setEditingLog({ ...editingLog, cliente: e.target.value })} 
                  required
                  placeholder="Ej: María López"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Interacción</label>
                <select 
                  value={editingLog.tipo_interaccion} 
                  onChange={e => setEditingLog({ ...editingLog, tipo_interaccion: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none font-medium text-gray-800 text-sm"
                >
                  <option value="Llamada">📞 Llamada</option>
                  <option value="Captación de Inmueble">🏠 Captación de Inmueble</option>
                  <option value="Mensaje (WhatsApp)">💬 Mensaje (WhatsApp)</option>
                  <option value="Reunión Presencial">🤝 Reunión Presencial</option>
                  <option value="Visita a Inmueble">🏠 Visita a Inmueble</option>
                  <option value="Oferta Recibida">📝 Oferta Recibida</option>
                  <option value="Cierre / Venta">✅ Cierre / Venta</option>
                  <option value="Otro">📌 Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Detalles</label>
                <textarea 
                  value={editingLog.notas} 
                  onChange={e => setEditingLog({ ...editingLog, notas: e.target.value })} 
                  required
                  placeholder="Detalles de la conversación o avances..."
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none resize-none text-sm" 
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="w-full sm:w-1/2 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm text-center"
                >
                  Cancelar
                </button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="w-full sm:w-1/2 py-3 bg-gradient-to-r from-vinotinto to-[#a60029] text-white rounded-xl font-bold shadow-lg shadow-vinotinto/20 transition-all text-sm disabled:opacity-50 text-center"
                >
                  {isSubmittingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* MODAL SELECCIÓN DE CLIENTE PARA EXPORTAR PDF */}
      <AnimatePresence>
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe"
          >
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-vinotinto" />
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Exportar Expediente PDF</h2>
                  <p className="text-xs text-gray-400">Selecciona el cliente a exportar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Cliente a Exportar
                </label>
                <select
                  value={selectedClientForExport}
                  onChange={e => setSelectedClientForExport(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none font-medium text-gray-800 text-sm"
                >
                  {clientData.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.history.length} actividad{c.history.length === 1 ? '' : 'es'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Vista previa del cliente seleccionado */}
              {(() => {
                const targetClient = clientData.find(c => c.name === selectedClientForExport) || clientData[0];
                if (!targetClient) return null;
                const targetProps = getClientProperties(targetClient.name, targetClient.history, properties);
                const targetPhone = targetClient.history.map(h => extractPhone(h.notas || '')).find(Boolean) || null;

                return (
                  <div className="p-4 bg-vinotinto/5 border border-vinotinto/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-800 text-sm">{targetClient.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
                        {targetProps.length > 0 ? 'Propietario' : 'Prospecto'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Teléfono:</span>
                        <span className="font-medium">{targetPhone || 'Sin registrar'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Última actividad:</span>
                        <span className="font-medium">{new Date(targetClient.lastInteraction).toLocaleDateString('es-VE')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Inmuebles:</span>
                        <span className="font-medium">{targetProps.length} inmueble(s)</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Interacciones:</span>
                        <span className="font-medium">{targetClient.history.length} registro(s)</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="w-full sm:w-1/2 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetClient = clientData.find(c => c.name === selectedClientForExport) || clientData[0];
                    if (targetClient) {
                      const targetProps = getClientProperties(targetClient.name, targetClient.history, properties);
                      const targetPhone = targetClient.history.map(h => extractPhone(h.notas || '')).find(Boolean) || null;
                      exportClientPDF(targetClient, targetProps, targetPhone);
                      setIsExportModalOpen(false);
                    }
                  }}
                  className="w-full sm:w-1/2 py-3 bg-gradient-to-r from-vinotinto to-[#a60029] text-white rounded-xl font-bold shadow-lg shadow-vinotinto/20 transition-all text-sm flex items-center justify-center gap-1.5 hover:opacity-95 active:scale-95 text-center"
                >
                  <Download size={14} />
                  Descargar PDF
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
