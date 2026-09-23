import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// API ROUTE — /api/search
// Parser semántico determinístico para búsqueda inmobiliaria.
// Sin dependencias de API externas — 0 costo, 0ms de latencia de red.
// =============================================================================

// ── Tipos ──────────────────────────────────────────────────────────────────
interface SearchFilters {
  precio_min: number | null;
  precio_max: number | null;
  beds_min: number | null;
  baths_min: number | null;
  sqm_min: number | null;
  sqm_max: number | null;
  property_type: string | null;
  keywords: string[];
  amenities: string[];
  status: string | null;
  interpretacion: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normaliza la query: minúsculas, quita tildes, colapsa espacios */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parsea expresiones de precio en USD: "80k", "80.000", "medio millon", "$150 mil" */
function parsePriceToken(token: string): number | null {
  const t = token.replace(/[$,.]/g, '').trim();

  if (/^(\d+)k$/i.test(t)) return parseInt(t) * 1000;
  if (/^\d+$/.test(t)) {
    const n = parseInt(t);
    // Heurística: si es menor a 10000 y viene precedido de contexto de precio → asumimos miles
    return n < 1000 ? n * 1000 : n;
  }
  return null;
}

// ── Parser principal ───────────────────────────────────────────────────────
function parseQuery(raw: string): SearchFilters {
  const q = normalize(raw);
  const filters: SearchFilters = {
    precio_min: null,
    precio_max: null,
    beds_min: null,
    baths_min: null,
    sqm_min: null,
    sqm_max: null,
    property_type: null,
    keywords: [],
    amenities: [],
    status: null,
    interpretacion: '',
  };

  const interp: string[] = [];

  // ── 1. PRECIO ─────────────────────────────────────────────────────────────

  // "menos de X" / "hasta X" / "máximo X" / "max X" / "no mas de X"
  const precioMaxMatch = q.match(
    /(?:menos de|hasta|maximo?|max|no mas de|por menos de)\s*\$?\s*(\d[\d.,]*k?)/i
  );
  if (precioMaxMatch) {
    filters.precio_max = parsePriceToken(precioMaxMatch[1]);
  }

  // "mas de X" / "desde X" / "minimo X" / "min X"
  const precioMinMatch = q.match(
    /(?:mas de|desde|minimo?|min|a partir de)\s*\$?\s*(\d[\d.,]*k?)/i
  );
  if (precioMinMatch) {
    filters.precio_min = parsePriceToken(precioMinMatch[1]);
  }

  // "entre X y Y"
  const precioEntreMatch = q.match(
    /entre\s*\$?\s*(\d[\d.,]*k?)\s*y\s*\$?\s*(\d[\d.,]*k?)/i
  );
  if (precioEntreMatch) {
    filters.precio_min = parsePriceToken(precioEntreMatch[1]);
    filters.precio_max = parsePriceToken(precioEntreMatch[2]);
  }

  // Número suelto con "$" o seguido de "k": "$80k", "$120.000", "80 mil"
  if (!filters.precio_max && !filters.precio_min) {
    const precioSueltoMatch = q.match(/\$\s*(\d[\d.,]*k?)/);
    if (precioSueltoMatch) {
      const v = parsePriceToken(precioSueltoMatch[1]);
      if (v) filters.precio_max = v;
    }
  }

  // "X mil" / "X millones"
  const milMatch = q.match(/(\d+(?:[.,]\d+)?)\s*mil(?:es)?(?:\s*de\s*dolares?)?/i);
  if (milMatch && !filters.precio_max && !filters.precio_min) {
    filters.precio_max = Math.round(parseFloat(milMatch[1].replace(',', '.')) * 1000);
  }
  const millonMatch = q.match(/(?:medio\s*)?mill[oó]n/i);
  if (millonMatch) {
    if (q.includes('medio millon')) filters.precio_max = 500000;
    else filters.precio_min = 1000000;
  }

  // Palabras clave de rango
  if (!filters.precio_max && !filters.precio_min) {
    if (/\b(?:barato|economico|modico|asequible|accesible)\b/.test(q)) {
      filters.precio_max = 50000;
      interp.push('Económico');
    } else if (/\b(?:precio medio|mediano|moderado)\b/.test(q)) {
      filters.precio_min = 50000;
      filters.precio_max = 120000;
      interp.push('Precio medio');
    } else if (/\b(?:lujoso|exclusivo|premium|alto standing|lujo)\b/.test(q)) {
      filters.precio_min = 120000;
      interp.push('Premium');
    }
  }

  if (filters.precio_max) interp.push(`Máx $${(filters.precio_max / 1000).toFixed(0)}k`);
  else if (filters.precio_min) interp.push(`Desde $${(filters.precio_min / 1000).toFixed(0)}k`);

  // ── 2. HABITACIONES ───────────────────────────────────────────────────────
  const bedsMatch = q.match(
    /(\d+)\s*(?:hab(?:itaciones?)?|cuartos?|dormitorios?|recamaras?|habs?|bedroom)/i
  );
  if (bedsMatch) {
    filters.beds_min = parseInt(bedsMatch[1]);
    interp.push(`${filters.beds_min}hab`);
  }

  // ── 3. BAÑOS ──────────────────────────────────────────────────────────────
  const bathsMatch = q.match(/(\d+)\s*(?:banos?|bathrooms?)/i);
  if (bathsMatch) {
    filters.baths_min = parseInt(bathsMatch[1]);
    interp.push(`${filters.baths_min}baños`);
  }

  // ── 4. METRAJE ────────────────────────────────────────────────────────────
  const sqmMinMatch = q.match(
    /(?:mas de|minimo?|desde)\s*(\d+)\s*(?:m2|metros?(?:\s*cuadrados?)?|mts?)/i
  );
  if (sqmMinMatch) filters.sqm_min = parseInt(sqmMinMatch[1]);

  const sqmMaxMatch = q.match(
    /(?:menos de|hasta|maximo?)\s*(\d+)\s*(?:m2|metros?(?:\s*cuadrados?)?|mts?)/i
  );
  if (sqmMaxMatch) filters.sqm_max = parseInt(sqmMaxMatch[1]);

  // Número suelto con m2
  if (!filters.sqm_min && !filters.sqm_max) {
    const sqmSuelto = q.match(/(\d+)\s*(?:m2|m²|metros?\s*cuadrados?)/i);
    if (sqmSuelto) filters.sqm_min = parseInt(sqmSuelto[1]);
  }

  if (/\b(?:grande|espacioso|amplio)\b/.test(q) && !filters.sqm_min) filters.sqm_min = 150;
  if (/\b(?:pequeno|compacto|chico)\b/.test(q) && !filters.sqm_max) filters.sqm_max = 80;

  // ── 5. TIPO DE PROPIEDAD ──────────────────────────────────────────────────
  const typeMap: [RegExp, string][] = [
    [/\b(?:apto|apartamento|piso|flat|depto)\b/, 'Apartamento'],
    [/\b(?:casa|quinta|villa|chalet|residencia)\b/, 'Casa / Quinta'],
    [/\b(?:townhouse|town\s*house|duplex|triplex)\b/, 'Townhouse'],
    [/\b(?:penthouse|ph|atico|pent\s*house)\b/, 'Penthouse'],
    [/\b(?:local|comercial|tienda|negocio|fondo\s*de\s*comercio)\b/, 'Local Comercial'],
    [/\b(?:oficina|despacho|consultorio)\b/, 'Oficina'],
    [/\b(?:terreno|lote|parcela|solar)\b/, 'Terreno'],
  ];
  for (const [pattern, type] of typeMap) {
    if (pattern.test(q)) {
      filters.property_type = type;
      interp.push(type);
      break;
    }
  }

  // ── 6. STATUS ─────────────────────────────────────────────────────────────
  if (/\b(?:vendid[ao]|vendidos?|ya\s*vendid[ao])\b/.test(q)) {
    filters.status = 'Vendida';
  } else if (/\b(?:suspendid[ao]|inactiv[ao]|retirad[ao])\b/.test(q)) {
    filters.status = 'Suspendida';
  } else if (/\b(?:activ[ao]|disponible|en\s*venta|a\s*la\s*venta)\b/.test(q)) {
    filters.status = 'Activa';
  }

  // ── 7. ZONAS DE MARGARITA ─────────────────────────────────────────────────
  const zonas: [RegExp, string][] = [
    [/\bpampatar\b/, 'Pampatar'],
    [/\bel\s*cardon\b/, 'El Cardón'],
    [/\bguarame\b/, 'Guarame'],
    [/\bporlamar\b/, 'Porlamar'],
    [/\blos\s*robles\b/, 'Los Robles'],
    [/\bcosta\s*azul\b/, 'Costa Azul'],
    [/\bel\s*valle\b/, 'El Valle'],
    [/\bjuan\s*griego\b/, 'Juan Griego'],
    [/\bel\s*maco\b/, 'El Maco'],
    [/\bsan\s*juan\b/, 'San Juan Bautista'],
    [/\bla\s*asuncion\b/, 'La Asunción'],
    [/\bsanta\s*ana\b/, 'Santa Ana'],
    [/\bel\s*cercado\b/, 'El Cercado'],
    [/\bel\s*agua\b/, 'El Agua'],
    [/\bplaya\s*el\s*agua\b/, 'Playa El Agua'],
    [/\bmanzanillo\b/, 'Manzanillo'],
    [/\bpedro\s*gonzalez\b/, 'Pedro González'],
    [/\bplaya\s*el\s*angel\b/, 'Playa El Ángel'],
    [/\bparguito\b/, 'Playa Parguito'],
    [/\bguacuco\b/, 'Playa Guacuco'],
    [/\bla\s*restinga\b/, 'La Restinga'],
    [/\bpunta\s*de\s*piedras\b/, 'Punta de Piedras'],
    [/\bvilla\s*rosa\b/, 'Villa Rosa'],
    [/\bcoche\b/, 'San Pedro de Coche'],
    [/\bmaneiro\b/, 'Pampatar'],
    [/\bmarino\b/, 'Porlamar'],
  ];

  const foundZones: string[] = [];
  for (const [pattern, zona] of zonas) {
    if (pattern.test(q)) foundZones.push(zona);
  }

  // Keywords de playa / mar
  if (/\b(?:playa|mar|frente\s*al\s*mar|vista\s*al\s*mar|cerca\s*del\s*mar)\b/.test(q)) {
    if (!foundZones.includes('mar')) filters.keywords.push('mar');
    if (!foundZones.includes('playa')) filters.keywords.push('playa');
  }

  filters.keywords = [...filters.keywords, ...foundZones].slice(0, 5);
  if (foundZones.length) interp.push(foundZones[0]);

  // ── 8. AMENITIES ──────────────────────────────────────────────────────────
  const amenityMap: [RegExp, string][] = [
    [/\bpiscina\b/, 'Piscina'],
    [/\b(?:planta\s*electrica|planta)\b/, 'Planta Eléctrica'],
    [/\b(?:pozo\s*de\s*agua|pozo)\b/, 'Pozo de Agua'],
    [/\b(?:vigilancia|seguridad\s*24|24\/7)\b/, 'Vigilancia 24/7'],
    [/\b(?:amoblado|amueblado|con\s*muebles)\b/, 'Amoblado'],
    [/\b(?:vista\s*al\s*mar|frente\s*al\s*mar|vista\s*mar)\b/, 'Vista al Mar'],
    [/\bgimnasio\b/, 'Gimnasio'],
    [/\b(?:ascensor|elevador)\b/, 'Ascensor'],
    [/\b(?:estacionamiento\s*techado|garaje\s*techado)\b/, 'Estacionamiento Techado'],
    [/\b(?:terraza\s*privada|terraza)\b/, 'Terraza Privada'],
    [/\bjacuzzi\b/, 'Jacuzzi'],
    [/\b(?:area\s*de\s*bbq|bbq|parrillera)\b/, 'Área de BBQ'],
    [/\bbano\s*de\s*visitas\b/, 'Baño de Visitas'],
  ];

  for (const [pattern, amenity] of amenityMap) {
    if (pattern.test(q) && filters.amenities.length < 4) {
      filters.amenities.push(amenity);
    }
  }

  // ── 9. INTERPRETACIÓN RESUMEN ─────────────────────────────────────────────
  if (interp.length === 0) {
    // Fallback: usar las primeras palabras significativas de la query
    interp.push(raw.trim().slice(0, 50));
  }
  filters.interpretacion = interp.join(' · ').slice(0, 60);

  return filters;
}

// ── Handler HTTP ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'Query demasiado corta' }, { status: 400 });
    }

    const filters = parseQuery(query);
    return NextResponse.json(filters);

  } catch (err) {
    console.error('[search] Error interno:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
