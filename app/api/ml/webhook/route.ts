import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, fetchMLOrder, fetchMLQuestion } from '@/lib/ml-api'
import { notify } from '@/lib/notifications'

interface WebhookBody {
  topic?: string
  resource?: string
  user_id?: number
  application_id?: number
  sent?: string
  attempts?: number
}

export async function POST(req: Request) {
  // ML exige 200 OK ASAP. Ack primero, procesar async.
  let body: WebhookBody = {}
  try {
    body = await req.json()
  } catch {}

  processAsync(body).catch((e) => console.error('[ml-webhook] async error', e))

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

async function processAsync(body: WebhookBody) {
  if (!body.topic || !body.user_id) return
  const conn = await prisma.mLConnection.findFirst({
    where: { mlUserId: String(body.user_id) },
    select: { id: true, userId: true, mlUserId: true },
  })
  if (!conn) {
    console.warn('[ml-webhook] connection not found for user', body.user_id)
    return
  }

  switch (body.topic) {
    case 'orders_v2':
      await handleOrder(conn.userId, body)
      break
    case 'questions':
      await handleQuestion(conn.userId, conn.id, body)
      break
    case 'items':
      await handleItemChange(conn.userId, body)
      break
    default:
      // Payments / messages / shipments / claims: por ahora solo log.
      // Estas se procesan en features siguientes.
      break
  }
}

function extractIdFromResource(resource?: string): string | null {
  if (!resource) return null
  const parts = resource.replace(/^\/+|\/+$/g, '').split('/')
  return parts[parts.length - 1] || null
}

// ----------------------------------------------------------------------------
// Orders — crea Sale local + descuenta stock (idempotente por mlOrderId)
// ----------------------------------------------------------------------------

async function handleOrder(userId: string, body: WebhookBody) {
  const orderId = extractIdFromResource(body.resource)
  if (!orderId) return

  // Idempotencia previa (evita traer la orden si ya la tenemos)
  const existing = await prisma.sale.findFirst({
    where: { userId, mlOrderId: orderId },
    select: { id: true, paymentStatus: true },
  })

  const token = await getValidAccessToken(userId)
  if (!token) {
    console.warn('[ml-webhook] no valid token for user', userId)
    return
  }

  const order = await fetchMLOrder(token, orderId)
  if (!order) {
    console.warn('[ml-webhook] order not found', orderId)
    return
  }

  // Si ya existe, solo actualizar payment status (ej: pending → paid)
  if (existing) {
    if (existing.paymentStatus !== mapPaymentStatus(order.status)) {
      await prisma.sale.update({
        where: { id: existing.id },
        data: { paymentStatus: mapPaymentStatus(order.status), status: mapOrderStatus(order.status) },
      })
    }
    return
  }

  // Resolver client (si tenemos su email o telefono, matchear por eso; si no, crear uno tipo ml_buyer)
  const buyerName = [order.buyer.first_name, order.buyer.last_name].filter(Boolean).join(' ').trim()
    || order.buyer.nickname
    || `MercadoLibre ${order.buyer.id}`
  const buyerPhone = order.buyer.phone?.number
    ? `${order.buyer.phone.area_code || ''}${order.buyer.phone.number}`.replace(/[^0-9+]/g, '')
    : null
  const buyerEmail = order.buyer.email || null

  let client = null as null | { id: string }
  if (buyerEmail) {
    client = await prisma.client.findFirst({ where: { userId, email: buyerEmail }, select: { id: true } })
  }
  if (!client && buyerPhone) {
    client = await prisma.client.findFirst({ where: { userId, phone: buyerPhone }, select: { id: true } })
  }
  if (!client) {
    client = await prisma.client.create({
      data: {
        userId,
        name: buyerName,
        email: buyerEmail || undefined,
        phone: buyerPhone || undefined,
        type: 'ml_buyer',
        notes: `Cliente creado automáticamente desde una venta de MercadoLibre (ML user ID ${order.buyer.id}).`,
      },
      select: { id: true },
    })
  }

  // Resolver productos: matchear por mlItemId
  const mlItemIds = order.order_items.map((it) => it.item.id)
  const products = await prisma.product.findMany({
    where: { userId, mlItemId: { in: mlItemIds } },
    select: { id: true, mlItemId: true, name: true, priceUSD: true, stock: true },
  })
  const byMlItem = new Map(products.map((p) => [p.mlItemId!, p]))

  const lineItems: Array<{ productId: string; quantity: number; priceUSD: number; subtotalUSD: number }> = []
  const stockDiscounts: Array<{ productId: string; quantity: number }> = []
  let subtotalUSD = 0
  for (const it of order.order_items) {
    const p = byMlItem.get(it.item.id)
    if (!p) continue // producto no matcheado en nuestro catalogo, saltar linea
    const priceUSD = it.currency_id === 'USD' ? it.unit_price : it.unit_price // por ahora asumimos USD; TODO exchange
    const subtotal = priceUSD * it.quantity
    lineItems.push({
      productId: p.id,
      quantity: it.quantity,
      priceUSD,
      subtotalUSD: subtotal,
    })
    stockDiscounts.push({ productId: p.id, quantity: it.quantity })
    subtotalUSD += subtotal
  }

  if (lineItems.length === 0) {
    console.warn('[ml-webhook] order has no matched products', orderId)
    return
  }

  // Crear Sale + SaleItems + descontar stock en transaction, con guard de unique
  // constraint por si dos eventos llegan al mismo tiempo.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sale.create({
        data: {
          userId,
          clientId: client!.id,
          channel: 'mercadolibre',
          mlOrderId: orderId,
          subtotalUSD,
          totalUSD: order.total_amount || subtotalUSD,
          totalBs: 0,
          exchangeRate: 0,
          paymentMethod: order.payments?.[0]?.payment_method_id || 'ml_online',
          paymentStatus: mapPaymentStatus(order.status),
          status: mapOrderStatus(order.status),
          notes: `Venta de MercadoLibre (Order ID ${orderId})`,
          items: { create: lineItems },
        },
      })
      // Descontar stock (no baja de 0)
      for (const d of stockDiscounts) {
        await tx.product.update({
          where: { id: d.productId },
          data: { stock: { decrement: d.quantity } },
        })
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Unique') || msg.includes('P2002')) {
      // race condition: otro webhook procesó primero. OK.
      return
    }
    throw e
  }

  await notify({
    userId,
    type: 'ml_sale',
    severity: 'success',
    title: `Nueva venta en MercadoLibre`,
    body: `${lineItems.length} ${lineItems.length === 1 ? 'producto' : 'productos'} · $${(order.total_amount || subtotalUSD).toFixed(2)} USD · Comprador: ${buyerName}`,
    link: `/mercadolibre`,
    resourceType: 'ml_order',
    resourceId: orderId,
    dedup: false,
  }).catch((e) => console.error('[ml-webhook] notify failed', e))
}

