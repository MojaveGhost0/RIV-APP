import { NextRequest, NextResponse } from 'next/server';

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

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      // No hay API key configurada → el cliente debe hacer fallback a fuzzy
      return NextResponse.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }

    const prompt = `Eres un asistente de búsqueda para una agencia inmobiliaria en Venezuela (Isla de Margarita).
Tu tarea es analizar la consulta del usuario y extraer filtros estructurados para buscar propiedades en USD.

Consulta del usuario: "${query.trim()}"

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "precio_min": <número en USD o null>,
  "precio_max": <número en USD o null>,
  "beds_min": <número mínimo de habitaciones o null>,
  "baths_min": <número mínimo de baños o null>,
  "keywords": <array de strings para buscar en título/descripción/ubicación, máximo 5>,
  "amenities": <array de comodidades exactas como "Piscina", "Planta Eléctrica", "Vista al Mar", "Amoblado", "Jacuzzi", máximo 4>,
  "status": <"Activa" | "Vendida" | "Suspendida" | null>,
  "interpretacion": <resumen corto de qué se buscó, ej: "3+ hab · Vista al mar · Máx $80k", máximo 60 caracteres>
}

Reglas de interpretación:
- "barato" / "económico" / "asequible" / "módico" → precio_max: 65000
- "lujoso" / "exclusivo" / "premium" / "alto standing" → precio_min: 120000
- "80k" = 80000, "medio millón" = 500000
- "cuartos" / "habs" / "habitaciones" / "dormitorios" / "recámaras" = beds
- "cerca del mar" / "frente al mar" / "vista al mar" / "playa" → keywords: ["mar", "costa", "playa"]
- "amoblado" / "amueblado" → amenities: ["Amoblado"]
- "con piscina" → amenities: ["Piscina"]
- "planta eléctrica" / "con planta" → amenities: ["Planta Eléctrica"]
- Si no puedes extraer un filtro, déjalo null o array vacío []
- Responde SOLO el JSON sin explicación adicional`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,    // Baja temperatura → respuestas más deterministas
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.error(`Gemini API error: ${geminiRes.status}`);
      return NextResponse.json({ error: 'API_ERROR' }, { status: 502 });
    }

    const data = await geminiRes.json();
    const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    // Gemini a veces envuelve el JSON en bloques de código markdown
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response:', rawText);
      return NextResponse.json({ error: 'PARSE_ERROR' }, { status: 500 });
    }

    const filters = JSON.parse(jsonMatch[0]);
    return NextResponse.json(filters);

  } catch (err) {
    console.error('Search route error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
