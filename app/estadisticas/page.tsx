'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Home, CheckCircle, Users, ShieldAlert,
  MapPin, DollarSign, AlertTriangle, TrendingDown, Lightbulb,
  BarChart2, Megaphone, Target, Star,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Property } from '../context/DataContext';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('es-VE', { maximumFractionDigits: 0 });

/** Extrae el municipio del formato "Zona, Municipio, Isla…" o devuelve la ubicación cruda */
function getMunicipio(location: string): string {
  const parts = location.split(',');
  if (parts.length >= 2) return parts[1].trim();
  return parts[0].trim();
}

/** Precio por m² */
const ppm2 = (p: Property) => (p.sqm > 0 ? p.price / p.sqm : 0);

/** Clasifica un inmueble respecto al precio promedio/m² de su tipo */
function clasificarPrecio(
  prop: Property,
  avgPricePerSqm: number,
): 'sobre' | 'justo' | 'bajo' {
  if (avgPricePerSqm === 0 || prop.sqm === 0) return 'justo';
  const ratio = ppm2(prop) / avgPricePerSqm;
  if (ratio > 1.2) return 'sobre';
  if (ratio < 0.8) return 'bajo';
  return 'justo';
}

// ─── Tooltips ────────────────────────────────────────────────────────────────
const DonutTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-xl shadow-lg border border-gray-100 text-center">
        <p className="text-xs font-bold" style={{ color: payload[0].payload.color }}>{payload[0].name}</p>
        <p className="text-xl font-extrabold text-gray-800">{payload[0].value}</p>
        <p className="text-[10px] text-gray-400">inmuebles</p>
      </div>
    );
  }
  return null;
};

