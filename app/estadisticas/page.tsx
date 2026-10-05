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
  BarChart2, Megaphone, Target, Star, Download,
  FileText, X, Check, Filter, Briefcase,
  Calendar, ChevronLeft, ChevronRight, RotateCcw,
  Eye, Clock, ArrowRight, ExternalLink,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Property } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { normalize } from '../lib/searchEngine';

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

function fitString(pdf: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '';
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 3 && pdf.getTextWidth(t + '...') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

export interface AvailableMonthOption {
  year: number;
  month: number;
  label: string;
  isCurrent: boolean;
}

function getAvailableMonths(properties: Property[], appointments: any[]): AvailableMonthOption[] {
  const dates: Date[] = [];
  const now = new Date();

  // Todos los meses del año actual
  for (let m = 0; m < 12; m++) {
    dates.push(new Date(now.getFullYear(), m, 1));
  }
  // Todos los meses del año anterior (para histórico como 2025)
  for (let m = 0; m < 12; m++) {
    dates.push(new Date(now.getFullYear() - 1, m, 1));
  }

  // Escanear fechas reales de propiedades
  properties.forEach(p => {
    const dStr = p.createdAt || p.created_at;
    if (dStr) {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) dates.push(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  });

  // Escanear fechas reales de citas
  appointments.forEach(a => {
    if (a.fecha) {
      const d = new Date(a.fecha);
      if (!isNaN(d.getTime())) dates.push(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  });

  const map = new Map<string, AvailableMonthOption>();

  dates.forEach(d => {
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    if (!map.has(key)) {
      const isCurrent = y === now.getFullYear() && m === now.getMonth();
      const monthName = d.toLocaleString('es-ES', { month: 'long' });
      const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const label = `${capMonth} ${y}${isCurrent ? ' (Actual)' : ''}`;
      map.set(key, { year: y, month: m, label, isCurrent });
    }
  });

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(e => e[1]);
}

interface GenerateKPIsPDFOptions {
  scope: 'global' | 'asesor';
  selectedAdvisorName?: string;
  includeAdvisorTable?: boolean;
  includePriceAnalysis?: boolean;
  includeRecommendations?: boolean;
  includeCaptacionesList?: boolean;
  properties: Property[];
  appointments: any[];
  allUsers: any[];
  mesCapitalizado: string;
  activos: number;
  vendidos: number;
  suspendidos: number;
  totalInmuebles: number;
  nuevasCaptaciones: number;
  citasConcretadas: number;
  precioPromedio: number;
  precioMin: number;
  precioMax: number;
  avgPpm2: number;
  sobrePrecio: any[];
  bajoPrecio: any[];
  TIPO_DATA: any[];
  ZONA_DATA: any[];
  recomendaciones: any[];
  isCurrentMonth: (dateStr?: string) => boolean;
}

function generateKPIsPDF({
  scope,
  selectedAdvisorName,
  includeAdvisorTable = true,
  includePriceAnalysis = true,
  includeRecommendations = true,
  includeCaptacionesList = true,
  properties,
  appointments,
  allUsers,
  mesCapitalizado,
  activos,
  vendidos,
  suspendidos,
  totalInmuebles,
  nuevasCaptaciones,
  citasConcretadas,
  precioPromedio,
  precioMin,
  precioMax,
  avgPpm2,
  sobrePrecio,
  bajoPrecio,
  TIPO_DATA,
  ZONA_DATA,
  recomendaciones,
  isCurrentMonth,
}: GenerateKPIsPDFOptions) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  const COLOR_PRIMARY: [number, number, number] = [128, 0, 32];      // Vinotinto RIV
  const COLOR_PRIMARY_BG: [number, number, number] = [245, 235, 238]; // Fondo vinotinto suave
  const COLOR_GOLD: [number, number, number] = [212, 175, 55];       // Dorado RIV
  const COLOR_DARK: [number, number, number] = [31, 41, 55];
  const COLOR_MUTED: [number, number, number] = [107, 114, 128];
  const COLOR_BG_CARD: [number, number, number] = [249, 250, 251];
  const COLOR_BORDER: [number, number, number] = [229, 231, 235];
  const COLOR_AMBER: [number, number, number] = [180, 83, 9];
  const COLOR_AMBER_BG: [number, number, number] = [254, 243, 199];
  const COLOR_GREEN: [number, number, number] = [22, 101, 52];
  const COLOR_GREEN_BG: [number, number, number] = [240, 253, 244];
  const COLOR_BLUE: [number, number, number] = [29, 78, 216];
  const COLOR_BLUE_BG: [number, number, number] = [239, 246, 255];

  let currentY = 14;

  const drawHeader = (isFirstPage: boolean, subtitle?: string): number => {
    pdf.setFillColor(...COLOR_PRIMARY);
    pdf.rect(marginX, 10, contentWidth, 2.5, 'F');

    pdf.setFillColor(...COLOR_GOLD);
    pdf.rect(marginX, 12.5, 32, 0.8, 'F');

    if (isFirstPage) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(...COLOR_PRIMARY);
      pdf.text('RED INMOBILIARIA DE VENEZUELA', marginX, 20);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text('SISTEMA INTEGRAL DE GESTIÓN · REPORTE EJECUTIVO DE KPIS Y MERCADO', marginX, 24.5);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR_DARK);
      pdf.text(`Período: ${mesCapitalizado}`, pageWidth - marginX, 19, { align: 'right' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_MUTED);
      const fechaStr = new Date().toLocaleDateString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      pdf.text(`Generado: ${fechaStr}`, pageWidth - marginX, 23.5, { align: 'right' });
      pdf.text('Nivel: Confidencial / Dirección', pageWidth - marginX, 27.5, { align: 'right' });

      pdf.setDrawColor(...COLOR_BORDER);
      pdf.setLineWidth(0.4);
      pdf.line(marginX, 30, pageWidth - marginX, 30);
      return 35;
    } else {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLOR_PRIMARY);
      pdf.text('RED INMOBILIARIA DE VENEZUELA  |  INFORME DE KPIS Y RENDIMIENTO', marginX, 17);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text(subtitle || `Período: ${mesCapitalizado}`, pageWidth - marginX, 17, { align: 'right' });

      pdf.setDrawColor(...COLOR_BORDER);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, 19.5, pageWidth - marginX, 19.5);
      return 24;
    }
  };

  const checkPageBreak = (neededHeight: number): void => {
    if (currentY + neededHeight > pageHeight - 16) {
      pdf.addPage();
      currentY = drawHeader(false);
    }
  };

  const drawSectionTitle = (title: string, subtitle?: string): void => {
    checkPageBreak(14);
    pdf.setFillColor(...COLOR_PRIMARY_BG);
    pdf.roundedRect(marginX, currentY, contentWidth, 7, 1.2, 1.2, 'F');

    pdf.setFillColor(...COLOR_PRIMARY);
    pdf.rect(marginX, currentY, 2.5, 7, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLOR_PRIMARY);
    pdf.text(title.toUpperCase(), marginX + 5, currentY + 4.8);

    if (subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text(subtitle, pageWidth - marginX - 3, currentY + 4.8, { align: 'right' });
    }

    currentY += 10;
  };

  // Desglose de asesores
  const advisorStats = allUsers.map(u => {
    const userProps = properties.filter(p => normalize(p.captador) === normalize(u.nombre));
    const userPropsMes = userProps.filter(p => isCurrentMonth(p.createdAt || p.created_at));
    const userVentas = properties.filter(p => p.status === 'Vendida' && normalize(p.captador) === normalize(u.nombre));
    const userCitas = appointments.filter(a => a.asesores && a.asesores.some((ase: string) => normalize(ase) === normalize(u.nombre)));
    const userCitasMes = userCitas.filter(a => isCurrentMonth(a.fecha));
    const userCitasConcretadas = userCitasMes.filter(a => a.estado === 'Completada');

    return {
      id: u.id,
      nombre: u.nombre,
      rol: u.rol,
      email: u.email,
      telefono: u.telefono,
      captacionesMes: userPropsMes.length,
      captacionesTotal: userProps.length,
      ventas: userVentas.length,
      citasTotal: userCitasMes.length,
      citasHistoricas: userCitas.length,
      citasConcretadas: userCitasConcretadas.length,
      inmuebles: userPropsMes.length > 0 ? userPropsMes : userProps,
    };
  });

  const totalCaptacionesMes = advisorStats.reduce((s, a) => s + a.captacionesMes, 0);
  const totalCarteraAsesores = advisorStats.reduce((s, a) => s + a.captacionesTotal, 0);
  const totalVentasAsesores = advisorStats.reduce((s, a) => s + a.ventas, 0);
  const totalCitasAsesores = advisorStats.reduce((s, a) => s + a.citasTotal, 0);

  const inmueblesMes = properties.filter(p => isCurrentMonth(p.createdAt || p.created_at));
  const poolInmueblesList = inmueblesMes.length > 0 ? inmueblesMes : properties;

  // =========================================================================
  // MODO 1: REPORTE GLOBAL DE LA AGENCIA
  // =========================================================================
  if (scope === 'global') {
    currentY = drawHeader(true);

    // Banner de Resumen Ejecutivo
    pdf.setFillColor(...COLOR_PRIMARY_BG);
    pdf.roundedRect(marginX, currentY, contentWidth, 13, 2, 2, 'F');
    pdf.setFillColor(...COLOR_PRIMARY);
    pdf.rect(marginX, currentY, 3, 13, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...COLOR_PRIMARY);
    pdf.text('RESUMEN EJECUTIVO Y RENDIMIENTO GENERAL DE LA AGENCIA', marginX + 6, currentY + 5.2);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLOR_DARK);
    pdf.text(
      `Informe consolidado correspondiente a ${mesCapitalizado}. Total de ${totalInmuebles} propiedades registradas en cartera y ${allUsers.length} asesores activos.`,
      marginX + 6,
      currentY + 9.5
    );

    currentY += 16;

    // Matriz de Indicadores Clave (Grid 3x2)
    drawSectionTitle('Métricas Clave del Mes', 'Indicadores de Cartera y Desempeño');

    const cardWidth = (contentWidth - 8) / 3;
    const cardHeight = 15;
    const cards = [
      { label: 'Captaciones del Mes', val: String(nuevasCaptaciones), sub: 'Nuevos ingresos en cartera', color: COLOR_PRIMARY },
      { label: 'Citas Concretadas', val: String(citasConcretadas), sub: 'Atendidas con éxito', color: COLOR_GREEN },
      { label: 'Asesores Activos', val: String(allUsers.length), sub: 'Equipo comercial', color: COLOR_BLUE },
      { label: 'Inventario Total', val: String(totalInmuebles), sub: `${activos} Act · ${vendidos} Ven · ${suspendidos} Susp`, color: COLOR_DARK },
      { label: 'Precio Promedio', val: `$${fmt(precioPromedio)}`, sub: `Mín: $${fmt(precioMin)} · Máx: $${fmt(precioMax)}`, color: COLOR_PRIMARY },
      { label: 'Valor Promedio m²', val: avgPpm2 > 0 ? `$${fmt(avgPpm2)}/m²` : 'N/D', sub: 'Inmuebles activos con metraje', color: COLOR_GOLD },
    ];

    cards.forEach((c, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cardX = marginX + col * (cardWidth + 4);
      const cardY = currentY + row * (cardHeight + 3);

      pdf.setFillColor(...COLOR_BG_CARD);
      pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'F');
      pdf.setDrawColor(...COLOR_BORDER);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'D');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(c.color[0], c.color[1], c.color[2]);
      pdf.text(c.val, cardX + 3.5, cardY + 5.5);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLOR_DARK);
      pdf.text(c.label.toUpperCase(), cardX + 3.5, cardY + 9.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text(fitString(pdf, c.sub, cardWidth - 7), cardX + 3.5, cardY + 13);
    });

    currentY += cardHeight * 2 + 7;

    // Resumen de Estatus y Zonas (2 columnas)
    checkPageBreak(30);
    const boxW = (contentWidth - 4) / 2;
    const boxH = 25;

    // Bloque Izquierdo: Estatus de la Cartera
    pdf.setFillColor(...COLOR_BG_CARD);
    pdf.roundedRect(marginX, currentY, boxW, boxH, 1.5, 1.5, 'F');
    pdf.setDrawColor(...COLOR_BORDER);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(marginX, currentY, boxW, boxH, 1.5, 1.5, 'D');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLOR_PRIMARY);
    pdf.text('ESTATUS DE LA CARTERA', marginX + 4, currentY + 5);

    const sinFoto = properties.filter(p => !p.image || p.images?.length === 0).length;
    const estatusLines = [
      { label: 'Inmuebles Activos:', val: `${activos} (${Math.round((activos / Math.max(1, totalInmuebles)) * 100)}%)`, color: COLOR_PRIMARY },
      { label: 'Inmuebles Vendidos:', val: `${vendidos} (${Math.round((vendidos / Math.max(1, totalInmuebles)) * 100)}%)`, color: COLOR_GOLD },
      { label: 'Inmuebles Suspendidos:', val: `${suspendidos} (${Math.round((suspendidos / Math.max(1, totalInmuebles)) * 100)}%)`, color: COLOR_MUTED },
      { label: 'Inmuebles sin Fotografías:', val: `${sinFoto} propiedades`, color: COLOR_AMBER },
    ];

    estatusLines.forEach((item, i) => {
      const lineY = currentY + 9 + i * 3.8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLOR_DARK);
      pdf.text(item.label, marginX + 4, lineY);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(item.color[0], item.color[1], item.color[2]);
      pdf.text(item.val, marginX + boxW - 4, lineY, { align: 'right' });
    });

    // Bloque Derecho: Top Ubicaciones / Zonas
    const boxRightX = marginX + boxW + 4;
    pdf.setFillColor(...COLOR_BG_CARD);
    pdf.roundedRect(boxRightX, currentY, boxW, boxH, 1.5, 1.5, 'F');
    pdf.setDrawColor(...COLOR_BORDER);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(boxRightX, currentY, boxW, boxH, 1.5, 1.5, 'D');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLOR_PRIMARY);
    pdf.text('PRINCIPALES MUNICIPIOS / ZONAS', boxRightX + 4, currentY + 5);

    const topZonas = ZONA_DATA.slice(0, 4);
    if (topZonas.length === 0) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text('Sin registros de zonas para este período', boxRightX + 4, currentY + 13);
    } else {
      topZonas.forEach((item, i) => {
        const lineY = currentY + 9 + i * 3.8;
        const pct = Math.round((item.count / Math.max(1, totalInmuebles)) * 100);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_DARK);
        pdf.text(fitString(pdf, item.zona, boxW - 35), boxRightX + 4, lineY);

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLOR_PRIMARY);
        pdf.text(`${item.count} (${pct}%)`, boxRightX + boxW - 4, lineY, { align: 'right' });
      });
    }

    currentY += boxH + 6;

    // Tabla de Desempeño por Asesor
    if (includeAdvisorTable && advisorStats.length > 0) {
      drawSectionTitle('Desempeño del Equipo de Asesores', 'Captaciones, ventas y gestión de citas');

      checkPageBreak(12);
      pdf.setFillColor(...COLOR_PRIMARY);
      pdf.rect(marginX, currentY, contentWidth, 6, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text('ASESOR / CAPTADOR', marginX + 3, currentY + 4.2);
      pdf.text('ROL', marginX + 70, currentY + 4.2);
      pdf.text('CAPT. MES', marginX + 112, currentY + 4.2, { align: 'right' });
      pdf.text('CARTERA', marginX + 137, currentY + 4.2, { align: 'right' });
      pdf.text('VENTAS', marginX + 159, currentY + 4.2, { align: 'right' });
      pdf.text('CITAS TOTALES', marginX + 180, currentY + 4.2, { align: 'right' });

      currentY += 6;

      advisorStats.forEach((a, i) => {
        checkPageBreak(6);
        if (i % 2 === 1) {
          pdf.setFillColor(...COLOR_BG_CARD);
          pdf.rect(marginX, currentY, contentWidth, 5.8, 'F');
        }
        pdf.setDrawColor(...COLOR_BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(marginX, currentY + 5.8, marginX + contentWidth, currentY + 5.8);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLOR_DARK);
        pdf.text(fitString(pdf, a.nombre, 65), marginX + 3, currentY + 4);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(...COLOR_MUTED);
        pdf.text(a.rol, marginX + 70, currentY + 4);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLOR_PRIMARY);
        pdf.text(String(a.captacionesMes), marginX + 112, currentY + 4, { align: 'right' });

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...COLOR_DARK);
        pdf.text(String(a.captacionesTotal), marginX + 137, currentY + 4, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLOR_GREEN);
        pdf.text(String(a.ventas), marginX + 159, currentY + 4, { align: 'right' });

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...COLOR_BLUE);
        pdf.text(String(a.citasTotal), marginX + 180, currentY + 4, { align: 'right' });

        currentY += 5.8;
      });

      // Fila de Totales Consolidados
      checkPageBreak(7);
      pdf.setFillColor(...COLOR_PRIMARY_BG);
      pdf.rect(marginX, currentY, contentWidth, 6.5, 'F');
      pdf.setDrawColor(...COLOR_PRIMARY);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, currentY + 6.5, marginX + contentWidth, currentY + 6.5);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_PRIMARY);
      pdf.text('TOTALES CONSOLIDADOS', marginX + 3, currentY + 4.5);
      pdf.text(String(totalCaptacionesMes), marginX + 112, currentY + 4.5, { align: 'right' });
      pdf.text(String(totalCarteraAsesores), marginX + 137, currentY + 4.5, { align: 'right' });
      pdf.text(String(totalVentasAsesores), marginX + 159, currentY + 4.5, { align: 'right' });
      pdf.text(String(totalCitasAsesores), marginX + 180, currentY + 4.5, { align: 'right' });

      currentY += 10;
    }

    // Detalle de Captaciones del Período
    if (includeCaptacionesList) {
      drawSectionTitle(`Captaciones Nuevas (${poolInmueblesList.length})`, `Propiedades registradas en ${mesCapitalizado}`);

      if (poolInmueblesList.length === 0) {
        checkPageBreak(12);
        pdf.setFillColor(...COLOR_BG_CARD);
        pdf.roundedRect(marginX, currentY, contentWidth, 9, 1.5, 1.5, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLOR_MUTED);
        pdf.text(`No se registraron captaciones de inmuebles durante ${mesCapitalizado}.`, marginX + 4, currentY + 6);
        currentY += 13;
      } else {
        checkPageBreak(12);
        pdf.setFillColor(...COLOR_PRIMARY);
        pdf.rect(marginX, currentY, contentWidth, 6, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text('INMUEBLE / CÓDIGO', marginX + 3, currentY + 4.2);
        pdf.text('CAPTADOR', marginX + 70, currentY + 4.2);
        pdf.text('TIPO Y ZONA', marginX + 110, currentY + 4.2);
        pdf.text('PRECIO (USD)', marginX + 158, currentY + 4.2, { align: 'right' });
        pdf.text('FECHA', marginX + 180, currentY + 4.2, { align: 'right' });

        currentY += 6;

        poolInmueblesList.forEach((p, i) => {
          checkPageBreak(6);
          if (i % 2 === 1) {
            pdf.setFillColor(...COLOR_BG_CARD);
            pdf.rect(marginX, currentY, contentWidth, 5.8, 'F');
          }
          pdf.setDrawColor(...COLOR_BORDER);
          pdf.setLineWidth(0.2);
          pdf.line(marginX, currentY + 5.8, marginX + contentWidth, currentY + 5.8);

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(...COLOR_DARK);
          const titleStr = p.title;
          pdf.text(fitString(pdf, titleStr, 65), marginX + 3, currentY + 4);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(fitString(pdf, p.captador || 'Sin captador', 38), marginX + 70, currentY + 4);

          const tipoZona = `${p.propertyType || 'Inmueble'} · ${getMunicipio(p.location || '')}`;
          pdf.text(fitString(pdf, tipoZona, 46), marginX + 110, currentY + 4);

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_PRIMARY);
          pdf.text(`$${fmt(p.price)}`, marginX + 158, currentY + 4, { align: 'right' });

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(...COLOR_MUTED);
          const dateStr = p.createdAt || p.created_at;
          const dFmt = dateStr ? new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) : '-';
          pdf.text(dFmt, marginX + 180, currentY + 4, { align: 'right' });

          currentY += 5.8;
        });

        currentY += 4;
      }
    }

    // Análisis de Precios de Mercado
    if (includePriceAnalysis) {
      drawSectionTitle('Análisis de Precios de Mercado', 'Comparativa frente al promedio por m²');

      // 1. Inmuebles Sobre Precio
      if (sobrePrecio.length > 0) {
        checkPageBreak(15);
        pdf.setFillColor(...COLOR_AMBER_BG);
        pdf.rect(marginX, currentY, contentWidth, 5.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_AMBER);
        pdf.text('PROPIEDADES SOBRE PRECIO (+20% vs Promedio del Mercado Local)', marginX + 3, currentY + 3.8);
        currentY += 5.5;

        pdf.setFillColor(243, 244, 246);
        pdf.rect(marginX, currentY, contentWidth, 5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(...COLOR_DARK);
        pdf.text('INMUEBLE', marginX + 3, currentY + 3.5);
        pdf.text('CAPTADOR', marginX + 70, currentY + 3.5);
        pdf.text('PRECIO USD', marginX + 120, currentY + 3.5, { align: 'right' });
        pdf.text('METRAJE', marginX + 142, currentY + 3.5, { align: 'right' });
        pdf.text('USD / M²', marginX + 162, currentY + 3.5, { align: 'right' });
        pdf.text('DESVIACIÓN', marginX + 180, currentY + 3.5, { align: 'right' });
        currentY += 5;

        sobrePrecio.slice(0, 8).forEach((p, i) => {
          checkPageBreak(5.5);
          if (i % 2 === 1) {
            pdf.setFillColor(...COLOR_BG_CARD);
            pdf.rect(marginX, currentY, contentWidth, 5.2, 'F');
          }
          pdf.setDrawColor(...COLOR_BORDER);
          pdf.setLineWidth(0.2);
          pdf.line(marginX, currentY + 5.2, marginX + contentWidth, currentY + 5.2);

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(...COLOR_DARK);
          pdf.text(fitString(pdf, p.title, 65), marginX + 3, currentY + 3.6);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(fitString(pdf, p.captador || '-', 35), marginX + 70, currentY + 3.6);

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_DARK);
          pdf.text(`$${fmt(p.price)}`, marginX + 120, currentY + 3.6, { align: 'right' });

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(`${p.sqm} m²`, marginX + 142, currentY + 3.6, { align: 'right' });

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_AMBER);
          pdf.text(`$${fmt(p.ppm2)}`, marginX + 162, currentY + 3.6, { align: 'right' });

          const diffPct = avgPpm2 > 0 ? `+${Math.round((p.ppm2 / avgPpm2 - 1) * 100)}%` : '-';
          pdf.text(diffPct, marginX + 180, currentY + 3.6, { align: 'right' });

          currentY += 5.2;
        });

        currentY += 4;
      }

      // 2. Inmuebles Oportunidades / Bajo Precio
      if (bajoPrecio.length > 0) {
        checkPageBreak(15);
        pdf.setFillColor(...COLOR_GREEN_BG);
        pdf.rect(marginX, currentY, contentWidth, 5.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_GREEN);
        pdf.text('OPORTUNIDADES DE PRECIO (-20% vs Promedio del Mercado Local)', marginX + 3, currentY + 3.8);
        currentY += 5.5;

        pdf.setFillColor(243, 244, 246);
        pdf.rect(marginX, currentY, contentWidth, 5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(...COLOR_DARK);
        pdf.text('INMUEBLE', marginX + 3, currentY + 3.5);
        pdf.text('CAPTADOR', marginX + 70, currentY + 3.5);
        pdf.text('PRECIO USD', marginX + 120, currentY + 3.5, { align: 'right' });
        pdf.text('METRAJE', marginX + 142, currentY + 3.5, { align: 'right' });
        pdf.text('USD / M²', marginX + 162, currentY + 3.5, { align: 'right' });
        pdf.text('DESCUENTO', marginX + 180, currentY + 3.5, { align: 'right' });
        currentY += 5;

        bajoPrecio.slice(0, 8).forEach((p, i) => {
          checkPageBreak(5.5);
          if (i % 2 === 1) {
            pdf.setFillColor(...COLOR_BG_CARD);
            pdf.rect(marginX, currentY, contentWidth, 5.2, 'F');
          }
          pdf.setDrawColor(...COLOR_BORDER);
          pdf.setLineWidth(0.2);
          pdf.line(marginX, currentY + 5.2, marginX + contentWidth, currentY + 5.2);

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(...COLOR_DARK);
          pdf.text(fitString(pdf, p.title, 65), marginX + 3, currentY + 3.6);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(fitString(pdf, p.captador || '-', 35), marginX + 70, currentY + 3.6);

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_DARK);
          pdf.text(`$${fmt(p.price)}`, marginX + 120, currentY + 3.6, { align: 'right' });

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(`${p.sqm} m²`, marginX + 142, currentY + 3.6, { align: 'right' });

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_GREEN);
          pdf.text(`$${fmt(p.ppm2)}`, marginX + 162, currentY + 3.6, { align: 'right' });

          const diffPct = avgPpm2 > 0 ? `-${Math.round((1 - p.ppm2 / avgPpm2) * 100)}%` : '-';
          pdf.text(diffPct, marginX + 180, currentY + 3.6, { align: 'right' });

          currentY += 5.2;
        });

        currentY += 4;
      }

      // 3. Precios por Tipo de Inmueble
      if (TIPO_DATA.length > 0) {
        checkPageBreak(12);
        pdf.setFillColor(...COLOR_PRIMARY_BG);
        pdf.rect(marginX, currentY, contentWidth, 5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_PRIMARY);
        pdf.text('PRECIO PROMEDIO SEGÚN TIPO DE PROPIEDAD', marginX + 3, currentY + 3.5);
        currentY += 5;

        TIPO_DATA.forEach((t, i) => {
          checkPageBreak(5);
          if (i % 2 === 1) {
            pdf.setFillColor(...COLOR_BG_CARD);
            pdf.rect(marginX, currentY, contentWidth, 4.8, 'F');
          }
          pdf.setDrawColor(...COLOR_BORDER);
          pdf.setLineWidth(0.2);
          pdf.line(marginX, currentY + 4.8, marginX + contentWidth, currentY + 4.8);

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(...COLOR_DARK);
          pdf.text(t.tipo, marginX + 3, currentY + 3.4);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(`${t.count} propiedades`, marginX + 70, currentY + 3.4);

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_PRIMARY);
          pdf.text(`$${fmt(t.promedio)} USD`, marginX + 150, currentY + 3.4, { align: 'right' });

          const pctTotal = Math.round((t.count / Math.max(1, totalInmuebles)) * 100);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...COLOR_MUTED);
          pdf.text(`${pctTotal}% de cartera`, marginX + 180, currentY + 3.4, { align: 'right' });

          currentY += 4.8;
        });

        currentY += 4;
      }
    }

    // Recomendaciones Estratégicas
    if (includeRecommendations && recomendaciones.length > 0) {
      drawSectionTitle('Recomendaciones Estratégicas y Marketing', 'Acciones sugeridas por el sistema');

      recomendaciones.forEach(rec => {
        const textLines = pdf.splitTextToSize(rec.texto, contentWidth - 12);
        const boxHeight = 7 + textLines.length * 3.4;
        checkPageBreak(boxHeight + 2);

        let accentColor = COLOR_PRIMARY;
        let bgBoxColor = COLOR_BG_CARD;
        if (rec.color === 'amber') { accentColor = COLOR_AMBER; bgBoxColor = COLOR_AMBER_BG; }
        else if (rec.color === 'green') { accentColor = COLOR_GREEN; bgBoxColor = COLOR_GREEN_BG; }
        else if (rec.color === 'blue') { accentColor = COLOR_BLUE; bgBoxColor = COLOR_BLUE_BG; }
        else if (rec.color === 'red') { accentColor = COLOR_PRIMARY; bgBoxColor = COLOR_PRIMARY_BG; }

        pdf.setFillColor(...bgBoxColor);
        pdf.roundedRect(marginX, currentY, contentWidth, boxHeight, 1.2, 1.2, 'F');

        pdf.setFillColor(...accentColor);
        pdf.rect(marginX, currentY, 2.5, boxHeight, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...accentColor);
        pdf.text(rec.titulo, marginX + 5, currentY + 4.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_DARK);
        textLines.forEach((tl: string, idx: number) => {
          pdf.text(tl, marginX + 5, currentY + 8 + idx * 3.4);
        });

        currentY += boxHeight + 2.5;
      });
    }

  // =========================================================================
  // MODO 2: REPORTE INDIVIDUAL DE ASESOR
  // =========================================================================
  } else {
    const targetAdvisor = advisorStats.find(a => normalize(a.nombre) === normalize(selectedAdvisorName || '')) || advisorStats[0];
    if (!targetAdvisor) return;

    currentY = drawHeader(true, `Expediente de Asesor: ${targetAdvisor.nombre}`);

    // Ficha del Asesor
    pdf.setFillColor(...COLOR_PRIMARY_BG);
    pdf.roundedRect(marginX, currentY, contentWidth, 22, 2, 2, 'F');
    pdf.setFillColor(...COLOR_PRIMARY);
    pdf.rect(marginX, currentY, 3.5, 22, 'F');

    // Datos del Asesor (Izquierda)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...COLOR_PRIMARY);
    pdf.text(targetAdvisor.nombre.toUpperCase(), marginX + 7, currentY + 6);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLOR_GOLD);
    pdf.text(`ROL: ${targetAdvisor.rol}`, marginX + 7, currentY + 11);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLOR_DARK);
    pdf.text(`Email: ${targetAdvisor.email || 'Sin correo'}`, marginX + 7, currentY + 15.5);
    pdf.text(`Teléfono: ${targetAdvisor.telefono || 'Sin teléfono registrado'}`, marginX + 7, currentY + 19.5);

    // Métricas del Asesor (Derecha)
    const statsX = marginX + 105;
    const miniStats = [
      { l: 'Captaciones Mes:', v: String(targetAdvisor.captacionesMes), c: COLOR_PRIMARY },
      { l: 'Cartera Total:', v: `${targetAdvisor.captacionesTotal} inmueble(s)`, c: COLOR_DARK },
      { l: 'Ventas Concretadas:', v: String(targetAdvisor.ventas), c: COLOR_GREEN },
      { l: 'Citas Atendidas:', v: `${targetAdvisor.citasTotal} (${targetAdvisor.citasConcretadas} cerradas)`, c: COLOR_BLUE },
    ];

    miniStats.forEach((ms, i) => {
      const lineY = currentY + 5.5 + i * 4.2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text(ms.l, statsX, lineY);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(ms.c[0], ms.c[1], ms.c[2]);
      pdf.text(ms.v, marginX + contentWidth - 4, lineY, { align: 'right' });
    });

    currentY += 26;

    // Cartera Completa de Inmuebles del Asesor
    drawSectionTitle(`Cartera de Inmuebles Captados (${targetAdvisor.inmuebles.length})`, 'Propiedades bajo la gestión de este asesor');

    if (targetAdvisor.inmuebles.length === 0) {
      checkPageBreak(12);
      pdf.setFillColor(...COLOR_BG_CARD);
      pdf.roundedRect(marginX, currentY, contentWidth, 9, 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text('Este asesor aún no tiene inmuebles asignados o captados en su cartera.', marginX + 4, currentY + 6);
      currentY += 13;
    } else {
      checkPageBreak(12);
      pdf.setFillColor(...COLOR_PRIMARY);
      pdf.rect(marginX, currentY, contentWidth, 6, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text('INMUEBLE / CÓDIGO', marginX + 3, currentY + 4.2);
      pdf.text('TIPO Y ZONA', marginX + 72, currentY + 4.2);
      pdf.text('PRECIO (USD)', marginX + 130, currentY + 4.2, { align: 'right' });
      pdf.text('ESTATUS', marginX + 155, currentY + 4.2, { align: 'center' });
      pdf.text('FECHA', marginX + 180, currentY + 4.2, { align: 'right' });

      currentY += 6;

      let sumaValorCartera = 0;

      targetAdvisor.inmuebles.forEach((p, i) => {
        checkPageBreak(6);
        sumaValorCartera += p.price || 0;

        if (i % 2 === 1) {
          pdf.setFillColor(...COLOR_BG_CARD);
          pdf.rect(marginX, currentY, contentWidth, 5.8, 'F');
        }
        pdf.setDrawColor(...COLOR_BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(marginX, currentY + 5.8, marginX + contentWidth, currentY + 5.8);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLOR_DARK);
        const titleStr = p.title;
        pdf.text(fitString(pdf, titleStr, 67), marginX + 3, currentY + 4);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_MUTED);
        const tipoZona = `${p.propertyType || 'Inmueble'} · ${getMunicipio(p.location || '')}`;
        pdf.text(fitString(pdf, tipoZona, 55), marginX + 72, currentY + 4);

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLOR_PRIMARY);
        pdf.text(`$${fmt(p.price)}`, marginX + 130, currentY + 4, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        if (p.status === 'Vendida') pdf.setTextColor(...COLOR_GOLD);
        else if (p.status === 'Suspendida') pdf.setTextColor(...COLOR_MUTED);
        else pdf.setTextColor(...COLOR_PRIMARY);
        pdf.text(p.status || 'Activa', marginX + 155, currentY + 4, { align: 'center' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(...COLOR_MUTED);
        const dateStr = p.createdAt || p.created_at;
        const dFmt = dateStr ? new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
        pdf.text(dFmt, marginX + 180, currentY + 4, { align: 'right' });

        currentY += 5.8;
      });

      // Totales del Asesor
      checkPageBreak(7);
      pdf.setFillColor(...COLOR_PRIMARY_BG);
      pdf.rect(marginX, currentY, contentWidth, 6.5, 'F');
      pdf.setDrawColor(...COLOR_PRIMARY);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, currentY + 6.5, marginX + contentWidth, currentY + 6.5);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_PRIMARY);
      pdf.text('VALOR ESTIMADO TOTAL DE LA CARTERA DEL ASESOR', marginX + 3, currentY + 4.5);
      pdf.text(`$${fmt(sumaValorCartera)} USD`, marginX + 130, currentY + 4.5, { align: 'right' });

      currentY += 10;
    }

    // Citas e Interacciones del Asesor
    const citasDelAsesor = appointments.filter(a => a.asesores && a.asesores.some((ase: string) => normalize(ase) === normalize(targetAdvisor.nombre)));
    drawSectionTitle(`Historial de Citas e Interacciones (${citasDelAsesor.length})`, 'Agenda y seguimiento comercial');

    if (citasDelAsesor.length === 0) {
      checkPageBreak(12);
      pdf.setFillColor(...COLOR_BG_CARD);
      pdf.roundedRect(marginX, currentY, contentWidth, 9, 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLOR_MUTED);
      pdf.text('No se registran citas asignadas a este asesor en el sistema.', marginX + 4, currentY + 6);
      currentY += 13;
    } else {
      checkPageBreak(12);
      pdf.setFillColor(...COLOR_PRIMARY);
      pdf.rect(marginX, currentY, contentWidth, 6, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text('CLIENTE / ASUNTO', marginX + 3, currentY + 4.2);
      pdf.text('TIPO DE GESTIÓN', marginX + 75, currentY + 4.2);
      pdf.text('FECHA Y HORA', marginX + 130, currentY + 4.2);
      pdf.text('ESTADO', marginX + 180, currentY + 4.2, { align: 'right' });

      currentY += 6;

      citasDelAsesor.slice(0, 15).forEach((c, i) => {
        checkPageBreak(6);
        if (i % 2 === 1) {
          pdf.setFillColor(...COLOR_BG_CARD);
          pdf.rect(marginX, currentY, contentWidth, 5.8, 'F');
        }
        pdf.setDrawColor(...COLOR_BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(marginX, currentY + 5.8, marginX + contentWidth, currentY + 5.8);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLOR_DARK);
        const desc = c.cliente ? `${c.cliente} · ${c.titulo}` : c.titulo;
        pdf.text(fitString(pdf, desc, 70), marginX + 3, currentY + 4);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...COLOR_MUTED);
        pdf.text(c.tipo || 'Cita', marginX + 75, currentY + 4);

        const fechaHora = `${c.fecha || ''} ${c.hora || ''}`.trim() || '-';
        pdf.text(fechaHora, marginX + 130, currentY + 4);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        if (c.estado === 'Completada') pdf.setTextColor(...COLOR_GREEN);
        else if (c.estado === 'Cancelada') pdf.setTextColor(...COLOR_MUTED);
        else pdf.setTextColor(...COLOR_AMBER);
        pdf.text(c.estado || 'Pendiente', marginX + 180, currentY + 4, { align: 'right' });

        currentY += 5.8;
      });

      currentY += 4;
    }
  }

  // Paginación en todas las páginas
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...COLOR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(156, 163, 175);
    pdf.text('Red Inmobiliaria de Venezuela · Documento de Control Interno y Gestión Estratégica', marginX, pageHeight - 7.5);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 7.5, { align: 'right' });
  }

  const cleanName = scope === 'asesor' && selectedAdvisorName
    ? `KPIs_Asesor_${selectedAdvisorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    : `KPIs_Reporte_Ejecutivo_${new Date().toISOString().split('T')[0]}.pdf`;

  pdf.save(cleanName);
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
  const { showToast } = useToast();
  const router = useRouter();
  const [filtroAsesor, setFiltroAsesor] = useState('Todos');
  const [isExporting, setIsExporting] = useState(false);

  // Estados para el Modal de Exportación de KPIs
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'global' | 'asesor'>('global');
  const [exportSelectedAdvisor, setExportSelectedAdvisor] = useState<string>('');
  const [includeAdvisorTable, setIncludeAdvisorTable] = useState(true);
  const [includePriceAnalysis, setIncludePriceAnalysis] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeCaptacionesList, setIncludeCaptacionesList] = useState(true);

  // Estados para Selección Dinámica de Período (Mes y Año)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  // Alcance de las métricas: 'mes' (estricto para el período) o 'acumulado' (cartera total histórica)
  const [modoAlcance, setModoAlcance] = useState<'mes' | 'acumulado'>('mes');

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

  // Control estricto de fecha para el período seleccionado
  const isSelectedPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.slice(0, 10).split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === selectedYear && m === selectedMonth;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  };

  const isCurrentMonthSelected = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  const mesCapitalizado = (() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    const m = d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    return m.charAt(0).toUpperCase() + m.slice(1);
  })();

  const availableMonths = getAvailableMonths(properties, appointments);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    const n = new Date();
    setSelectedMonth(n.getMonth());
    setSelectedYear(n.getFullYear());
  };

  // Inmuebles y citas del período seleccionado
  const propiedadesPeriodo = properties.filter(p => isSelectedPeriod(p.createdAt || p.created_at));
  const citasPeriodo = appointments.filter(a => isSelectedPeriod(a.fecha));

  // Conjunto de datos base según el alcance elegido ('mes' muestra la actividad específica de ese mes)
  const propiedadesBase = modoAlcance === 'mes' ? propiedadesPeriodo : properties;
  const citasBase = modoAlcance === 'mes' ? citasPeriodo : appointments;

  // 1. Estado del inventario según el alcance
  const activos     = propiedadesBase.filter(p => p.status === 'Activa').length;
  const vendidos    = propiedadesBase.filter(p => p.status === 'Vendida').length;
  const suspendidos = propiedadesBase.filter(p => p.status === 'Suspendida').length;
  const totalInmuebles = propiedadesBase.length;

  const STATUS_DATA = [
    { name: 'Activos',     value: activos,      color: '#800020' },
    { name: 'Vendidos',    value: vendidos,     color: '#D4AF37' },
    { name: 'Suspendidos', value: suspendidos,  color: '#9CA3AF' },
  ];

  // 2. Captaciones y citas para el período seleccionado
  const allUsers = getAllUsers();

  const CAPTACIONES_MES = allUsers.map(u => ({
    asesorFull: u.nombre,
    asesor: u.nombre.split(' ')[0] + ' ' + (u.nombre.split(' ')[1]?.[0] + '.' || ''),
    captaciones: propiedadesPeriodo.filter(p => normalize(p.captador) === normalize(u.nombre)).length,
    citas: citasPeriodo.filter(a => a.asesores && a.asesores.some(ase => normalize(ase) === normalize(u.nombre))).length,
    totalCartera: properties.filter(p => normalize(p.captador) === normalize(u.nombre)).length,
  }));

  const nuevasCaptaciones = propiedadesPeriodo.length;

  const citasConcretadas = citasPeriodo.filter(a => a.estado === 'Completada').length;

  const asesoresNombres = ['Todos', ...CAPTACIONES_MES.map(c => c.asesor)];
  const dataFiltrada = filtroAsesor === 'Todos'
    ? CAPTACIONES_MES
    : CAPTACIONES_MES.filter(c => c.asesor === filtroAsesor);

  // Cálculos Rendimiento Individual (Solo si filtroAsesor != 'Todos')
  const asesorSeleccionado = allUsers.find(u => {
    const alias = u.nombre.split(' ')[0] + ' ' + (u.nombre.split(' ')[1]?.[0] + '.' || '');
    return alias === filtroAsesor;
  });
  
  const citasAsesor = asesorSeleccionado 
    ? citasPeriodo.filter(a => a.asesores.some(ase => normalize(ase) === normalize(asesorSeleccionado.nombre))).length 
    : 0;
  
  const ventasAsesor = asesorSeleccionado
    ? propiedadesBase.filter(p => p.status === 'Vendida' && normalize(p.captador) === normalize(asesorSeleccionado.nombre)).length
    : 0;

  const captacionesAsesor = asesorSeleccionado
    ? propiedadesPeriodo.filter(p => normalize(p.captador) === normalize(asesorSeleccionado.nombre)).length
    : 0;

  const totalCarteraAsesor = asesorSeleccionado
    ? properties.filter(p => normalize(p.captador) === normalize(asesorSeleccionado.nombre)).length
    : 0;

  // 3. Inmuebles por municipio / zona
  const zonaCount: Record<string, number> = {};
  propiedadesBase.forEach(p => {
    const z = getMunicipio(p.location);
    zonaCount[z] = (zonaCount[z] ?? 0) + 1;
  });
  const ZONA_DATA = Object.entries(zonaCount)
    .sort((a, b) => b[1] - a[1])
    .map(([zona, count]) => ({ zona, count }));

  // 4. Precio promedio, mín, máx
  const activos_props = propiedadesBase.filter(p => p.status === 'Activa');
  const poolPrecios = activos_props.length > 0 ? activos_props : propiedadesBase;
  const precioPromedio = poolPrecios.length
    ? Math.round(poolPrecios.reduce((s, p) => s + p.price, 0) / poolPrecios.length)
    : 0;
  const precioMin = poolPrecios.length ? Math.min(...poolPrecios.map(p => p.price)) : 0;
  const precioMax = poolPrecios.length ? Math.max(...poolPrecios.map(p => p.price)) : 0;

  // Precio promedio por m²
  const conSqm = poolPrecios.filter(p => p.sqm > 0);
  const avgPpm2 = conSqm.length
    ? Math.round(conSqm.reduce((s, p) => s + ppm2(p), 0) / conSqm.length)
    : 0;

  // 5. Análisis de precio por inmueble
  const priceAnalysis = poolPrecios.map(p => ({
    ...p,
    clasif: clasificarPrecio(p, avgPpm2),
    ppm2: ppm2(p),
  }));

  const sobrePrecio = priceAnalysis.filter(p => p.clasif === 'sobre');
  const bajoPrecio  = priceAnalysis.filter(p => p.clasif === 'bajo');
  const precioJusto = priceAnalysis.filter(p => p.clasif === 'justo');

  // 6. Precio promedio por tipo
  const tipoStats: Record<string, { total: number; count: number; totalSqm: number; sqmCount: number }> = {};
  propiedadesBase.forEach(p => {
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

  if (propiedadesBase.length === 0) {
    recomendaciones.push({
      icon: <Calendar size={16} />,
      titulo: `Sin captaciones registradas en ${mesCapitalizado}`,
      texto: `En este período no se registraron nuevas propiedades en cartera. Revisa la gestión de citas y el seguimiento comercial para incentivar nuevas captaciones.`,
      color: 'amber',
    });
  } else {
    if (sobrePrecio.length > 0) {
      recomendaciones.push({
        icon: <AlertTriangle size={16} />,
        titulo: `${sobrePrecio.length} propiedad(es) sobre precio en este lote`,
        texto: `${sobrePrecio.map(p => p.title).join(', ')} están por encima del promedio/m² local. Considera ajustar el precio o resaltar características exclusivas.`,
        color: 'amber',
      });
    }

    if (bajoPrecio.length > 0) {
      recomendaciones.push({
        icon: <TrendingDown size={16} />,
        titulo: `${bajoPrecio.length} propiedad(es) oportunidad de precio`,
        texto: `${bajoPrecio.map(p => p.title).join(', ')} están por debajo del promedio/m². Son ideales para promover como oportunidad de inversión.`,
        color: 'green',
      });
    }

    if (ZONA_DATA.length > 0 && ZONA_DATA[0].count >= 2) {
      recomendaciones.push({
        icon: <MapPin size={16} />,
        titulo: `Concentración en ${ZONA_DATA[0].zona}`,
        texto: `Se registraron ${ZONA_DATA[0].count} inmuebles en ${ZONA_DATA[0].zona} para este período. Fomenta contenido de esa zona para posicionarte como especialista.`,
        color: 'blue',
      });
    }

    const sinFoto = propiedadesBase.filter(p => !p.image || p.images?.length === 0).length;
    if (sinFoto > 0) {
      recomendaciones.push({
        icon: <Megaphone size={16} />,
        titulo: `${sinFoto} inmueble(s) sin fotografías`,
        texto: 'Los inmuebles sin fotos reciben hasta 90% menos consultas. Programa su sesión fotográfica a la brevedad.',
        color: 'red',
      });
    }

    if (suspendidos > 0) {
      recomendaciones.push({
        icon: <Target size={16} />,
        titulo: `${suspendidos} inmueble(s) suspendido(s)`,
        texto: 'Revisa las razones de suspensión para reactivar estas propiedades antes del cierre del período.',
        color: 'gray',
      });
    }
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push({
      icon: <Star size={16} />,
      titulo: 'Actividad comercial equilibrada',
      texto: `Las operaciones registradas en ${mesCapitalizado} mantienen precios competitivos y documentación completa.`,
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

  const handleRunExport = async () => {
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 80));
      generateKPIsPDF({
        scope: exportScope,
        selectedAdvisorName: exportSelectedAdvisor || (allUsers[0]?.nombre ?? ''),
        includeAdvisorTable,
        includePriceAnalysis,
        includeRecommendations,
        includeCaptacionesList,
        properties: propiedadesBase,
        appointments: citasBase,
        allUsers,
        mesCapitalizado: `${mesCapitalizado}${modoAlcance === 'acumulado' ? ' (Cartera Acumulada)' : ''}`,
        activos,
        vendidos,
        suspendidos,
        totalInmuebles,
        nuevasCaptaciones,
        citasConcretadas,
        precioPromedio,
        precioMin,
        precioMax,
        avgPpm2,
        sobrePrecio,
        bajoPrecio,
        TIPO_DATA,
        ZONA_DATA,
        recomendaciones,
        isCurrentMonth: isSelectedPeriod,
      });
      setIsExportModalOpen(false);
      showToast('Reporte de estadísticas PDF generado.');
    } catch (err) {
      console.error('Error al generar PDF de KPIs:', err);
      showToast('Ocurrió un error al generar el PDF. Por favor intenta de nuevo.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="bg-gray-50 min-h-[100dvh] page-content">

      {/* HEADER */}
      <header className="bg-white px-5 pt-6 pb-4 sticky top-0 z-10 shadow-sm space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-vinotinto/10 p-1.5 rounded-lg">
                <TrendingUp size={16} className="text-vinotinto" />
              </div>
              <p className="text-[10px] font-bold text-vinotinto uppercase tracking-widest">Solo Admin</p>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">Estadísticas</h1>
          </div>
          <button
            onClick={() => {
              setExportScope('global');
              setIsExportModalOpen(true);
            }}
            disabled={isExporting}
            className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-vinotinto to-vinotinto-light text-white px-3.5 py-2.5 rounded-xl shadow-md shadow-vinotinto/20 transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
          >
            <Download size={14} />
            {isExporting ? 'Generando...' : 'Exportar Informe'}
          </button>
        </div>

        {/* BARRA SELECTORA DE PERÍODO / MES */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200/80">
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Mes anterior"
              className="p-1.5 hover:bg-white text-gray-600 hover:text-vinotinto rounded-xl transition border border-transparent hover:border-gray-200 shadow-xs active:scale-90 shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-1 min-w-0">
              <Calendar size={15} className="text-vinotinto shrink-0" />
              <select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={e => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
                className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer py-1 max-w-[135px] xs:max-w-[170px] sm:max-w-none truncate"
              >
                {availableMonths.map(opt => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Mes siguiente"
              className="p-1.5 hover:bg-white text-gray-600 hover:text-vinotinto rounded-xl transition border border-transparent hover:border-gray-200 shadow-xs active:scale-90 shrink-0"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="shrink-0">
            {!isCurrentMonthSelected ? (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="flex items-center gap-1 text-[11px] font-bold text-vinotinto bg-vinotinto/10 hover:bg-vinotinto/20 px-2.5 py-1 rounded-xl transition active:scale-95 whitespace-nowrap"
              >
                <RotateCcw size={12} />
                Mes Actual
              </button>
            ) : (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Mes en Curso
              </span>
            )}
          </div>
        </div>

        {/* SELECTOR DE ENFOQUE: ACTIVIDAD DEL PERÍODO vs CARTERA ACUMULADA */}
        <div className="grid grid-cols-2 p-1 bg-gray-100/90 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setModoAlcance('mes')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              modoAlcance === 'mes'
                ? 'bg-white text-vinotinto shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Calendar size={13} />
            <span className="truncate">Actividad de {mesCapitalizado}</span>
          </button>
          <button
            type="button"
            onClick={() => setModoAlcance('acumulado')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              modoAlcance === 'acumulado'
                ? 'bg-white text-vinotinto shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Briefcase size={13} />
            <span className="truncate">Cartera Acumulada</span>
          </button>
        </div>
      </header>

      <div className="p-4 space-y-5 pb-28">

        {/* BANNER INFORMATIVO SEGÚN EL MODO DE ALCANCE Y PERÍODO */}
        {modoAlcance === 'mes' ? (
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar size={18} className="text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold truncate">Actividad Exclusiva: {mesCapitalizado}</p>
                <p className="text-[11px] text-amber-700">
                  {propiedadesPeriodo.length} captación(es) y {citasPeriodo.length} cita(s) registradas específicamente en este período.
                </p>
              </div>
            </div>
            {!isCurrentMonthSelected && (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="shrink-0 flex items-center gap-1 text-[11px] font-bold bg-white text-vinotinto border border-amber-300/80 px-2.5 py-1 rounded-xl shadow-xs hover:bg-amber-100/50 transition active:scale-95"
              >
                <RotateCcw size={12} />
                Mes Actual
              </button>
            )}
          </div>
        ) : (
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-blue-900 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Briefcase size={18} className="text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold truncate">Cartera Global Acumulada</p>
                <p className="text-[11px] text-blue-700">
                  Visualizando los {properties.length} inmuebles totales registrados en el sistema histórico.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModoAlcance('mes')}
              className="shrink-0 flex items-center gap-1 text-[11px] font-bold bg-white text-blue-800 border border-blue-300/80 px-2.5 py-1 rounded-xl shadow-xs hover:bg-blue-100/50 transition active:scale-95"
            >
              Solo {mesCapitalizado}
            </button>
          </div>
        )}

        {/* ── KPI MINI CARDS ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <CheckCircle size={20} className="text-vinotinto" />, value: citasConcretadas,  label: `Citas Concretadas\n${modoAlcance === 'mes' ? mesCapitalizado : 'Total'}` },
            { icon: <Home        size={20} className="text-dorado-dark" />,value: nuevasCaptaciones, label: `Captaciones\n${modoAlcance === 'mes' ? mesCapitalizado : 'Período'}` },
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
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-base font-bold text-gray-800">💰 Precio del Mercado</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
              {modoAlcance === 'mes' ? mesCapitalizado : 'Cartera Total'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {poolPrecios.length > 0 
              ? `${poolPrecios.length} inmueble(s) analizado(s)` 
              : 'Sin inmuebles registrados en este período'}
          </p>

          {poolPrecios.length > 0 ? (
            <>
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
            </>
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium">No hay registros de precios para {mesCapitalizado}.</p>
              {modoAlcance === 'mes' && (
                <button
                  type="button"
                  onClick={() => setModoAlcance('acumulado')}
                  className="mt-2 text-xs font-bold text-vinotinto hover:underline"
                >
                  Ver Cartera Acumulada
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── ANÁLISIS DE PRECIO POR INMUEBLE ─────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-base font-bold text-gray-800">📊 Análisis de Precio</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
              {modoAlcance === 'mes' ? mesCapitalizado : 'Cartera Total'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Comparado con el precio promedio/m² {modoAlcance === 'mes' ? `de ${mesCapitalizado}` : 'del mercado local'}
          </p>

          {poolPrecios.length > 0 ? (
            <>
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

              {/* Lista de sobre precio */}
              {sobrePrecio.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle size={10} /> Sobre precio
                  </p>
                  <div className="space-y-2">
                    {sobrePrecio.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-amber-50 rounded-xl px-3 py-2">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-gray-800 leading-tight truncate">{p.title}</p>
                          <p className="text-[10px] text-gray-500">${fmt(p.price)} · {p.sqm}m²</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-amber-600">${fmt(p.ppm2)}/m²</p>
                          <p className="text-[9px] text-amber-400">+{Math.round((p.ppm2/avgPpm2-1)*100)}% vs promedio</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de bajo precio */}
              {bajoPrecio.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <TrendingDown size={10} /> Oportunidades (bajo precio)
                  </p>
                  <div className="space-y-2">
                    {bajoPrecio.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-blue-50 rounded-xl px-3 py-2">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-gray-800 leading-tight truncate">{p.title}</p>
                          <p className="text-[10px] text-gray-500">${fmt(p.price)} · {p.sqm}m²</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-blue-600">${fmt(p.ppm2)}/m²</p>
                          <p className="text-[9px] text-blue-400">{Math.round((1-p.ppm2/avgPpm2)*100)}% bajo promedio</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium">Sin datos de inmuebles para analizar precios en {mesCapitalizado}.</p>
            </div>
          )}
        </div>

        {/* ── PRECIO PROMEDIO POR TIPO ─────────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-base font-bold text-gray-800">🏷️ Precio por Tipo de Propiedad</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
              {modoAlcance === 'mes' ? mesCapitalizado : 'Cartera Total'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Precio promedio en USD</p>
          {TIPO_DATA.length > 0 ? (
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
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium">No se registraron propiedades en {mesCapitalizado}.</p>
            </div>
          )}
        </div>

        {/* ── INMUEBLES POR ZONA ───────────────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-base font-bold text-gray-800">📍 Inmuebles por Zona</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
              {modoAlcance === 'mes' ? mesCapitalizado : 'Cartera Total'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">{ZONA_DATA.length} zona(s) registradas</p>
          {ZONA_DATA.length > 0 ? (
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
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium">No se registraron propiedades por zona en {mesCapitalizado}.</p>
            </div>
          )}
        </div>

        {/* ── ESTADO DEL INVENTARIO (dona) ─────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-base font-bold text-gray-800">Estado del Inventario</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
              {modoAlcance === 'mes' ? mesCapitalizado : 'Cartera Total'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">{totalInmuebles} inmueble(s) en este alcance</p>
          {totalInmuebles > 0 ? (
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
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium">Sin inmuebles registrados en {mesCapitalizado}.</p>
            </div>
          )}
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

          {filtroAsesor !== 'Todos' && asesorSeleccionado && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-gray-800">Rendimiento Individual: {asesorSeleccionado.nombre}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setExportScope('asesor');
                    setExportSelectedAdvisor(asesorSeleccionado.nombre);
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-vinotinto bg-vinotinto/10 px-3 py-1.5 rounded-xl hover:bg-vinotinto/20 transition active:scale-95"
                >
                  <Download size={13} />
                  Exportar Asesor PDF
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-vinotinto/5 rounded-xl p-3 text-center border border-vinotinto/10">
                  <p className="text-2xl font-extrabold text-vinotinto">{captacionesAsesor}</p>
                  <p className="text-[9px] font-bold text-vinotinto mt-1 uppercase">Capt. Período</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-2xl font-extrabold text-gray-800">{totalCarteraAsesor}</p>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase">Cartera Total</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                  <p className="text-2xl font-extrabold text-green-600">{ventasAsesor}</p>
                  <p className="text-[9px] font-bold text-green-700 mt-1 uppercase">Ventas</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-2xl font-extrabold text-blue-600">{citasAsesor}</p>
                  <p className="text-[9px] font-bold text-blue-700 mt-1 uppercase">Citas Período</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── LISTADO DE INMUEBLES DEL PERÍODO ─────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Home size={18} className="text-vinotinto" />
                Inmuebles Captados en {mesCapitalizado}
              </h2>
              <p className="text-xs text-gray-400">
                {propiedadesPeriodo.length === 1 
                  ? '1 inmueble registrado en este mes' 
                  : `${propiedadesPeriodo.length} inmuebles registrados en este mes`}
              </p>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-vinotinto/10 text-vinotinto">
              {propiedadesPeriodo.length}
            </span>
          </div>

          {propiedadesPeriodo.length > 0 ? (
            <div className="space-y-3">
              {propiedadesPeriodo.map(p => {
                const imgUrl = p.image || (p.images && p.images[0]) || '';
                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/inventario/${p.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-vinotinto/30 bg-gray-50/50 hover:bg-white transition shadow-xs cursor-pointer group"
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.title}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                        <Home size={22} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          p.status === 'Activa'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'Vendida'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {p.status || 'Activa'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold truncate">
                          {p.propertyType || 'Inmueble'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 group-hover:text-vinotinto truncate transition">
                        {p.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-vinotinto/60 shrink-0" />
                        {p.location}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="font-extrabold text-vinotinto">
                          ${fmt(p.price)} USD
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Captador: <strong className="text-gray-600">{p.captador || 'Sin captador'}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center text-gray-300 group-hover:text-vinotinto transition shrink-0 pl-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 bg-gray-50/70 rounded-xl border border-dashed border-gray-200">
              <Home size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600">No hay captaciones registradas en {mesCapitalizado}</p>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto mt-1">
                Durante este período no se agregaron nuevos inmuebles a la cartera.
              </p>
              {modoAlcance === 'mes' && (
                <button
                  type="button"
                  onClick={() => setModoAlcance('acumulado')}
                  className="mt-3 text-xs font-bold text-vinotinto bg-vinotinto/10 hover:bg-vinotinto/20 px-3 py-1.5 rounded-xl transition"
                >
                  Ver Cartera Acumulada
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── LISTADO DE CITAS Y VISITAS DEL PERÍODO ───────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Calendar size={18} className="text-vinotinto" />
                Citas y Visitas de {mesCapitalizado}
              </h2>
              <p className="text-xs text-gray-400">
                {citasPeriodo.length === 1 
                  ? '1 cita agendada en este mes' 
                  : `${citasPeriodo.length} citas agendadas en este mes`}
              </p>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-vinotinto/10 text-vinotinto">
              {citasPeriodo.length}
            </span>
          </div>

          {citasPeriodo.length > 0 ? (
            <div className="space-y-2.5">
              {citasPeriodo.map(c => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        c.estado === 'Completada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.estado === 'Cancelada'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {c.estado || 'Pendiente'}
                      </span>
                      <span className="text-xs font-bold text-gray-800 truncate">
                        {c.titulo || 'Cita Comercial'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 truncate">
                      Cliente: <strong className="text-gray-900">{c.cliente || 'Sin cliente asignado'}</strong>
                      {c.tipo && <span className="text-gray-400"> · {c.tipo}</span>}
                    </p>
                    {c.asesores && c.asesores.length > 0 && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">
                        Asesor(es): {c.asesores.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 shrink-0 text-right">
                    <span className="text-xs font-bold text-vinotinto flex items-center gap-1">
                      <Clock size={12} />
                      {c.fecha} {c.hora ? `· ${c.hora}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 bg-gray-50/70 rounded-xl border border-dashed border-gray-200">
              <Calendar size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600">No hay citas registradas en {mesCapitalizado}</p>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto mt-1">
                No hubo reuniones o visitas registradas en la agenda para este mes.
              </p>
            </div>
          )}
        </div>

        {/* ── RECOMENDACIONES DE MARKETING ─────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-vinotinto/10 p-2 rounded-xl">
              <Lightbulb size={16} className="text-vinotinto" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Recomendaciones de Marketing</h2>
              <p className="text-xs text-gray-400">Basadas en la actividad de {mesCapitalizado}</p>
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
          <p className="text-xs opacity-50 mt-3">{mesCapitalizado} · Todos los asesores</p>
        </div>

      </div>

      {/* MODAL DE EXPORTACIÓN DE KPIS */}
      <AnimatePresence>
      {isExportModalOpen && (
        <div className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="modal-container bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-vinotinto/10 text-vinotinto rounded-2xl">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 leading-tight">Exportar Informe de Rendimiento</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Expediente oficial en PDF · {mesCapitalizado}</p>
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
              {/* Selector de Alcance: Global vs Asesor */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Tipo de Informe
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setExportScope('global')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      exportScope === 'global'
                        ? 'bg-white text-vinotinto shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    🏢 Agencia Global
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportScope('asesor');
                      if (!exportSelectedAdvisor && allUsers.length > 0) {
                        setExportSelectedAdvisor(asesorSeleccionado?.nombre || allUsers[0]?.nombre || '');
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      exportScope === 'asesor'
                        ? 'bg-white text-vinotinto shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    👤 Por Asesor
                  </button>
                </div>
              </div>

              {/* MODO GLOBAL: Opciones de Secciones */}
              {exportScope === 'global' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-vinotinto/5 border border-vinotinto/10 rounded-2xl">
                    <p className="text-xs font-bold text-vinotinto mb-1">Informe Completo de la Red</p>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Genera un informe ejecutivo consolidado con las métricas de cartera, captaciones del mes, actividad de los asesores y análisis de mercado.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Secciones a Incluir
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition border border-gray-100">
                        <input
                          type="checkbox"
                          checked={includeAdvisorTable}
                          onChange={e => setIncludeAdvisorTable(e.target.checked)}
                          className="rounded text-vinotinto focus:ring-vinotinto w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800">Tabla de Desempeño por Asesor</p>
                          <p className="text-[10px] text-gray-400">Captaciones del mes, cartera total, ventas y citas atendidas</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition border border-gray-100">
                        <input
                          type="checkbox"
                          checked={includeCaptacionesList}
                          onChange={e => setIncludeCaptacionesList(e.target.checked)}
                          className="rounded text-vinotinto focus:ring-vinotinto w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800">Detalle de Captaciones del Mes ({nuevasCaptaciones})</p>
                          <p className="text-[10px] text-gray-400">Listado de inmuebles ingresados este mes con captador y precio</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition border border-gray-100">
                        <input
                          type="checkbox"
                          checked={includePriceAnalysis}
                          onChange={e => setIncludePriceAnalysis(e.target.checked)}
                          className="rounded text-vinotinto focus:ring-vinotinto w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800">Análisis de Precios de Mercado</p>
                          <p className="text-[10px] text-gray-400">Inmuebles sobre precio, oportunidades y promedios por tipo</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition border border-gray-100">
                        <input
                          type="checkbox"
                          checked={includeRecommendations}
                          onChange={e => setIncludeRecommendations(e.target.checked)}
                          className="rounded text-vinotinto focus:ring-vinotinto w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800">Recomendaciones Estratégicas y Marketing</p>
                          <p className="text-[10px] text-gray-400">Diagnóstico comercial y sugerencias operativas del sistema</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* MODO ASESOR: Selección de Asesor y Vista Previa */}
              {exportScope === 'asesor' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Selecciona el Asesor
                    </label>
                    <select
                      value={exportSelectedAdvisor || allUsers[0]?.nombre || ''}
                      onChange={e => setExportSelectedAdvisor(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-vinotinto/40 focus:border-vinotinto cursor-pointer"
                    >
                      {allUsers.map(u => (
                        <option key={u.id} value={u.nombre}>
                          {u.nombre} ({u.rol})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vista Previa del Asesor Seleccionado */}
                  {(() => {
                    const targetName = exportSelectedAdvisor || allUsers[0]?.nombre || '';
                    const targetUser = allUsers.find(u => normalize(u.nombre) === normalize(targetName)) || allUsers[0];
                    if (!targetUser) return null;

                    const propsAsesor = properties.filter(p => normalize(p.captador) === normalize(targetUser.nombre));
                    const propsMes = propsAsesor.filter(p => isSelectedPeriod(p.createdAt || p.created_at));
                    const ventas = properties.filter(p => p.status === 'Vendida' && normalize(p.captador) === normalize(targetUser.nombre));
                    const citas = appointments.filter(a => a.asesores && a.asesores.some((ase: string) => normalize(ase) === normalize(targetUser.nombre)));

                    return (
                      <div className="p-4 bg-vinotinto/5 border border-vinotinto/10 rounded-2xl space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{targetUser.nombre}</p>
                            <p className="text-[10px] text-gray-500">{targetUser.email || 'Sin correo'}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vinotinto/10 text-vinotinto">
                            {targetUser.rol}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-vinotinto/10">
                          <div className="bg-white/80 p-2 rounded-xl">
                            <p className="text-base font-extrabold text-vinotinto">{propsMes.length}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Capt. Mes</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl">
                            <p className="text-base font-extrabold text-gray-800">{propsAsesor.length}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Cartera</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl">
                            <p className="text-base font-extrabold text-green-600">{ventas.length}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Ventas</p>
                          </div>
                          <div className="bg-white/80 p-2 rounded-xl">
                            <p className="text-base font-extrabold text-blue-600">{citas.length}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Citas</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 text-center italic pt-1">
                          El reporte incluirá la ficha técnica, inventario completo captado y citas de este asesor.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  disabled={isExporting}
                  className="w-full sm:w-1/2 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRunExport}
                  disabled={isExporting}
                  className="w-full sm:w-1/2 py-3 bg-gradient-to-r from-vinotinto to-vinotinto-light text-white rounded-xl font-bold shadow-lg shadow-vinotinto/20 transition-all text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 disabled:opacity-50 text-center"
                >
                  <Download size={15} />
                  {isExporting ? 'Generando PDF...' : 'Descargar PDF'}
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


