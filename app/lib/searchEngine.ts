import type { Property } from '../context/DataContext';

// =============================================================================
// MOTOR DE BÚSQUEDA LOCAL — RIV MARGARITA PREMIER
// Funciona 100% en el cliente, sin API, sin latencia.
// Se usa como resultado inmediato mientras la IA procesa,
// y como fallback si la API de Gemini no está disponible.
// =============================================================================

// ─── Normalización de texto ──────────────────────────────────────────────────
/** Quita tildes, convierte a minúsculas y elimina espacios extremos */
export function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ─── Diccionario de sinónimos inmobiliarios ───────────────────────────────────
const SYNONYM_GROUPS: string[][] = [
  // Tipos de propiedad
  ['apartamento', 'apto', 'apt', 'piso', 'flat', 'depto', 'dpto', 'departamento'],
  ['habitacion', 'habitaciones', 'hab', 'habs', 'cuarto', 'cuartos', 'dormitorio', 'dormitorios', 'recamara', 'recamaras', 'alcoba', 'alcobas'],
  ['bano', 'banos', 'aseo', 'lavabo', 'lavabos'],
  ['estacionamiento', 'parking', 'garaje', 'cochera', 'parqueadero', 'garage'],
  ['piscina', 'pool', 'alberca'],
  ['villa', 'quinta', 'casa', 'chalet', 'mansion'],
  ['townhouse', 'town house', 'duplex'],
  ['local', 'comercial', 'tienda', 'negocio', 'local comercial'],
  ['penthouse', 'atico', 'azotea', 'terraza', 'ph'],
  ['oficina', 'despacho', 'consultorio'],
  ['terreno', 'lote', 'parcela', 'solar', 'tierra'],
  ['amoblado', 'amueblado', 'equipado', 'mobilado', 'furnished'],
  ['vigilancia', 'seguridad', 'guardia', 'conserje'],
  ['planta', 'electricidad', 'generador', 'planta electrica'],
  ['pozo', 'cisterna', 'tanque'],
  ['jacuzzi', 'jacuzi', 'bano turco', 'spa'],
  // Zonas de Margarita — sinónimos y abreviaturas comunes
  ['pampatar', 'pampa'],
  ['porlamar', 'porla'],
  ['juan griego', 'juangriego'],
  ['el agua', 'playa el agua', 'agua'],
  ['costa azul', 'costazul'],
  ['la asuncion', 'asuncion', 'capital'],
  ['punta de piedras', 'punta piedras', 'pp'],
  ['playa angel', 'playa el angel', 'el angel'],
  ['playa parguito', 'parguito'],
  ['playa guacuco', 'guacuco'],
  ['playa caribe', 'caribe'],
  ['los robles', 'robles'],
  ['manzanillo', 'manzanilo'],
  ['san juan bautista', 'san juan'],
  ['la restinga', 'restinga'],
  // Mar/playa/costa
  ['mar', 'playa', 'costa', 'litoral', 'oceano', 'frente al mar', 'vista al mar', 'cerca del mar'],
];

/** Dado un token, devuelve todos los sinónimos del mismo grupo */
function getSynonyms(token: string): string[] {
  const group = SYNONYM_GROUPS.find(g => g.includes(token));
  return group ?? [token];
}

/** Expande todos los tokens de la query a sus grupos de sinónimos */
function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  tokens.forEach(t => getSynonyms(t).forEach(s => expanded.add(s)));
  return expanded;
}

// ─── Parser de rango de precios ───────────────────────────────────────────────
interface PriceRange { min?: number; max?: number; }

/** Convierte strings como "80k", "80000", "80.000" a número */
function parseAmount(s: string): number {
  const clean = s.replace(/\./g, '').replace(/,/g, '');
  const m = clean.match(/(\d+(?:\.\d+)?)(k?)/i);
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2]?.toLowerCase() === 'k' ? 1000 : 1);
}