const BarTooltipZona = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-xl shadow-lg border border-gray-100">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        <p className="text-sm font-extrabold text-vinotinto">{payload[0].value} inmuebles</p>
      </div>
    );
  }
  return null;
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Estadisticas() {
  const { isAdmin, getAllUsers } = useAuth();
  const { properties, appointments } = useData();
  const router = useRouter();
  const [filtroAsesor, setFiltroAsesor] = useState('Todos');

  useEffect(() => {
    if (!isAdmin) router.replace('/');
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <ShieldAlert size={48} className="text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
        <p className="text-sm text-gray-500">Esta sección es exclusiva para Administradores.</p>
      </div>
    );
  }

  // =============================================================================
  // CÁLCULOS
  // =============================================================================

  // 1. Estado del inventario
  const activos    = properties.filter(p => p.status === 'Activa').length;
  const vendidos   = properties.filter(p => p.status === 'Vendida').length;
  const suspendidos= properties.filter(p => p.status === 'Suspendida').length;
  const totalInmuebles = properties.length;

  const STATUS_DATA = [
    { name: 'Activos',     value: activos,      color: '#800020' },
    { name: 'Vendidos',    value: vendidos,     color: '#D4AF37' },
    { name: 'Suspendidos', value: suspendidos,  color: '#9CA3AF' },
  ];

  // 2. Captaciones por asesor (mes actual)
  const allUsers = getAllUsers();
  const currentMonth = new Date().getMonth();
  const currentYear  = new Date().getFullYear();

  const CAPTACIONES_MES = allUsers.map(u => ({
    asesorFull: u.nombre,
    asesor: u.nombre.split(' ')[0] + ' ' + (u.nombre.split(' ')[1]?.[0] + '.' || ''),
    captaciones: properties.filter(p => p.captador === u.nombre).length,
  }));

  const nuevasCaptaciones = properties.filter(p => {
    if (!p.createdAt) return false;
    const d = new Date(p.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const citasConcretadas = appointments.filter(a => {
    if (a.estado !== 'Completada') return false;
    const d = new Date(a.fecha);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const mesCapitalizado = (() => {
    const m = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    return m.charAt(0).toUpperCase() + m.slice(1);
  })();

  const asesoresNombres = ['Todos', ...CAPTACIONES_MES.map(c => c.asesor)];
  const dataFiltrada = filtroAsesor === 'Todos'
    ? CAPTACIONES_MES
    : CAPTACIONES_MES.filter(c => c.asesor === filtroAsesor);

  // 3. Inmuebles por municipio / zona
  const zonaCount: Record<string, number> = {};
  properties.forEach(p => {
    const z = getMunicipio(p.location);
    zonaCount[z] = (zonaCount[z] ?? 0) + 1;
  });
  const ZONA_DATA = Object.entries(zonaCount)
    .sort((a, b) => b[1] - a[1])
    .map(([zona, count]) => ({ zona, count }));

  // 4. Precio promedio, mín, máx (solo activos)
  const activos_props = properties.filter(p => p.status === 'Activa');
  const precioPromedio = activos_props.length
    ? activos_props.reduce((s, p) => s + p.price, 0) / activos_props.length
    : 0;
  const precioMin = activos_props.length ? Math.min(...activos_props.map(p => p.price)) : 0;
  const precioMax = activos_props.length ? Math.max(...activos_props.map(p => p.price)) : 0;

  // Precio promedio por m² (activos con sqm > 0)
  const conSqm = activos_props.filter(p => p.sqm > 0);
  const avgPpm2 = conSqm.length
    ? conSqm.reduce((s, p) => s + ppm2(p), 0) / conSqm.length
    : 0;

  // 5. Análisis de precio por inmueble
  const priceAnalysis = properties
    .filter(p => p.status === 'Activa')
    .map(p => ({
      ...p,
      clasif: clasificarPrecio(p, avgPpm2),
      ppm2: ppm2(p),
    }));

  const sobrePrecio = priceAnalysis.filter(p => p.clasif === 'sobre');
  const bajoPrecio  = priceAnalysis.filter(p => p.clasif === 'bajo');
  const precioJusto = priceAnalysis.filter(p => p.clasif === 'justo');

  // 6. Precio promedio por tipo
  const tipoStats: Record<string, { total: number; count: number; totalSqm: number; sqmCount: number }> = {};
  properties.forEach(p => {
    const t = p.propertyType ?? 'Sin tipo';
    if (!tipoStats[t]) tipoStats[t] = { total: 0, count: 0, totalSqm: 0, sqmCount: 0 };
    tipoStats[t].total += p.price;
    tipoStats[t].count += 1;
    if (p.sqm > 0) { tipoStats[t].totalSqm += p.price / p.sqm; tipoStats[t].sqmCount += 1; }
  });
  const TIPO_DATA = Object.entries(tipoStats)
    .map(([tipo, s]) => ({
      tipo: tipo.replace(' / ', '/'),
      promedio: Math.round(s.total / s.count),
      count: s.count,
    }))
    .sort((a, b) => b.promedio - a.promedio);

  // 7. Recomendaciones de marketing
  const recomendaciones: { icon: React.ReactNode; titulo: string; texto: string; color: string }[] = [];

  if (sobrePrecio.length > 0) {
    recomendaciones.push({
      icon: <AlertTriangle size={16} />,
      titulo: `${sobrePrecio.length} propiedad(es) sobre precio`,
      texto: `${sobrePrecio.map(p => p.title).join(', ')} están por encima del precio promedio/m² del mercado local. Considera ajustar el precio o resaltar características exclusivas para justificarlo.`,
      color: 'amber',
    });
  }

  if (bajoPrecio.length > 0) {
    recomendaciones.push({
      icon: <TrendingDown size={16} />,
      titulo: `${bajoPrecio.length} propiedad(es) oportunidad de precio`,
      texto: `${bajoPrecio.map(p => p.title).join(', ')} están por debajo del promedio/m². Son excelentes opciones para promover como "oportunidad de inversión" en redes sociales.`,
      color: 'green',
    });
  }

  if (ZONA_DATA.length > 0 && ZONA_DATA[0].count >= 2) {
    recomendaciones.push({
      icon: <MapPin size={16} />,
      titulo: `Alta concentración en ${ZONA_DATA[0].zona}`,
      texto: `Tienes ${ZONA_DATA[0].count} inmuebles en ${ZONA_DATA[0].zona}. Considera crear contenido de zona (recorrido virtual, video del sector) para posicionarte como el experto de esa área.`,
      color: 'blue',
    });
  }

  const sinFoto = properties.filter(p => !p.image || p.images?.length === 0).length;
  if (sinFoto > 0) {
    recomendaciones.push({
      icon: <Megaphone size={16} />,
      titulo: `${sinFoto} inmueble(s) sin fotografías`,
      texto: 'Los inmuebles sin fotos reciben hasta 90% menos de consultas. Prioriza la sesión fotográfica de estos para mejorar su visibilidad.',
      color: 'red',
    });
  }

  if (suspendidos > 0) {
    recomendaciones.push({
      icon: <Target size={16} />,
      titulo: `${suspendidos} inmueble(s) suspendido(s)`,
      texto: 'Revisa los inmuebles suspendidos. Una actualización de precio o mejoras en la descripción pueden reactivarlos y convertirlos en ventas este mes.',
      color: 'gray',
    });
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push({
      icon: <Star size={16} />,
      titulo: 'Inventario saludable',
      texto: 'Todos tus inmuebles activos tienen precios competitivos y están bien documentados. Mantén la frecuencia de publicaciones en redes para sostener el flujo de clientes.',
      color: 'green',
    });
  }

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
    red:   'bg-red-50 border-red-200 text-red-700',
    gray:  'bg-gray-50 border-gray-200 text-gray-600',
  };
  const iconColorMap: Record<string, string> = {
    amber: 'text-amber-500', green: 'text-green-500',
    blue: 'text-blue-500',  red: 'text-red-500', gray: 'text-gray-400',
  };

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content">

      {/* HEADER */}
      <header className="bg-white px-5 pt-8 pb-5 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-vinotinto/10 p-1.5 rounded-lg">
            <TrendingUp size={16} className="text-vinotinto" />
          </div>
          <p className="text-[10px] font-bold text-vinotinto uppercase tracking-widest">Solo Admin</p>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Estadísticas</h1>
        <p className="text-xs text-gray-400 mt-0.5">{mesCapitalizado}</p>
      </header>

      <div className="p-4 space-y-5 pb-28">

        {/* ── KPI MINI CARDS ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <CheckCircle size={20} className="text-vinotinto" />, value: citasConcretadas,  label: 'Citas\nConcretadas' },
            { icon: <Home        size={20} className="text-dorado-dark" />,value: nuevasCaptaciones, label: 'Captaciones\nMes' },
            { icon: <Users       size={20} className="text-blue-500" />,   value: allUsers.length,   label: 'Asesores\nActivos' },
          ].map((k, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center gap-1">
              {k.icon}
              <p className="text-2xl font-extrabold text-gray-800 leading-none">{k.value}</p>
              <p className="text-[10px] text-gray-500 font-semibold leading-tight whitespace-pre-line">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── PRECIO PROMEDIO DEL MERCADO ─────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-1">💰 Precio del Mercado</h2>
          <p className="text-xs text-gray-400 mb-4">Solo inmuebles activos · {activos} en total</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Precio Promedio', value: `$${fmt(precioPromedio)}`, sub: 'USD', color: 'text-vinotinto' },
              { label: 'Precio Mínimo',   value: `$${fmt(precioMin)}`,      sub: 'USD', color: 'text-green-600' },
              { label: 'Precio Máximo',   value: `$${fmt(precioMax)}`,      sub: 'USD', color: 'text-amber-600' },
            ].map(c => (
              <div key={c.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">{c.label}</p>
                <p className={`text-base font-extrabold ${c.color} leading-tight`}>{c.value}</p>
                <p className="text-[9px] text-gray-300">{c.sub}</p>
              </div>
            ))}
          </div>
          {avgPpm2 > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-vinotinto/5 rounded-xl px-4 py-2.5">
              <BarChart2 size={14} className="text-vinotinto shrink-0" />
              <p className="text-xs text-vinotinto font-semibold">
                Precio promedio por m²: <span className="font-extrabold">${fmt(avgPpm2)} USD/m²</span>
              </p>
            </div>
          )}
        </div>

        {/* ── ANÁLISIS DE PRECIO POR INMUEBLE ─────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-1">📊 Análisis de Precio</h2>
          <p className="text-xs text-gray-400 mb-4">
            Comparado con el precio promedio/m² del mercado local
          </p>

          {/* Resumen 3 chips */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Sobre precio',   count: sobrePrecio.length,  bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400' },
              { label: 'Precio justo',   count: precioJusto.length,  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
              { label: 'Bajo precio',    count: bajoPrecio.length,   bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400'  },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${c.text}`}>{c.count}</p>
                <p className={`text-[10px] font-bold ${c.text} leading-tight mt-0.5`}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* Lista de inmuebles sobre precio */}
          {sobrePrecio.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={10} /> Sobre precio
              </p>
              <div className="space-y-2">
                {sobrePrecio.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-amber-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800 leading-tight">{p.title}</p>
                      <p className="text-[10px] text-gray-500">${fmt(p.price)} · {p.sqm}m²</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-amber-600">${fmt(p.ppm2)}/m²</p>
                      <p className="text-[9px] text-amber-400">+{Math.round((p.ppm2/avgPpm2-1)*100)}% vs promedio</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de inmuebles bajo precio */}
          {bajoPrecio.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <TrendingDown size={10} /> Oportunidades (bajo precio)
              </p>
              <div className="space-y-2">
                {bajoPrecio.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-blue-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800 leading-tight">{p.title}</p>
                      <p className="text-[10px] text-gray-500">${fmt(p.price)} · {p.sqm}m²</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-blue-600">${fmt(p.ppm2)}/m²</p>
                      <p className="text-[9px] text-blue-400">{Math.round((1-p.ppm2/avgPpm2)*100)}% bajo promedio</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── PRECIO PROMEDIO POR TIPO ─────────────────────────────────────── */}
        {TIPO_DATA.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-1">🏷️ Precio por Tipo de Propiedad</h2>
            <p className="text-xs text-gray-400 mb-4">Precio promedio en USD</p>
            <ResponsiveContainer width="100%" height={Math.max(140, TIPO_DATA.length * 38)}>
              <BarChart data={TIPO_DATA} layout="vertical" barSize={18} margin={{ top:0, right:60, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="tipo" width={90}
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#6B7280' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  formatter={(v: any) => [`$${fmt(v)} USD`, 'Precio promedio']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #F3F4F6', fontSize: '11px' }}
                  cursor={{ fill: '#F9FAFB', radius: 4 }}
                />
                <Bar dataKey="promedio" fill="#800020" radius={[0, 8, 8, 0]}
                  label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: '#800020',
                    formatter: (v: number) => `$${fmt(v)}` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── INMUEBLES POR ZONA ───────────────────────────────────────────── */}
        {ZONA_DATA.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-1">📍 Inmuebles por Zona</h2>
            <p className="text-xs text-gray-400 mb-4">{ZONA_DATA.length} zona(s) con propiedades</p>
            <div className="space-y-2.5">
              {ZONA_DATA.map(({ zona, count }) => {
                const pct = Math.round((count / totalInmuebles) * 100);
                return (
                  <div key={zona}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <MapPin size={11} className="text-vinotinto/50" />{zona}
                      </span>
                      <span className="text-xs font-extrabold text-vinotinto">{count} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-vinotinto rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ESTADO DEL INVENTARIO (dona) ─────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-0.5">Estado del Inventario</h2>
          <p className="text-xs text-gray-400 mb-4">{totalInmuebles} inmuebles en total</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={STATUS_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={76}
                  paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {STATUS_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {STATUS_DATA.map(e => (
                <div key={e.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <div>
                    <p className="text-xs text-gray-500 leading-none">{e.name}</p>
                    <p className="text-lg font-extrabold text-gray-800 leading-tight">{e.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CAPTACIONES DEL MES (barras) ─────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">Captaciones por Asesor</h2>
              <p className="text-xs text-gray-400">{mesCapitalizado}</p>
            </div>
            <select value={filtroAsesor} onChange={e => setFiltroAsesor(e.target.value)}
              className="text-xs font-bold bg-vinotinto/10 text-vinotinto border-none rounded-lg px-2 py-1.5 outline-none cursor-pointer">
              {asesoresNombres.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={175}>
            <BarChart data={dataFiltrada} barSize={28} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="asesor" tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #F3F4F6', fontSize: '12px', fontWeight: 'bold' }}
                cursor={{ fill: '#F9FAFB', radius: 8 }} />
              <Bar dataKey="captaciones" name="Captaciones" fill="#800020" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── RECOMENDACIONES DE MARKETING ─────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-vinotinto/10 p-2 rounded-xl">
              <Lightbulb size={16} className="text-vinotinto" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Recomendaciones de Marketing</h2>
              <p className="text-xs text-gray-400">Basadas en tu inventario actual</p>
            </div>
          </div>
          <div className="space-y-3">
            {recomendaciones.map((r, i) => (
              <div key={i} className={`flex gap-3 p-3.5 rounded-xl border ${colorMap[r.color]}`}>
                <span className={`shrink-0 mt-0.5 ${iconColorMap[r.color]}`}>{r.icon}</span>
                <div>
                  <p className="text-xs font-bold leading-tight mb-0.5">{r.titulo}</p>
                  <p className="text-[11px] leading-relaxed opacity-80">{r.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CITAS CONCRETADAS (grande) ───────────────────────────────────── */}
        <div className="bg-gradient-to-br from-vinotinto to-vinotinto-light p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute right-6 -bottom-3 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <CheckCircle size={32} className="text-dorado mb-4" />
          <p className="text-sm font-semibold opacity-75 mb-1">Citas Concretadas</p>
          <p className="text-7xl font-black tracking-tight leading-none">{citasConcretadas}</p>
          <p className="text-xs opacity-50 mt-3">Este mes · Todos los asesores</p>
        </div>

      </div>
    </div>
  );
}
