'use client';

import { Home, List, Calendar, User, BarChart2, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { href: '/',            label: 'Inicio',     Icon: Home      },
  { href: '/inventario',  label: 'Inventario', Icon: List      },
  { href: '/citas',       label: 'Agenda',     Icon: Calendar  },
  { href: '/crm',         label: 'CRM',        Icon: Briefcase },
] as const;

const adminTab = { href: '/estadisticas', label: 'KPIs', Icon: BarChart2 } as const;
const profileTab = { href: '/perfil',     label: 'Perfil', Icon: User   } as const;

export default function BottomTabBar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const allTabs = isAdmin
    ? [...tabs, adminTab, profileTab]
    : [...tabs, profileTab];

  return (
    <nav className="bottom-tab-bar fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-stretch px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] z-50">
      {allTabs.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors relative ${
              active ? 'text-vinotinto' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {/* Indicador activo — línea en la parte superior */}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-vinotinto rounded-b-full" />
            )}
            <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
            <span className={`text-[10px] font-semibold leading-none ${active ? 'text-vinotinto' : ''}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
