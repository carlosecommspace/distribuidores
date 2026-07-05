import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  businessName: z.string().min(1).max(120),
  hint: z.string().max(1000).optional(),
})

interface ClaudeResp {
  content: Array<{ type: string; text?: string }>
}

async function callClaude(system: string, user: string): Promise<ClaudeResp> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'accept-encoding': 'identity',
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`)
  }
  return (await res.json()) as ClaudeResp
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'IA no configurada en el servidor.' }, { status: 503 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { businessName, hint } = parsed.data

  const system = `Eres un copywriter especializado en distribuidoras venezolanas. Escribes textos institucionales concisos, profesionales y creíbles en español rioplatense neutro venezolano. NUNCA inventes datos específicos (años, cifras, ubicaciones, nombres de fundadores). NUNCA uses adjetivos vacíos ("líder indiscutible", "los mejores del mercado"). Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto extra alrededor.`

  const user = `Genera el contenido institucional para el sitio web de una distribuidora llamada "${businessName}".

${hint ? `Contexto adicional del negocio: ${hint}` : 'No tengo contexto adicional del negocio, asume que es una distribuidora venezolana con catálogo variado.'}

Devuelve un JSON con exactamente estos tres campos:
{
  "mission": "Misión: 2-3 oraciones, presente, empieza describiendo qué hace el negocio y para quién. Sin adjetivos vacíos.",
  "vision": "Visión: 1-2 oraciones, futuro, describe hacia dónde va el negocio. Concreto.",
  "description": "Descripción breve: 3-4 oraciones que un cliente potencial leería en el sitio para entender qué vende y qué lo diferencia. Tono cercano y profesional."
}

Responde SOLO con el JSON, sin backticks ni prefijos.`

  try {
    const resp = await callClaude(system, user)
    const text = resp.content.find((b) => b.type === 'text' && b.text)?.text?.trim() || ''
    // Intentar parsear el JSON. Si viene con backticks, limpiarlos.
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    let out: { mission?: string; vision?: string; description?: string }
    try {
      out = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'La IA devolvió una respuesta inválida. Intenta de nuevo.' }, { status: 502 })
    }
    return NextResponse.json({
      mission: out.mission || '',
      vision: out.vision || '',
      description: out.description || '',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[ai-generate]', msg)
    return NextResponse.json({ error: 'No se pudo generar el contenido. Intenta de nuevo.' }, { status: 502 })
  }
}
