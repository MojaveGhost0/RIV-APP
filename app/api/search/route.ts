import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// API ROUTE — /api/search
// Recibe la query del usuario, la envía a OpenRouter (LLaMA 3) y devuelve filtros JSON.
// La API key se lee en el servidor (NUNCA exponer en el cliente con NEXT_PUBLIC_).
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'Query demasiado corta' }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }

    // Sanitizar query
    const safeQuery = query.trim().slice(0, 200).replace(/[\u201c\u201d\u2018\u2019`]/g, "'");

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

    // Modelos de OpenRouter (plan gratuito, sin restricciones geográficas)
    const OR_MODELS = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ];

    let aiRes: Response | null = null;

    for (const model of OR_MODELS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://rivmargaritapremier.com',
            'X-Title': 'RIV Margarita Premier',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.05,
          }),
        });
        clearTimeout(timeoutId);

        if (aiRes.status === 404 || aiRes.status === 400 || aiRes.status === 429) {
          const errBody = await aiRes.text();
          console.warn(`[search] Modelo ${model} no disponible (${aiRes.status}):`, errBody);
          aiRes = null;
          continue;
        }

        break;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          console.warn(`[search] Timeout con modelo ${model}`);
          aiRes = null;
          continue;
        }
        throw fetchErr;
      }
    }

    if (!aiRes) {
      return NextResponse.json({ error: 'NO_MODEL_AVAILABLE' }, { status: 502 });
    }

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error(`[search] OpenRouter error ${aiRes.status}:`, errBody);
      return NextResponse.json({ error: 'API_ERROR' }, { status: 502 });
    }

    const data = await aiRes.json();
    const rawText: string = data.choices?.[0]?.message?.content ?? '';

    if (!rawText) {
      console.error('[search] OpenRouter devolvió respuesta vacía');
      return NextResponse.json({ error: 'EMPTY_RESPONSE' }, { status: 502 });
    }

    let filters: Record<string, unknown>;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      filters = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[search] Respuesta no es JSON válido:', rawText, parseErr);
      return NextResponse.json({ error: 'PARSE_ERROR' }, { status: 502 });
    }

    return NextResponse.json(filters);

  } catch (err) {
    console.error('[search] Error interno:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
