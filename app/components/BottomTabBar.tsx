'use client';

import { Home, List, Calendar, User, BarChart2, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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
    <nav className="bottom-tab-bar fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-lg border-t border-gray-200/70 flex justify-around items-stretch px-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] z-50 transition-all">
      {allTabs.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center w-full h-full gap-0.5 relative transition-colors ${
              active ? 'text-vinotinto' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {/* Indicador activo — barra con gradiente y destello dorado */}
            {active && (
              <motion.span
                layoutId="bottomTabActivePill"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-dorado via-vinotinto to-dorado rounded-b-full shadow-xs shadow-vinotinto/30"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Contenedor del ícono y texto */}
            <motion.div
              whileTap={{ scale: 0.92 }}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 ${
                active
                  ? 'bg-vinotinto/10 text-vinotinto shadow-xs border border-vinotinto/10'
                  : 'hover:bg-gray-100/60'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.3 : 1.8} className="transition-transform" />
              <span className={`text-[10px] font-bold tracking-tight leading-none ${active ? 'text-vinotinto font-extrabold' : ''}`}>
                {label}
              </span>
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}

