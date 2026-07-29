'use client';

import { useState } from 'react';
import { Bell, X, Calendar, MessageSquare, AlertCircle } from 'lucide-react';

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'cita',
    title: 'Nueva Cita Asignada',
    message: 'Tienes una cita para mostrar la Villa Exclusiva a las 14:30.',
    time: 'Hace 10 min',
    read: false
  },
  {
    id: 2,
    type: 'sistema',
    title: 'Propiedad Publicada',
    message: 'Tu captación "Apto Vista al Mar" fue aprobada.',
    time: 'Hace 2 horas',
    read: true
  }
];

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'cita': return <Calendar size={18} className="text-blue-500" />;
      case 'sistema': return <AlertCircle size={18} className="text-vinotinto" />;
      default: return <MessageSquare size={18} className="text-gray-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-vinotinto hover:bg-vinotinto/10 rounded-full transition-colors"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dorado opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-dorado border-2 border-white"></span>
          </span>
        )}
      </button>

      {/* DROPDOWN */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Notificaciones</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {MOCK_NOTIFICATIONS.length > 0 ? (
              MOCK_NOTIFICATIONS.map((notif) => (
                <div key={notif.id} className={`p-4 border-b border-gray-50 flex gap-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-vinotinto/5' : ''}`}>
                  <div className="mt-1 flex-shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold ${!notif.read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {notif.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-gray-400 mt-2 block font-medium">{notif.time}</span>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-vinotinto rounded-full self-center ml-auto"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">
                No tienes notificaciones
              </div>
            )}
          </div>
          
          <div className="p-3 text-center border-t border-gray-100">
            <button className="text-sm font-bold text-vinotinto hover:text-vinotinto-light transition-colors">
              Marcar todas como leídas
            </button>
          </div>
        </div>
      )}
      
      {/* OVERLAY PARA CERRAR (MÓVIL) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}