export function parsePriceRange(query: string): PriceRange {
  const q = normalize(query);
  const result: PriceRange = {};

  // "entre X y Y"
  const rangeMatch = q.match(/entre\s*([\d.,]+k?)\s*(?:y|a)\s*([\d.,]+k?)/);
  if (rangeMatch) {
    result.min = parseAmount(rangeMatch[1]);
    result.max = parseAmount(rangeMatch[2]);
    return result;
  }

  // Precio máximo: "menos de X", "max X", "hasta X", "no más de X", "por debajo de X"
  const maxMatch = q.match(/(?:menos de|max(?:imo)?|hasta|no m[aá]s de|por debajo de|no pasar de)\s*([\d.,]+k?)/);
  if (maxMatch) result.max = parseAmount(maxMatch[1]);

  // Precio mínimo: "más de X", "desde X", "mínimo X", "a partir de X"
  const minMatch = q.match(/(?:m[aá]s de|desde|m[ií]n(?:imo)?|a partir de|sobre|arriba de)\s*([\d.,]+k?)/);
  if (minMatch) result.min = parseAmount(minMatch[1]);

  // Precio barato/económico → max $50k
  if (/\b(?:barato|economico|economica|accesible|bajo precio|asequible|modico|modica|economica)\b/.test(q)) {
    result.max = result.max ?? 50000;
  }

  // Precio lujoso → min $120k
  if (/\b(?:lujo|lujoso|lujosa|exclusivo|exclusiva|premium|alto standing|de lujo|high end)\b/.test(q)) {
    result.min = result.min ?? 120000;
  }

  // Precio medio → entre 50k y 120k
  if (/\b(?:medio|mediano|rango medio|precio medio)\b/.test(q)) {
    result.min = result.min ?? 50000;
    result.max = result.max ?? 120000;
  }

  return result;
}

// ─── Parser de habitaciones ───────────────────────────────────────────────────
export function parseBeds(query: string): number | null {
  const q = normalize(query);
  const m = q.match(/(\d+)\s*(?:hab(?:itacion(?:es)?)?|cuarto(?:s)?|dormitorio(?:s)?|recamara(?:s)?|alcoba(?:s)?)/);
  return m ? parseInt(m[1]) : null;
}

// ─── Parser de metraje ────────────────────────────────────────────────────────
interface SqmRange { min?: number; max?: number; }

/** Convierte la query en rango de metros cuadrados */
export function parseSqmRange(query: string): SqmRange {
  const q = normalize(query);
  const result: SqmRange = {};

  // "entre X y Y m²"
  const rangeMatch = q.match(/entre\s*(\d+)\s*(?:y|a)\s*(\d+)\s*(?:m2|m²|metros?|mts?)/);
  if (rangeMatch) {
    result.min = parseInt(rangeMatch[1]);
    result.max = parseInt(rangeMatch[2]);
    return result;
  }

  // "más de X m²" / "mínimo X metros"
  const minMatch = q.match(/(?:m[aá]s de|desde|m[ií]n(?:imo)?|al menos|mayor(?:es)? a)\s*(\d+)\s*(?:m2|m²|metros?|mts?)/);
  if (minMatch) result.min = parseInt(minMatch[1]);

  // "menos de X m²" / "máximo X metros"
  const maxMatch = q.match(/(?:menos de|hasta|m[aá]x(?:imo)?|no m[aá]s de)\s*(\d+)\s*(?:m2|m²|metros?|mts?)/);
  if (maxMatch) result.max = parseInt(maxMatch[1]);

  return result;
}

// ─── Parser de tipo de propiedad ─────────────────────────────────────────────
export function parsePropertyType(query: string): string | null {
  const q = normalize(query);
  if (/\b(?:apartamento|apto|apt|piso|flat|depto)\b/.test(q))        return 'Apartamento';
  if (/\b(?:penthouse|ph|atico)\b/.test(q))                           return 'Penthouse';
  if (/\b(?:townhouse|town house|duplex)\b/.test(q))                  return 'Townhouse';
  if (/\b(?:casa|quinta|villa|chalet|mansion)\b/.test(q))             return 'Casa / Quinta';
  if (/\b(?:local comercial|local|tienda|negocio)\b/.test(q))         return 'Local Comercial';
  if (/\b(?:oficina|despacho|consultorio)\b/.test(q))                 return 'Oficina';
  if (/\b(?:terreno|lote|parcela|solar)\b/.test(q))                   return 'Terreno';
  return null;
}

// ─── Puntuación de relevancia ─────────────────────────────────────────────────
interface ScoredProperty { property: Property; score: number; }

