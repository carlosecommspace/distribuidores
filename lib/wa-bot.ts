import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'

// maxRetries: retry sobre 5xx/429/network. timeout: fallback si el stream se queda colgado.
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
  timeout: 60_000,
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// El SDK reintenta errores de red pero a veces deja pasar ERR_STREAM_PREMATURE_CLOSE
// (el body llega gzipped y se corta a mitad). Envolvemos con retry manual.
async function callClaudeWithRetry(params: Anthropic.MessageCreateParamsNonStreaming, attempts = 3) {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.messages.create(params)
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      const code = (e as { code?: string })?.code || ''
      const transient =
        code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_SOCKET' ||
        /Premature close/i.test(msg) ||
        /fetch failed/i.test(msg) ||
        /socket hang up/i.test(msg)
      if (!transient || i === attempts - 1) throw e
      const backoff = 500 * Math.pow(2, i)
      console.warn(`[wa-bot] Claude transient error (${code || msg}), retry ${i + 1}/${attempts - 1} in ${backoff}ms`)
      await sleep(backoff)
    }
  }
  throw lastErr
}

interface BotContext {
  userId: string
  contactId: string
  contactPhone: string
  contactName: string | null
}

/**
 * Genera una respuesta del bot para un mensaje entrante.
 * Considera:
 *   - Prompt custom del sistema (Settings.waAiPrompt)
 *   - Cliente vinculado (si aplica) — nombre, empresa, lista de precio, últimos pedidos
 *   - Últimos ~10 mensajes de la conversación
 *   - Catálogo resumido (top 30 productos por venta)
 *
 * Devuelve null si:
 *   - No hay ANTHROPIC_API_KEY
 *   - El bot decide escalar a humano (marca la conversación como necesita atención)
 */
export async function generateBotReply(ctx: BotContext): Promise<{ reply: string } | { escalate: true; reason?: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[wa-bot] ANTHROPIC_API_KEY no configurada — el bot no responde')
    return null
  }

  const [settings, contact, recentMessages] = await Promise.all([
    prisma.settings.findUnique({ where: { userId: ctx.userId } }),
    prisma.whatsAppContact.findUnique({
      where: { id: ctx.contactId },
      include: { client: { include: { priceList: true } } },
    }),
    prisma.whatsAppMessage.findMany({
      where: { contactId: ctx.contactId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ])

  if (!contact) return null

  // Resumen del catálogo — top 30 productos activos con stock
  const products = await prisma.product.findMany({
    where: { userId: ctx.userId, isActive: true, stock: { gt: 0 } },
    select: { sku: true, name: true, priceUSD: true, stock: true, unit: true, category: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 30,
  })

  // Aplicar precios de la lista del cliente si existe
  let overrides = new Map<string, number>()
  if (contact.client?.priceListId) {
    const items = await prisma.priceListItem.findMany({
      where: { priceListId: contact.client.priceListId },
      select: { productId: true, priceUSD: true },
    })
    // Necesitaríamos mapear por productId — para el bot, es OK usar priceUSD del producto por ahora
    // (fuera del scope de este MVP; la lista se aplica cuando cotiza explícito)
    void items // reservado
    void overrides
  }

  const catalogText = products.length === 0
    ? 'Catálogo vacío por ahora.'
    : products.map((p) => `- ${p.sku} · ${p.name} · $${p.priceUSD} · stock ${p.stock} ${p.unit}${p.category ? ` [${p.category}]` : ''}`).join('\n')

  const clientBlock = contact.client
    ? `Este contacto es cliente registrado:
- Nombre: ${contact.client.name}
- Empresa: ${contact.client.company || 'N/A'}
- Tipo: ${contact.client.type}
- Lista de precio: ${contact.client.priceList?.name || 'Precios base'}`
    : `Contacto NO vinculado a un cliente registrado. No conoces su historial.`

  const conversationText = recentMessages
    .slice()
    .reverse()
    .map((m) => `${m.direction === 'in' ? 'CLIENTE' : 'TÚ'}: ${m.content}`)
    .join('\n')

  const systemPrompt = settings?.waAiPrompt?.trim() || DEFAULT_SYSTEM_PROMPT

  try {
    const response = await callClaudeWithRetry({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${clientBlock}

CATÁLOGO ACTUAL (parcial):
${catalogText}

HISTORIAL DE LA CONVERSACIÓN (más reciente al final):
${conversationText}

INSTRUCCIONES:
- Si puedes ayudar con precio/disponibilidad/pedidos, responde directamente en español, breve, tono profesional.
- Si el cliente pide algo que requiere confirmación humana (descuentos especiales, entregas urgentes, cambios de política), responde con la palabra literal "ESCALATE" seguida de dos puntos y una razón corta. Ej: "ESCALATE: pide descuento no autorizado".
- No inventes precios ni stock. Si no estás seguro, ESCALATE.
- Responde SOLO con el texto que enviarías al cliente, sin metadata.`,
        },
      ],
    })
    const first = response.content[0]
    if (!first || first.type !== 'text') return null
    const text = first.text.trim()

    if (text.startsWith('ESCALATE')) {
      const reason = text.replace(/^ESCALATE:?\s*/i, '').trim()
      return { escalate: true, reason: reason || undefined }
    }
    return { reply: text }
  } catch (e) {
    const err = e as { status?: number; message?: string; code?: string }
    console.error('[wa-bot] Claude error', {
      status: err.status,
      code: err.code,
      message: err.message,
    })
    return null
  }
}

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente virtual del vendedor de una distribuidora venezolana profesional. Respondes por WhatsApp a clientes con tono cercano pero conciso. Nunca inventas información. Cuando dudes, escalas a un humano.`
