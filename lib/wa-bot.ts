import { prisma } from './prisma'
import { codePrefix, nextRequestCode } from './requests'
import { notify } from './notifications'

// Nota: NO usamos el SDK @anthropic-ai/sdk porque en Railway falla con
// ERR_STREAM_PREMATURE_CLOSE (bug de node-fetch v2 leyendo respuestas gzipped).
// Hacemos fetch nativo (undici) con accept-encoding: identity para saltarnos gzip.

type TextBlock = { type: 'text'; text: string }
type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown }
type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface ClaudeResponse {
  content: ContentBlock[]
  stop_reason?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callClaude(params: {
  model: string
  max_tokens: number
  system: string
  messages: ClaudeMessage[]
  tools?: ClaudeTool[]
}, attempts = 3): Promise<ClaudeResponse> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'accept-encoding': 'identity',
          accept: 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const err = new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`) as Error & { status?: number }
        err.status = res.status
        if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
          const backoff = 500 * Math.pow(2, i)
          console.warn(`[wa-bot] Claude ${res.status}, retry ${i + 1}/${attempts - 1} in ${backoff}ms`)
          await sleep(backoff)
          continue
        }
        throw err
      }
      return (await res.json()) as ClaudeResponse
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      const code = (e as { code?: string; cause?: { code?: string } })?.code
        || (e as { cause?: { code?: string } })?.cause?.code
        || ''
      const transient =
        code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_SOCKET' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        /Premature close/i.test(msg) ||
        /fetch failed/i.test(msg) ||
        /socket hang up/i.test(msg) ||
        /aborted/i.test(msg)
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

// ---------------------------------------------------------------------------
// Tool: create_order
// ---------------------------------------------------------------------------

const CREATE_ORDER_TOOL: ClaudeTool = {
  name: 'create_order',
  description:
    'Crea un pedido en el sistema en estado pendiente de pago. Úsalo SOLO cuando el cliente ha confirmado los productos Y (si no es cliente registrado) ha compartido su nombre y teléfono real. Después de crearlo, el sistema te devuelve un mensaje ya redactado para enviar al cliente — reenvíalo tal cual, sin agregar precios o links que no aparezcan ahí.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Lista de productos a incluir en el pedido.',
        items: {
          type: 'object',
          properties: {
            sku: { type: 'string', description: 'SKU exacto del producto tal como aparece en el catálogo.' },
            quantity: { type: 'integer', minimum: 1, description: 'Cantidad de unidades solicitadas.' },
          },
          required: ['sku', 'quantity'],
        },
        minItems: 1,
      },
      notes: {
        type: 'string',
        description: 'Notas opcionales del cliente sobre el pedido (entrega, preferencias, etc.).',
      },
      customer_name: {
        type: 'string',
        description: 'Nombre completo del cliente. Requerido si el contacto NO es cliente registrado. Omítelo si ya es cliente registrado.',
      },
      customer_phone: {
        type: 'string',
        description: 'Teléfono real del cliente en formato venezolano (ej "04141234567" o "584141234567"). Requerido si el contacto NO es cliente registrado — el identificador que muestra WhatsApp puede ser anónimo (LID) y no sirve para llamarlo. Omítelo si ya es cliente registrado.',
      },
    },
    required: ['items'],
  },
}

interface OrderToolInput {
  items: Array<{ sku: string; quantity: number }>
  notes?: string
  customer_name?: string
  customer_phone?: string
}

interface OrderToolResult {
  ok: boolean
  error?: string
  needs_customer_info?: { missing: Array<'name' | 'phone'>; instructions: string }
  message_for_customer?: string
  code?: string
  outOfStock?: Array<{ sku: string; requested: number; available: number }>
  unknownSkus?: string[]
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits.length < 10 || digits.length > 13) return null
  return digits
}

// True si el phoneNumber del contacto es un LID (identificador anónimo de WA),
// no un teléfono real. Detectamos por el sufijo @lid en el jid o por longitud.
function contactPhoneIsLid(contact: { phoneNumber: string; jid: string | null }): boolean {
  if (contact.jid?.includes('@lid')) return true
  const digits = contact.phoneNumber.replace(/[^0-9]/g, '')
  return digits.length > 14
}

async function executeCreateOrder(ctx: BotContext, input: OrderToolInput): Promise<OrderToolResult> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: 'items vacío' }
  }

  const contact = await prisma.whatsAppContact.findUnique({
    where: { id: ctx.contactId },
    include: { client: true },
  })
  if (!contact) return { ok: false, error: 'Contacto no existe' }

  const skus = Array.from(new Set(input.items.map((i) => i.sku)))
  const products = await prisma.product.findMany({
    where: { userId: ctx.userId, sku: { in: skus }, isActive: true },
    select: { id: true, sku: true, name: true, priceUSD: true, stock: true },
  })
  const bySku = new Map(products.map((p) => [p.sku, p]))

  const unknownSkus = skus.filter((s) => !bySku.has(s))
  if (unknownSkus.length > 0) return { ok: false, error: 'SKUs desconocidos', unknownSkus }

  // Consolidar por SKU
  const merged = new Map<string, number>()
  for (const it of input.items) {
    merged.set(it.sku, (merged.get(it.sku) || 0) + Math.max(1, Math.floor(it.quantity)))
  }

  const outOfStock: Array<{ sku: string; requested: number; available: number }> = []
  for (const [sku, qty] of merged) {
    const p = bySku.get(sku)!
    if (qty > p.stock) outOfStock.push({ sku, requested: qty, available: p.stock })
  }
  if (outOfStock.length > 0) return { ok: false, error: 'Stock insuficiente', outOfStock }

  // Precios: si el contacto tiene cliente con lista, aplicarla
  let priceOverrides = new Map<string, number>()
  if (contact.client?.priceListId) {
    const items = await prisma.priceListItem.findMany({
      where: {
        priceListId: contact.client.priceListId,
        productId: { in: products.map((p) => p.id) },
      },
      select: { productId: true, priceUSD: true },
    })
    priceOverrides = new Map(items.map((i) => [i.productId, i.priceUSD]))
  }

  const lineItems = Array.from(merged).map(([sku, qty]) => {
    const p = bySku.get(sku)!
    const priceUSD = priceOverrides.get(p.id) ?? p.priceUSD
    return {
      productId: p.id,
      quantity: qty,
      priceUSD,
      subtotalUSD: priceUSD * qty,
    }
  })
  const totalUSD = lineItems.reduce((s, x) => s + x.subtotalUSD, 0)

  // Resolver cliente: si el contacto no está vinculado, exigir nombre + teléfono
  // reales del cliente antes de crear uno nuevo.
  const wasRegisteredClient = !!contact.client
  let clientId = contact.clientId
  if (!clientId) {
    const providedName = input.customer_name?.trim() || ''
    const providedPhoneRaw = input.customer_phone?.trim() || ''
    const providedPhone = providedPhoneRaw ? normalizePhone(providedPhoneRaw) : null
    const phoneIsLid = contactPhoneIsLid(contact)

    const missing: Array<'name' | 'phone'> = []
    // Nombre: aceptamos el que el bot pase, o el push name que envía WA si es
    // razonable (más de 2 chars y no es solo un teléfono).
    const fallbackName = (ctx.contactName || contact.name || '').trim()
    const nameOk = providedName.length >= 2 || fallbackName.length >= 2
    if (!nameOk) missing.push('name')
    // Teléfono: si el phoneNumber del contacto es un LID, exigimos uno real.
    // Si NO es LID, aceptamos el que ya trae el contacto como fallback.
    if (phoneIsLid && !providedPhone) missing.push('phone')

    if (missing.length > 0) {
      const parts: string[] = []
      if (missing.includes('name')) parts.push('su nombre completo')
      if (missing.includes('phone')) parts.push('su número de teléfono real (con código de área, ej 0414... o +58414...)')
      return {
        ok: false,
        error: 'Faltan datos del cliente',
        needs_customer_info: {
          missing,
          instructions: `Antes de crear el pedido, pídele al cliente ${parts.join(' y ')}. NO llames create_order de nuevo hasta que responda con esos datos. Explícale que los necesitas para poder contactarlo y coordinar el pago y la entrega.`,
        },
      }
    }

    const finalName = providedName || fallbackName || `WhatsApp lead`
    const finalPhone = providedPhone || (phoneIsLid ? '' : ctx.contactPhone.replace(/[^0-9]/g, ''))

    const newClient = await prisma.client.create({
      data: {
        userId: ctx.userId,
        name: finalName,
        phone: finalPhone || null,
        type: 'wa_lead',
        notes: `Cliente creado automáticamente desde un pedido por WhatsApp.${phoneIsLid ? ' El identificador de WhatsApp era anónimo (LID); el teléfono lo confirmó el cliente en la conversación.' : ''}`,
      },
    })
    clientId = newClient.id
    await prisma.whatsAppContact.update({
      where: { id: contact.id },
      data: {
        clientId: newClient.id,
        // Guardar también el nombre confirmado en el contacto de WA para el inbox.
        name: contact.name || finalName,
      },
    })
  }

  // Código correlativo del pedido
  const owner = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { company: true, name: true },
  })
  const prefix = codePrefix(owner?.company, owner?.name)

  let created: { id: string; code: string | null } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextRequestCode(ctx.userId, prefix)
    try {
      created = await prisma.productRequest.create({
        data: {
          userId: ctx.userId,
          clientId,
          code,
          status: 'pending',
          notes: input.notes || 'Pedido generado por IA desde WhatsApp',
          totalUSD,
          items: { create: lineItems },
        },
        select: { id: true, code: true },
      })
      break
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Unique') || msg.includes('P2002')) continue
      throw e
    }
  }
  if (!created) return { ok: false, error: 'No se pudo generar código único' }

  // Notificar al admin
  await notify({
    userId: ctx.userId,
    type: 'new_request',
    severity: 'info',
    title: `Nuevo pedido ${created.code} generado por IA vía WhatsApp`,
    body: `${lineItems.length} ${lineItems.length === 1 ? 'producto' : 'productos'} · Total $${totalUSD.toFixed(2)} USD · ${wasRegisteredClient ? 'Cliente registrado' : 'Lead nuevo — requiere contacto de ventas'}`,
    link: `/requests/${created.id}`,
    resourceType: 'request',
    resourceId: created.id,
    dedup: false,
  }).catch((e) => console.error('[wa-bot] notify failed', e))

  const totalStr = `$${totalUSD.toFixed(2)} USD`
  if (wasRegisteredClient) {
    const base = (process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
    const link = base ? `${base}/portal/requests/${created.id}` : `/portal/requests/${created.id}`
    const message = `¡Listo! Registré tu pedido ${created.code} por ${totalStr}, en estado pendiente de pago.\n\nIngresa a tu portal para ver el detalle y registrar el pago:\n${link}`
    return { ok: true, code: created.code || undefined, message_for_customer: message }
  } else {
    const message = `¡Listo! Registré tu pedido ${created.code} por ${totalStr}, en estado pendiente de pago.\n\nComo aún no tienes cuenta en nuestro portal, un miembro de nuestro equipo de ventas te contactará muy pronto para coordinar el pago y la entrega.`
    return { ok: true, code: created.code || undefined, message_for_customer: message }
  }
}

// ---------------------------------------------------------------------------
// Bot loop
// ---------------------------------------------------------------------------

export async function generateBotReply(
  ctx: BotContext,
): Promise<{ reply: string } | { escalate: true; reason?: string } | null> {
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

  const products = await prisma.product.findMany({
    where: { userId: ctx.userId, isActive: true, stock: { gt: 0 } },
    select: { sku: true, name: true, priceUSD: true, stock: true, unit: true, category: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 30,
  })

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

  const initialUserMessage = `${clientBlock}

CATÁLOGO ACTUAL (parcial):
${catalogText}

HISTORIAL DE LA CONVERSACIÓN (más reciente al final):
${conversationText}

INSTRUCCIONES:
- Si el cliente pide precio/disponibilidad, responde directamente en español, breve, tono profesional.
- Si el cliente CONFIRMA un pedido (te dice qué productos y cantidades quiere ordenar de manera clara), usa la herramienta "create_order" para registrarlo. NO uses la herramienta hasta que el cliente haya confirmado — primero cotiza, aclara dudas y confirma.
- Datos del cliente para el pedido:
  - Si el contacto YA es cliente registrado (te lo indico arriba), no le pidas nombre ni teléfono: usa lo que tenemos.
  - Si el contacto NO es cliente registrado, ANTES de llamar create_order pídele su nombre completo y su teléfono real (04xx-xxxxxxx o +58...). El identificador que muestra WhatsApp puede ser anónimo (LID) y no sirve para llamarlo. Solo cuando te los dé, llama create_order pasando "customer_name" y "customer_phone".
- Cuando create_order devuelva "message_for_customer", envía EXACTAMENTE ese texto al cliente (puedes agregar un saludo corto, pero no cambies el código, monto ni link).
- Si create_order devuelve "needs_customer_info", NO reintentes: sigue las "instructions" que devuelve el sistema y pídele al cliente los datos que faltan en tono amable.
- Si el pedido falla por stock o SKU desconocido, informa al cliente en lenguaje natural (no menciones "SKU", di el nombre del producto).
- Si el cliente pide algo que requiere confirmación humana (descuentos especiales, entregas urgentes, cambios de política), responde con la palabra literal "ESCALATE" seguida de dos puntos y una razón corta. Ej: "ESCALATE: pide descuento no autorizado".
- No inventes precios ni stock. Si no estás seguro, ESCALATE.
- Responde SOLO con el texto que enviarías al cliente, sin metadata.`

  const messages: ClaudeMessage[] = [{ role: 'user', content: initialUserMessage }]

  try {
    // Loop de tool use — máximo 3 rondas de tools para evitar loops.
    for (let round = 0; round < 4; round++) {
      const response = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        tools: [CREATE_ORDER_TOOL],
        messages,
      })

      const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')

      if (response.stop_reason === 'tool_use' && toolUses.length > 0) {
        // Agregar la respuesta del assistant al historial
        messages.push({ role: 'assistant', content: response.content })

        // Ejecutar cada tool y armar tool_results
        const toolResults: ToolResultBlock[] = []
        for (const tu of toolUses) {
          if (tu.name === 'create_order') {
            try {
              const result = await executeCreateOrder(ctx, tu.input as OrderToolInput)
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: JSON.stringify(result),
                is_error: !result.ok,
              })
            } catch (e) {
              console.error('[wa-bot] create_order failed', e)
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: JSON.stringify({ ok: false, error: 'Error interno creando el pedido' }),
                is_error: true,
              })
            }
          } else {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify({ ok: false, error: `Tool desconocida: ${tu.name}` }),
              is_error: true,
            })
          }
        }
        messages.push({ role: 'user', content: toolResults })
        continue
      }

      // Respuesta final de texto
      const textBlock = response.content.find((b): b is TextBlock => b.type === 'text' && !!b.text)
      if (!textBlock) return null
      const text = textBlock.text.trim()
      if (text.startsWith('ESCALATE')) {
        const reason = text.replace(/^ESCALATE:?\s*/i, '').trim()
        return { escalate: true, reason: reason || undefined }
      }
      return { reply: text }
    }
    return null
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

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente virtual de ventas de una distribuidora venezolana profesional. Respondes por WhatsApp a clientes con tono cercano pero conciso. Nunca inventas información. Puedes registrar pedidos en el sistema usando la herramienta create_order cuando el cliente confirma. Cuando dudes, escalas a un humano.`