function scoreProperty(
  property: Property,
  tokens: string[],
  priceRange: PriceRange,
  sqmRange: SqmRange,
  bedsMin: number | null,
  propertyType: string | null,
): ScoredProperty {
  // Filtros duros (exclusión total)
  if (priceRange.min != null && property.price < priceRange.min) return { property, score: -1 };
  if (priceRange.max != null && property.price > priceRange.max) return { property, score: -1 };
  if (bedsMin != null && property.beds < bedsMin)                return { property, score: -1 };
  if (sqmRange.min != null && property.sqm < sqmRange.min)       return { property, score: -1 };
  if (sqmRange.max != null && property.sqm > sqmRange.max)       return { property, score: -1 };

  // Tipo de propiedad — filtro duro si se especificó uno
  if (propertyType && property.propertyType && property.propertyType !== propertyType) {
    return { property, score: -1 };
  }

  const fields: Array<{ text: string; weight: number }> = [
    { text: normalize(property.title),                                  weight: 5 },
    { text: normalize(property.location),                               weight: 4 },
    { text: normalize((property.amenities ?? []).join(' ')),            weight: 3 },
    { text: normalize(property.description),                            weight: 1 },
    { text: normalize(property.captador),                               weight: 2 },
    { text: normalize(String(property.price)),                          weight: 1 },
    { text: normalize(String(property.beds) + ' habitaciones'),         weight: 2 },
    { text: normalize(String(property.sqm) + ' metros'),                weight: 2 },
    { text: normalize(property.propertyType ?? ''),                     weight: 4 },
  ];

  let score = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    for (const field of fields) {
      if (field.text.includes(token)) {
        score += field.weight;
      }
    }
  }

  return { property, score };
}

// ─── Función principal de búsqueda fuzzy ──────────────────────────────────────
/**
 * Búsqueda local instantánea con:
 * - Sinónimos inmobiliarios y de zonas de Margarita
 * - Parser de rangos de precio ("menos de 80k", "entre 50 y 100")
 * - Parser de metraje ("más de 100m²", "menos de 80 metros")
 * - Parser de habitaciones ("3 habs", "4 cuartos")
 * - Parser de tipo de propiedad ("penthouse", "local comercial")
 * - Scoring de relevancia (los más relevantes primero)
 * - Insensible a tildes y mayúsculas
 */
export function fuzzySearch(properties: Property[], query: string): Property[] {
  const trimmed = query.trim();
  if (!trimmed) return properties;

  const normalized = normalize(trimmed);
  const rawTokens = normalized.split(/[\s,]+/).filter(t => t.length > 1);

  if (!rawTokens.length) return properties;

  const tokenArray = Array.from(expandTokens(rawTokens));
  const priceRange = parsePriceRange(normalized);
  const sqmRange = parseSqmRange(normalized);
  const bedsMin = parseBeds(normalized);
  const propertyType = parsePropertyType(normalized);

  const scored = properties
    .map(p => scoreProperty(p, tokenArray, priceRange, sqmRange, bedsMin, propertyType))
    .filter(r => r.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.map(r => r.property);
}

// ─── Aplicar filtros estructurados de IA ────────────────────────────────────
export interface AIFilters {
  precio_min?:     number | null;
  precio_max?:     number | null;
  beds_min?:       number | null;
  baths_min?:      number | null;
  sqm_min?:        number | null;
  sqm_max?:        number | null;
  property_type?:  string | null;
  keywords?:       string[];
  amenities?:      string[];
  status?:         string | null;
  interpretacion?: string;
}

/**
 * Aplica los filtros estructurados que devuelve Gemini.
 * Cada filtro es opcional — si es null, no se aplica.
 */
export function applyAIFilters(properties: Property[], filters: AIFilters): Property[] {
  return properties.filter(p => {
    // Filtros numéricos duros
    if (filters.precio_min != null && p.price < filters.precio_min) return false;
    if (filters.precio_max != null && p.price > filters.precio_max) return false;
    if (filters.beds_min   != null && p.beds  < filters.beds_min)   return false;
    if (filters.baths_min  != null && p.baths < filters.baths_min)  return false;
    if (filters.sqm_min    != null && p.sqm   < filters.sqm_min)    return false;
    if (filters.sqm_max    != null && p.sqm   > filters.sqm_max)    return false;

    // Tipo de propiedad
    if (filters.property_type && p.propertyType) {
      if (p.propertyType !== filters.property_type) return false;
    }

    // Estado
    if (filters.status) {
      if (p.status !== filters.status) return false;
    }

    // Texto de la propiedad para búsqueda
    const searchText = normalize(
      `${p.title} ${p.location} ${p.description} ${p.captador} ${(p.amenities ?? []).join(' ')} ${p.propertyType ?? ''}`
    );

    // Keywords — debe coincidir al menos una (OR)
    if (filters.keywords && filters.keywords.length > 0) {
      const hit = filters.keywords.some(kw => searchText.includes(normalize(kw)));
      if (!hit) return false;
    }

    // Amenities — debe tener al menos una de las pedidas (OR)
    if (filters.amenities && filters.amenities.length > 0) {
      const hit = filters.amenities.some(a =>
        p.amenities?.some(pa => normalize(pa).includes(normalize(a))) ||
        searchText.includes(normalize(a))
      );
      if (!hit) return false;
    }

    return true;
  });
}
