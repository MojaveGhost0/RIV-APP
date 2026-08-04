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
  ['apartamento', 'apto', 'apt', 'piso', 'flat', 'depto', 'dpto'],
  ['habitacion', 'habitaciones', 'hab', 'habs', 'cuarto', 'cuartos', 'dormitorio', 'dormitorios', 'recamara', 'recamaras', 'alcoba'],
  ['bano', 'banos', 'aseo', 'lavabo'],
  ['estacionamiento', 'parking', 'garaje', 'cochera', 'parqueadero'],
  ['piscina', 'pool', 'alberca'],
  ['mar', 'playa', 'costa', 'litoral', 'oceano', 'agua'],
  ['villa', 'quinta', 'casa', 'chalet', 'mansion', 'townhouse'],
  ['local', 'comercial', 'tienda', 'oficina', 'negocio'],
  ['penthouse', 'atico', 'azotea', 'terraza'],
  ['amoblado', 'amueblado', 'equipado', 'mobilado'],
  ['vigilancia', 'seguridad', 'guardia', 'conserje'],
  ['planta', 'electricidad', 'generador', 'planta electrica'],
  ['pozo', 'agua', 'cisterna'],
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

  // Precio máximo: "menos de X", "max X", "hasta X", "no más de X"
  const maxMatch = q.match(/(?:menos de|max(?:imo)?|hasta|no m[aá]s de|por debajo de)\s*([\d.,]+k?)/);
  if (maxMatch) result.max = parseAmount(maxMatch[1]);

  // Precio mínimo: "más de X", "desde X", "mínimo X", "a partir de X"
  const minMatch = q.match(/(?:m[aá]s de|desde|m[ií]n(?:imo)?|a partir de|sobre)\s*([\d.,]+k?)/);
  if (minMatch) result.min = parseAmount(minMatch[1]);

  // Precio barato/económico → max $60k
  if (/\b(?:barato|economico|economica|accesible|bajo precio|asequible)\b/.test(q)) {
    result.max = result.max ?? 60000;
  }

  // Precio lujoso → min $120k
  if (/\b(?:lujo|lujoso|exclusivo|exclusiva|premium|alto standing)\b/.test(q)) {
    result.min = result.min ?? 120000;
  }

  return result;
}

// ─── Parser de habitaciones ───────────────────────────────────────────────────
export function parseBeds(query: string): number | null {
  const q = normalize(query);
  // "3 hab", "3 habitaciones", "3 cuartos", "3 dormitorios"
  const m = q.match(/(\d+)\s*(?:hab(?:itacion(?:es)?)?|cuarto(?:s)?|dormitorio(?:s)?|recamara(?:s)?|alcoba(?:s)?)/);
  return m ? parseInt(m[1]) : null;
}

// ─── Puntuación de relevancia ─────────────────────────────────────────────────
interface ScoredProperty { property: Property; score: number; }

function scoreProperty(property: Property, tokens: string[], priceRange: PriceRange, bedsMin: number | null): ScoredProperty {
  // Filtros duros (exclusión total)
  if (priceRange.min != null && property.price < priceRange.min) return { property, score: -1 };
  if (priceRange.max != null && property.price > priceRange.max) return { property, score: -1 };
  if (bedsMin != null && property.beds < bedsMin) return { property, score: -1 };

  const fields: Array<{ text: string; weight: number }> = [
    { text: normalize(property.title),                                  weight: 5 },
    { text: normalize(property.location),                               weight: 4 },
    { text: normalize((property.amenities ?? []).join(' ')),            weight: 3 },
    { text: normalize(property.description),                            weight: 1 },
    { text: normalize(property.captador),                               weight: 2 },
    { text: normalize(String(property.price)),                          weight: 1 },
    { text: normalize(String(property.beds) + ' habitaciones'),         weight: 2 },
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
 * - Sinónimos inmobiliarios
 * - Parser de rangos de precio ("menos de 80k", "entre 50 y 100")
 * - Parser de habitaciones ("3 habs", "4 cuartos")
 * - Scoring de relevancia (los más relevantes primero)
 * - Insensible a tildes y mayúsculas
 */
export function fuzzySearch(properties: Property[], query: string): Property[] {
  const trimmed = query.trim();
  if (!trimmed) return properties;

  const normalized = normalize(trimmed);
  const rawTokens = normalized.split(/[\s,]+/).filter(t => t.length > 1);

  if (!rawTokens.length) return properties;

  // Array.from necesario porque Set no es iterable en el target TS actual (sin --downlevelIteration)
  const tokenArray = Array.from(expandTokens(rawTokens));
  const priceRange = parsePriceRange(normalized);
  const bedsMin = parseBeds(normalized);

  const scored = properties
    .map(p => scoreProperty(p, tokenArray, priceRange, bedsMin))
    .filter(r => r.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.map(r => r.property);
}

// ─── Aplicar filtros estructurados de IA ────────────────────────────────────
export interface AIFilters {
  precio_min?:   number | null;
  precio_max?:   number | null;
  beds_min?:     number | null;
  baths_min?:    number | null;
  keywords?:     string[];
  amenities?:    string[];
  status?:       string | null;
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

    // Estado
    if (filters.status) {
      if (p.status !== filters.status) return false;
    }

    // Texto de la propiedad para búsqueda
    const searchText = normalize(
      `${p.title} ${p.location} ${p.description} ${p.captador} ${(p.amenities ?? []).join(' ')}`
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