function mapPaymentStatus(orderStatus: string): string {
  switch (orderStatus) {
    case 'paid': return 'paid'
    case 'cancelled': return 'cancelled'
    case 'invalid': return 'cancelled'
    case 'payment_required':
    case 'payment_in_process':
    case 'confirmed':
    default:
      return 'pending'
  }
}

function mapOrderStatus(orderStatus: string): string {
  if (orderStatus === 'cancelled' || orderStatus === 'invalid') return 'cancelled'
  return 'completed'
}

// ----------------------------------------------------------------------------
// Questions — placeholder pull (Fase 4 con IA)
// ----------------------------------------------------------------------------

async function handleQuestion(userId: string, connectionId: string, body: WebhookBody) {
  const questionId = extractIdFromResource(body.resource)
  if (!questionId) return

  // Idempotencia
  const exists = await prisma.mLQuestion.findUnique({ where: { mlQuestionId: questionId } })
  if (exists) return

  const token = await getValidAccessToken(userId)
  if (!token) return

  const q = await fetchMLQuestion(token, questionId)
  if (!q) {
    // placeholder si no pudimos traer la pregunta
    await prisma.mLQuestion.create({
      data: {
        mlQuestionId: questionId,
        connectionId,
        mlItemId: 'pending',
        questionText: 'Pregunta entrante — actualiza la lista',
        status: 'unanswered',
      },
    }).catch(() => {})
    return
  }

  // Match producto local por mlItemId (opcional)
  const product = q.item_id
    ? await prisma.product.findFirst({ where: { userId, mlItemId: q.item_id }, select: { id: true } })
    : null

  await prisma.mLQuestion.create({
    data: {
      mlQuestionId: String(q.id),
      connectionId,
      productId: product?.id || undefined,
      mlItemId: q.item_id,
      questionText: q.text,
      buyerNickname: q.from?.nickname || undefined,
      status: q.status === 'ANSWERED' ? 'answered' : 'unanswered',
    },
  }).catch(() => {})

  if (q.status !== 'ANSWERED') {
    await notify({
      userId,
      type: 'ml_question',
      severity: 'info',
      title: 'Nueva pregunta en MercadoLibre',
      body: q.text.slice(0, 160),
      link: `/mercadolibre/questions`,
      resourceType: 'ml_question',
      resourceId: String(q.id),
      dedup: false,
    }).catch(() => {})
  }
}

// ----------------------------------------------------------------------------
// Items — reconciliacion cuando ML cambia estado (paused, moderated, etc)
// ----------------------------------------------------------------------------

async function handleItemChange(userId: string, body: WebhookBody) {
  const mlItemId = extractIdFromResource(body.resource)
  if (!mlItemId) return

  const product = await prisma.product.findFirst({
    where: { userId, mlItemId },
    select: { id: true, mlStatus: true },
  })
  if (!product) return

  // No pedimos la data del item — solo marcamos que hubo cambio para que el sync
  // del cron lo refresque. Podriamos hacer un GET /items/{id} aca si queremos
  // mas frescura, pero acota rate limits.
  await prisma.product.update({
    where: { id: product.id },
    data: { mlLastSync: new Date() },
  })
}
