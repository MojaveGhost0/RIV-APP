'use client';

import { useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ShieldAlert, Plus, User, Calendar, FileText, Download, X, Search, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { normalize } from '../lib/searchEngine';

// SEC-05: Sanitización preventiva de texto contra scripts o tags HTML maliciosos
function sanitizeText(str: string): string {
  if (!str) return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '');
}

export default function CRMPage() {
  const { user, isAdmin } = useAuth();
  const { crmLogs, addCrmLog, appointments } = useData();

  const [search, setSearch] = useState('');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '',
    tipo_interaccion: 'Llamada',
    notas: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  // DT-04: Usa normalize compartido desde searchEngine.ts
  const myNombre = normalize(user?.nombre ?? '');

  // Derivar la lista de clientes (ya sea de citas o del crmLogs)
  const clientData = useMemo(() => {
    const clientsMap = new Map<string, any[]>();

    // 1. Integrar citas pasadas como historial también si lo deseamos (opcional, pero útil)
    appointments.forEach(app => {
      const isMyAppointment = app.asesores.some(a => normalize(a) === myNombre);
      if (isAdmin || isMyAppointment) {
        const clientName = app.cliente.trim();
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
        const clientName = log.cliente.trim();
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

  const exportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CRM_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsExporting(false);
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
          onClick={exportPDF}
          disabled={isExporting || clientData.length === 0}
          className="flex items-center gap-1 text-xs font-bold bg-vinotinto/10 text-vinotinto px-3 py-2 rounded-xl transition-all hover:bg-vinotinto/20 active:scale-95 disabled:opacity-50"
        >
          <Download size={14} />
          {isExporting ? 'Generando...' : 'PDF'}
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

        {/* ROB-06: printRef envuelve únicamente el reporte de clientes y no la barra de búsqueda */}
        <div ref={printRef} className="space-y-4">
          {clientData.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 mt-4">
              <Briefcase className="mx-auto text-gray-300 mb-3" size={44} />
              <p className="text-gray-500 font-semibold">No hay clientes registrados.</p>
              <p className="text-sm text-gray-400 mt-1">Registra una interacción para empezar.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-28">
            {clientData.map((client) => (
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
                      <h3 className="font-bold text-gray-800 text-sm">{client.name}</h3>
                      <p className="text-xs text-gray-400">
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
                        {client.history.map((hist, idx) => (
                          <div key={hist.id} className="relative pl-4 border-l-2 border-vinotinto/20 pb-4 last:pb-0">
                            <div className="absolute w-2.5 h-2.5 bg-vinotinto rounded-full -left-[5px] top-1 border-2 border-white" />
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-gray-800 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 inline-block">
                                {hist.tipo}
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium">
                                {new Date(hist.fecha).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            {hist.notas && (
                              <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded-lg border border-gray-100 leading-relaxed break-words">
                                {sanitizeText(hist.notas)}
                              </p>
                            )}
                            {isAdmin && (
                              <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                                Asesor: {hist.asesor}
                              </p>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setFormData(prev => ({ ...prev, cliente: client.name }));
                            setIsModalOpen(true);
                          }}
                          className="w-full py-2.5 mt-2 bg-white border border-vinotinto/20 text-vinotinto text-xs font-bold rounded-xl hover:bg-vinotinto hover:text-white transition-colors"
                        >
                          + Añadir Registro
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
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
    </div>
  );
}
