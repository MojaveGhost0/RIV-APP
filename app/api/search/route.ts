import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';

// =============================================================================
// API ROUTE — /api/search
// Recibe la query del usuario, la envía a Gemini Flash y devuelve filtros JSON.
// La API key se lee en el servidor (NUNCA exponer en el cliente con NEXT_PUBLIC_).
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'Query demasiado corta' }, { status: 400 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      // No hay API key configurada → el cliente debe hacer fallback a fuzzy
      return NextResponse.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }

    // Paso 3 — Sanitizar query: limitar longitud y eliminar comillas que podrían romper el prompt
    const safeQuery = query.trim().slice(0, 200).replace(/["“”‘’`]/g, "'");

    const prompt = `Eres un asistente de búsqueda para "RIV Margarita Premier", una agencia inmobiliaria en la Isla de Margarita, Venezuela.
Tu tarea es analizar la consulta del usuario y extraer filtros estructurados para buscar propiedades. Los precios son en USD.

Consulta del usuario: "${safeQuery}"

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "precio_min": <número en USD o null>,
  "precio_max": <número en USD o null>,
  "beds_min": <número mínimo de habitaciones o null>,
  "baths_min": <número mínimo de baños o null>,
  "sqm_min": <metros cuadrados mínimos o null>,
  "sqm_max": <metros cuadrados máximos o null>,
  "property_type": <"Apartamento" | "Casa / Quinta" | "Townhouse" | "Penthouse" | "Local Comercial" | "Oficina" | "Terreno" | null>,
  "keywords": <array de strings para buscar en título/descripción/ubicación, máximo 5>,
  "amenities": <array de comodidades exactas, máximo 4>,
  "status": <"Activa" | "Vendida" | "Suspendida" | null>,
  "interpretacion": <resumen corto de qué se buscó, ej: "Apto 3hab · Pampatar · Máx $80k", máximo 60 caracteres>
}

=== ZONAS DE MARGARITA ===
Municipio Maneiro: Pampatar, El Cardón, Guarame
Municipio Mariño: Porlamar, Los Robles, Costa Azul, El Valle
Municipio Arismendi: Juan Griego, El Maco
Municipio Díaz: San Juan Bautista
Municipio García: La Asunción, Santa Ana, El Cercado
Municipio Marcano: El Agua, Playa El Agua, Manzanillo, Pedro González
Playas: Playa El Ángel, Playa Parguito, Playa Guacuco, Playa Caribe, La Restinga
Otras: Punta de Piedras, Villa Rosa, San Pedro de Coche

=== REGLAS DE INTERPRETACIÓN ===
Precio:
- "barato" / "económico" / "módico" / "asequible" → precio_max: 50000
- "precio medio" / "mediano" → precio_min: 50000, precio_max: 120000
- "lujoso" / "exclusivo" / "premium" / "alto standing" → precio_min: 120000
- "80k" = 80000, "medio millón" = 500000, "150 mil" = 150000

Habitaciones / Baños:
- "cuartos" / "habs" / "habitaciones" / "dormitorios" / "recámaras" = beds
- "3 cuartos" → beds_min: 3

Metraje:
- "más de 100 metros" / "100m2" / "100 m²" → sqm_min: 100
- "menos de 80 metros" → sqm_max: 80
- "grande" / "espacioso" → sqm_min: 150
- "pequeño" / "compacto" → sqm_max: 80

Tipo de propiedad:
- "apto" / "apartamento" / "piso" / "flat" → property_type: "Apartamento"
- "casa" / "quinta" / "villa" / "chalet" → property_type: "Casa / Quinta"
- "townhouse" / "town house" / "dúplex" → property_type: "Townhouse"
- "penthouse" / "ph" / "ático" → property_type: "Penthouse"
- "local" / "comercial" / "tienda" / "negocio" → property_type: "Local Comercial"
- "oficina" / "despacho" → property_type: "Oficina"
- "terreno" / "lote" / "parcela" → property_type: "Terreno"

Comodidades (amenities exactas disponibles):
"Piscina", "Planta Eléctrica", "Pozo de Agua", "Vigilancia 24/7",
"Amoblado", "Vista al Mar", "Gimnasio", "Ascensor",
"Estacionamiento Techado", "Terraza Privada", "Jacuzzi",
"Área de BBQ", "Área de Oficinas", "Baño de Visitas"

Ubicación:
- "cerca del mar" / "frente al mar" / "vista al mar" / "playa" → keywords: ["mar", "playa"] 
- Nombre de zona → keywords: [nombre de zona normalizado]

Si no puedes extraer un filtro, déjalo null o array vacío [].
Responde SOLO el JSON sin explicación adicional.`;

    // Paso 2 — Timeout de 8 segundos con AbortController para evitar esperas indefinidas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let groqRes: Response;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'qwen/qwen3.8-27b', // Modelo disponible dinámicamente en tu API Key
          messages: [
            {
              role: 'user',
              content: prompt,
            }
          ],
          temperature: 0.05,
        }),
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        console.warn('[search] Groq timeout después de 8s');
        return NextResponse.json({ error: 'TIMEOUT' }, { status: 504 });
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    if (!groqRes.ok) {
      const errBody = await groqRes.text();
      console.error(`[search] Groq API error: ${groqRes.status}`);
      console.error(`[search] Groq error body:`, errBody);
      return NextResponse.json({ error: 'API_ERROR' }, { status: 502 });
    }

    const data = await groqRes.json();
    const rawText: string = data.choices?.[0]?.message?.content ?? '';

    if (!rawText) {
      console.error('[search] Groq devolvió respuesta vacía');
      return NextResponse.json({ error: 'EMPTY_RESPONSE' }, { status: 502 });
    }

    // Paso 1 — Proteger JSON.parse: limpiar posible markdown envolvente y capturar errores
    let filters: Record<string, unknown>;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      filters = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[search] Gemini no devolvió JSON válido:', rawText, parseErr);
      return NextResponse.json({ error: 'PARSE_ERROR' }, { status: 502 });
    }

    return NextResponse.json(filters);

  } catch (err) {
    console.error('[search] Error interno:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
