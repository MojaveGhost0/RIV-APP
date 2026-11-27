import type { Property } from '../context/DataContext';

// =============================================================================
// MOTOR DE BÚSQUEDA LOCAL — RIV MARGARITA PREMIER
// Funciona 100% en el cliente, sin API, sin latencia.
// Se usa como resultado inmediato mientras la IA procesa,
// y como fallback si la API de Gemini no está disponible.
// =============================================================================

// ─── Normalización de texto con caché LRU ligera ────────────────────────────
const NORMALIZE_CACHE = new Map<string, string>();

/** Quita tildes, convierte a minúsculas y elimina espacios extremos */
export function normalize(str: string): string {
  if (!str) return '';
  const cached = NORMALIZE_CACHE.get(str);
  if (cached !== undefined) return cached;
  const res = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (NORMALIZE_CACHE.size > 2000) NORMALIZE_CACHE.clear();
  NORMALIZE_CACHE.set(str, res);
  return res;
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
  // Modalidades de operación (Alquiler vs Venta)
  ['alquiler', 'alquileres', 'alquilar', 'alquilado', 'alquilada', 'arriendo', 'arrendamiento', 'renta', 'canon', 'mensual'],
  ['venta', 'vender', 'compra', 'comprar', 'inversion'],
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

  // ROB-03: Validar que min <= max; si min > max es un rango contradictorio, retornar {} y advertir
  if (result.min !== undefined && result.max !== undefined && result.min > result.max) {
    console.warn(`[searchEngine] Rango de precio inconsistente: min (${result.min}) > max (${result.max}). Descartando rango inválido.`);
    return {};
  }

  return result;
}

// ─── Parser de habitaciones ───────────────────────────────────────────────────
export function parseBeds(query: string): number | null {
  const q = normalize(query);
  const m = q.match(/(\d+)\s*(?:hab(?:itacion(?:es)?)?|cuarto(?:s)?|dormitorio(?:s)?|recamara(?:s)?|alcoba(?:s)?)/);
  return m ? parseInt(m[1]) : null;
}

