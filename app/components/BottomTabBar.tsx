'use client';

import { Home, List, Calendar, User, BarChart2, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function BottomTabBar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  // FIX UI#1 — El tab debe resaltar también en sub-rutas (ej: /inventario/123, /inventario/registro).
  // La ruta raíz '/' se compara exactamente para no activarse en todas las demás.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const linkClass = (href: string) =>
    `flex flex-col items-center justify-center w-full h-full transition-colors ${
      isActive(href) ? 'text-vinotinto' : 'text-gray-400 hover:text-vinotinto'
    }`;

  return (
    // Usamos la clase 'bottom-tab-bar' de globals.css para manejar el safe-area del notch (iPhone)
    <nav className="bottom-tab-bar fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-stretch px-1 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-50">
      
      <Link href="/" className={linkClass('/')}>
        <Home size={22} />
        <span className="text-[10px] mt-0.5 font-semibold">Inicio</span>
      </Link>

      <Link href="/inventario" className={linkClass('/inventario')}>
        <List size={22} />
        <span className="text-[10px] mt-0.5 font-semibold">Inventario</span>
      </Link>

      <Link href="/citas" className={linkClass('/citas')}>
        <Calendar size={22} />
        <span className="text-[10px] mt-0.5 font-semibold">Citas</span>
      </Link>

      <Link href="/crm" className={linkClass('/crm')}>
        <Briefcase size={22} />
        <span className="text-[10px] mt-0.5 font-semibold">CRM</span>
      </Link>

      {/* KPIs: SOLO visible para ADMINISTRADOR */}
      {isAdmin && (
        <Link href="/estadisticas" className={linkClass('/estadisticas')}>
          <BarChart2 size={22} />
          <span className="text-[10px] mt-0.5 font-semibold">KPIs</span>
        </Link>
      )}

      <Link href="/perfil" className={linkClass('/perfil')}>
        <User size={22} />
        <span className="text-[10px] mt-0.5 font-semibold">Perfil</span>
      </Link>
    </nav>
  );
}