// ─── Parser de baños ────────────────────────────────────────────────────────
export function parseBaths(query: string): number | null {
  const q = normalize(query);
  const m = q.match(/(\d+)\s*(?:ba[nñ]o(?:s)?|aseo(?:s)?|lavabo(?:s)?)/);
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

// ─── Parser de modalidad de operación (Alquiler vs Venta) ────────────────────
export function parseOperationType(query: string): 'Alquiler' | 'Venta' | null {
  const q = normalize(query);
  if (/\b(?:alquiler(?:es)?|alquilar|alquilad[ao]s?|arriendo|arrendar|arrendamiento|renta|rentar|canon|mensual)\b/.test(q)) {
    return 'Alquiler';
  }
  if (/\b(?:en\s*venta|a\s*la\s*venta|comprar|compra)\b/.test(q)) {
    return 'Venta';
  }
  return null;
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
  bathsMin: number | null,   // Paso 7 — nuevo filtro duro por baños
  propertyType: string | null,
): ScoredProperty {
  // Filtros duros (exclusión total)
  if (priceRange.min != null && property.price < priceRange.min) return { property, score: -1 };
  if (priceRange.max != null && property.price > priceRange.max) return { property, score: -1 };
  if (bedsMin  != null && property.beds  < bedsMin)              return { property, score: -1 };
  if (bathsMin != null && property.baths < bathsMin)             return { property, score: -1 };
  if (sqmRange.min != null && property.sqm < sqmRange.min)       return { property, score: -1 };
  if (sqmRange.max != null && property.sqm > sqmRange.max)       return { property, score: -1 };

  // Tipo de propiedad — filtro duro si se especificó uno
  if (propertyType && property.propertyType && property.propertyType !== propertyType) {
    return { property, score: -1 };
  }

  const fields: Array<{ text: string; weight: number }> = [
    { text: normalize(property.codigo ?? ''),                           weight: 10 },
    { text: normalize(property.title),                                  weight: 5 },
    { text: normalize(property.location),                               weight: 4 },
    { text: normalize((property.amenities ?? []).join(' ')),            weight: 3 },
    { text: normalize(property.description),                            weight: 1 },
    { text: normalize(property.captador),                               weight: 2 },
    { text: normalize(String(property.price)),                          weight: 1 },
    { text: normalize(String(property.beds) + ' habitaciones'),         weight: 2 },
    { text: normalize(String(property.sqm) + ' metros'),                weight: 2 },
    { text: normalize(property.propertyType ?? ''),                     weight: 4 },
    { text: normalize(property.operacion === 'Alquiler' || property.status === 'Alquilada' ? 'alquiler fijo canon mensual' : 'venta'), weight: 6 },
    { text: normalize(property.status ?? ''),                           weight: 4 },
  ];

  let score = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    for (const field of fields) {
      if (field.text.includes(token)) {
        // Paso 8 — Bonus x1.5 si el token coincide como palabra completa (no solo subcadena)
        const isWholeWord = new RegExp(`\\b${token}\\b`).test(field.text);
        score += field.weight * (isWholeWord ? 1.5 : 1);
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
 * - Parser de baños ("2 baños", "3 aseos")
 * - Parser de tipo de propiedad ("penthouse", "local comercial")
 * - Scoring de relevancia con bonus por palabra completa
 * - Insensible a tildes y mayúsculas
 */
export function fuzzySearch(properties: Property[], query: string): Property[] {
  const trimmed = query.trim();
  if (!trimmed) return properties;

  const normalized = normalize(trimmed);
  const rawTokens = normalized.split(/[\s,]+/).filter(t => t.length > 1);

  // ROB-02: Si se ingresó una búsqueda pero ningún token tiene longitud > 1 (e.g. 'a', 'b '),
  // no se debe devolver todo el inventario, sino un array vacío.
  if (!rawTokens.length) return [];

  const tokenArray = Array.from(expandTokens(rawTokens));
  const priceRange = parsePriceRange(normalized);
  const sqmRange = parseSqmRange(normalized);
  const bedsMin  = parseBeds(normalized);
  const bathsMin = parseBaths(normalized);  // Paso 7 — nuevo
  const propertyType = parsePropertyType(normalized);
  const operationIntent = parseOperationType(normalized);
  const isCheapIntent = /\b(?:barato|barata|economico|economica|accesible|bajo\s*precio|asequible|modico|modica)\b/.test(normalized);
  const queryEmbedding = generateSemanticEmbedding1536(normalized);

  const isPropertyRental = (p: Property) =>
    p.operacion === 'Alquiler' ||
    p.status === 'Alquilada' ||
    /\b(?:alquiler|arriendo|canon)\b/.test(normalize(`${p.title} ${p.description}`));

  const scored = properties
    .map(p => {
      const lexical = scoreProperty(p, tokenArray, priceRange, sqmRange, bedsMin, bathsMin, propertyType);
      const isRent = isPropertyRental(p);
      // Si la consulta pide explícitamente "alquiler", incluir siempre propiedades en alquiler aunque no tengan la palabra en el título
      const baseLexical =
        lexical.score <= 0 && operationIntent === 'Alquiler' && isRent && (!propertyType || !p.propertyType || p.propertyType === propertyType)
          ? 10
          : lexical.score;
      if (baseLexical <= 0) return { property: p, score: -1 };

      // Fusión híbrida: Score Léxico + Similitud Coseno en 1536 dimensiones (peso semántico)
      const cosSim = cosineSimilarity1536(queryEmbedding, getPropertyEmbedding1536(p));
      let totalScore = baseLexical + Math.max(0, cosSim) * 8;

      // Prioridad estricta por modalidad solicitada (Alquiler primero cuando se busca alquiler)
      if (operationIntent === 'Alquiler') {
        totalScore += isRent ? 1000 : -200;
      } else if (operationIntent === 'Venta') {
        totalScore += !isRent ? 500 : -200;
      }

      return { property: p, score: totalScore };
    })
    .filter(r => r.score > 0);

  scored.sort((a, b) => {
    // 1. Si busca alquiler, poner SIEMPRE primero las propiedades con modalidad/estatus de alquiler
    if (operationIntent === 'Alquiler') {
      const aRent = isPropertyRental(a.property) ? 1 : 0;
      const bRent = isPropertyRental(b.property) ? 1 : 0;
      if (aRent !== bRent) return bRent - aRent;
    }
    // 2. Si además pidió "barato / económico", desempatar o priorizar de menor a mayor precio dentro del grupo
    if (isCheapIntent) {
      if (a.property.price !== b.property.price) return a.property.price - b.property.price;
    }
    return b.score - a.score;
  });

  return scored.map(r => r.property);
}

// =============================================================================
// VECTORIZACIÓN SEMÁNTICA DE 1536 DIMENSIONES (EMBEDDINGS & COSINE SIMILARITY)
// Implementación compatible con pgvector (VECTOR(1536)) y modelos de embedding.
// Convierte tanto la consulta en lenguaje natural como cada inmueble del catálogo
// en un vector normalizado L2 de 1536 dimensiones (Float32Array(1536)) y calcula
// la Similitud Coseno: cos(θ) = (A · B) / (||A|| * ||B||).
// =============================================================================

export const EMBEDDING_DIMENSIONS = 1536;

/** Hash FNV-1a de 32 bits para proyectar características semánticas en el espacio de 1536 dimensiones */
function fnv1aHash(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Genera un vector de embedding denso y normalizado (L2 = 1.0) de exactamente 1536 dimensiones.
 * Proyecta tokens léxicos, grupos de sinónimos inmobiliarios, bigramas y trigramas de caracteres
 * (Feature Hashing / Random Projection en R^1536) para capturar similitud semántica y morfológica.
 */
export function generateSemanticEmbedding1536(text: string): number[] {
  const vec = new Float32Array(EMBEDDING_DIMENSIONS);
  const norm = normalize(text);
  if (!norm) return Array.from(vec);

  const rawTokens = norm.split(/[\s,.;:/\-]+/).filter(t => t.length > 1);
  const expanded = Array.from(expandTokens(rawTokens));

  // 1. Proyección de tokens y sinónimos expandidos en múltiples sub-espacios de las 1536 dimensiones
  for (const token of expanded) {
    const isPrimary = rawTokens.includes(token);
    const baseWeight = isPrimary ? 2.4 : 1.15;

    for (let proj = 0; proj < 4; proj++) {
      const h = fnv1aHash(`${token}#p${proj}`, 2166136261 + proj * 104729);
      const dim = h % EMBEDDING_DIMENSIONS;
      const sign = (h & 1) === 0 ? 1 : -1;
      vec[dim] += sign * baseWeight;
    }

    // 2. N-gramas de caracteres (trigramas) para tolerancia morfológica y semántica
    const padded = `^${token}$`;
    for (let i = 0; i <= padded.length - 3; i++) {
      const trigram = padded.slice(i, i + 3);
      const hTri = fnv1aHash(trigram, 1469598103);
      const dimTri = hTri % EMBEDDING_DIMENSIONS;
      const signTri = (hTri & 1) === 0 ? 1 : -1;
      vec[dimTri] += signTri * (baseWeight * 0.35);
    }
  }

  // 3. Bigramas contextuales (pares de palabras consecutivas, ej: "vista mar", "costa azul")
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const bigram = `${rawTokens[i]}_${rawTokens[i + 1]}`;
    const hBi = fnv1aHash(bigram, 314159265);
    const dimBi = hBi % EMBEDDING_DIMENSIONS;
    const signBi = (hBi & 1) === 0 ? 1 : -1;
    vec[dimBi] += signBi * 3.0;
  }

  // 4. Normalización L2 unitaria: ||V||_2 = 1 para que el producto punto sea igual a la Similitud Coseno
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    sumSq += vec[i] * vec[i];
  }
  const normL2 = Math.sqrt(sumSq);
  if (normL2 > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      vec[i] = Number((vec[i] / normL2).toFixed(6));
    }
  }

  return Array.from(vec);
}

/** Construye el documento semántico enriquecido de un inmueble y genera su vector de 1536 dimensiones */
const PROPERTY_EMBEDDING_CACHE = new Map<string, number[]>();

export function getPropertyEmbedding1536(property: Property): number[] {
  const cacheKey = `${property.id}:${property.title}:${property.price}:${property.status}:${property.operacion || 'Venta'}`;
  const cached = PROPERTY_EMBEDDING_CACHE.get(cacheKey);
  if (cached) return cached;

  const semanticCorpus = [
    property.codigo || '',
    property.title,
    property.propertyType || 'Inmueble',
    property.operacion === 'Alquiler' ? 'alquiler fijo canon mensual arrendamiento' : 'venta compra inversion',
    property.location,
    `${property.beds} habitaciones cuartos dormitorios`,
    `${property.baths} banos`,
    `${property.sqm} metros cuadrados m2`,
    (property.amenities || []).join(' '),
    property.description || '',
    property.price <= 50000 ? 'economico barato oportunidad accesible' : property.price >= 120000 ? 'lujo exclusivo premium' : 'precio medio',
  ].join(' ');

  const embedding = generateSemanticEmbedding1536(semanticCorpus);
  if (PROPERTY_EMBEDDING_CACHE.size > 500) PROPERTY_EMBEDDING_CACHE.clear();
  PROPERTY_EMBEDDING_CACHE.set(cacheKey, embedding);
  return embedding;
}

/**
 * Calcula la Similitud Coseno entre dos vectores de 1536 dimensiones:
 * cos(θ) = Σ(A_i * B_i) / (||A|| * ||B||)
 */
export function cosineSimilarity1536(vecA: number[], vecB: number[]): number {
  if (vecA.length !== EMBEDDING_DIMENSIONS || vecB.length !== EMBEDDING_DIMENSIONS) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ─── Aplicar filtros estructurados de IA + Ranking Vectorial (1536 dims) ─────
export interface AIFilters {
  precio_min?:     number | null;
  precio_max?:     number | null;
  beds_min?:       number | null;
  baths_min?:      number | null;
  sqm_min?:        number | null;
  sqm_max?:        number | null;
  property_type?:  string | null;
  operacion?:      'Alquiler' | 'Venta' | null;
  sort_price?:     'asc' | 'desc' | null;
  keywords?:       string[];
  amenities?:      string[];
  status?:         string | null;
  interpretacion?: string;
  /** Vector de 1536 dimensiones generado para la consulta del usuario */
  embedding?:      number[];
  /** Dimensiones del espacio vectorial (1536) */
  embedding_dimensions?: number;
  /** Modelo o motor vectorial utilizado */
  embedding_model?: string;
}

/**
 * Aplica los filtros estructurados extraídos de la consulta y ordena los inmuebles
 * priorizando la modalidad solicitada (ej. Alquiler primero) y la Similitud Coseno
 * entre el vector de 1536 dimensiones de la consulta y el de cada propiedad.
 */
export function applyAIFilters(properties: Property[], filters: AIFilters): Property[] {
  const queryVector =
    filters.embedding && filters.embedding.length === EMBEDDING_DIMENSIONS
      ? filters.embedding
      : generateSemanticEmbedding1536(
          [
            filters.operacion || '',
            filters.property_type || '',
            ...(filters.keywords || []),
            ...(filters.amenities || []),
            filters.interpretacion || '',
          ].join(' ')
        );

  const isPropertyRental = (p: Property) =>
    p.operacion === 'Alquiler' ||
    p.status === 'Alquilada' ||
    /\b(?:alquiler|arriendo|canon)\b/.test(normalize(`${p.title} ${p.description}`));

  const filterFn = (p: Property, enforceKeywords: boolean) => {
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
      `${p.codigo ?? ''} ${p.title} ${p.location} ${p.description} ${p.captador} ${(p.amenities ?? []).join(' ')} ${p.propertyType ?? ''} ${p.operacion ?? ''} ${p.status ?? ''}`
    );

    // Keywords — debe coincidir al menos una (OR)
    if (enforceKeywords && filters.keywords && filters.keywords.length > 0) {
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
  };

  let candidates = properties.filter(p => filterFn(p, true));
  // Si al buscar "alquiler" ninguna propiedad coincidía con keywords secundarias, relajar keywords manteniendo tipo/precio
  if (candidates.length === 0 && filters.operacion === 'Alquiler') {
    candidates = properties.filter(p => filterFn(p, false));
  }

  // Ordenamiento Semántico:
  // 1° Propiedades con estatus/modalidad de Alquiler cuando la consulta pide Alquiler (o Venta cuando pide Venta)
  // 2° Orden por precio ascendente si la consulta pidió "barato / económico"
  // 3° Similitud Coseno en el espacio vectorial de 1536 dimensiones
  return candidates
    .map(p => ({
      property: p,
      isRental: isPropertyRental(p),
      similarity: cosineSimilarity1536(queryVector, getPropertyEmbedding1536(p)),
    }))
    .sort((a, b) => {
      if (filters.operacion === 'Alquiler') {
        if (a.isRental !== b.isRental) return a.isRental ? -1 : 1;
        // Dentro de las propiedades en alquiler, poner primero las disponibles (Activa) y luego las Alquiladas
        const aActiveRent = a.isRental && a.property.status === 'Activa' ? 1 : 0;
        const bActiveRent = b.isRental && b.property.status === 'Activa' ? 1 : 0;
        if (aActiveRent !== bActiveRent) return bActiveRent - aActiveRent;
      } else if (filters.operacion === 'Venta') {
        if (a.isRental !== b.isRental) return !a.isRental ? -1 : 1;
      }

      if (filters.sort_price === 'asc' && a.property.price !== b.property.price) {
        return a.property.price - b.property.price;
      }
      if (filters.sort_price === 'desc' && a.property.price !== b.property.price) {
        return b.property.price - a.property.price;
      }

      return b.similarity - a.similarity;
    })
    .map(item => item.property);
}
