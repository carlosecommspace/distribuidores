import { prisma } from './prisma'

export type NotificationSeverity = 'info' | 'warning' | 'danger' | 'success'

interface NotifyInput {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  severity?: NotificationSeverity
  resourceType?: string
  resourceId?: string
  /**
   * Si es true, no crea una nueva si ya existe una NO leída del mismo
   * (userId, type, resourceType, resourceId). Default: true.
   */
  dedup?: boolean
}

export async function notify(input: NotifyInput): Promise<{ created: boolean }> {
  const dedup = input.dedup ?? true
  if (dedup && input.resourceType && input.resourceId) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        read: false,
      },
      select: { id: true },
    })
    if (existing) return { created: false }
  }
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      severity: input.severity || 'info',
      title: input.title,
      body: input.body || null,
      link: input.link || null,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
    },
  })
  return { created: true }
}

/**
 * Crea notificación de stock bajo si:
 * - El usuario tiene notifLowStock activado en settings (o no tiene settings — default true)
 * - El stock actual es <= stockMin Y > 0 (warning), o == 0 (danger)
 *
 * Idempotente por producto: dedup mientras haya una sin leer abierta.
 */
export async function checkLowStock(userId: string, productId: string): Promise<void> {
  const [product, settings] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, userId, isActive: true },
      select: { id: true, name: true, sku: true, stock: true, stockMin: true, unit: true },
    }),
    prisma.settings.findUnique({ where: { userId }, select: { notifLowStock: true } }),
  ])
  if (!product) return
  if (settings && settings.notifLowStock === false) return

  const { stock, stockMin } = product
  if (stock > stockMin) return // sano

  const isOutOfStock = stock <= 0
  await notify({
    userId,
    type: 'low_stock',
    severity: isOutOfStock ? 'danger' : 'warning',
    title: isOutOfStock
      ? `${product.name} se quedó sin stock`
      : `${product.name} está bajo el mínimo`,
    body: isOutOfStock
      ? `SKU ${product.sku} · 0 ${product.unit} disponibles (mínimo ${stockMin})`
      : `SKU ${product.sku} · ${stock} ${product.unit} de ${stockMin} mínimos`,
    link: `/inventory/${product.id}`,
    resourceType: 'product',
    resourceId: product.id,
  })
}

/**
 * Si el producto ya tiene stock > stockMin, marca como leídas las notificaciones
 * abiertas de stock bajo para ese producto (auto-resolución cuando reponen).
 */
export async function resolveLowStockIfHealthy(userId: string, productId: string): Promise<void> {
  const p = await prisma.product.findFirst({
    where: { id: productId, userId },
    select: { stock: true, stockMin: true },
  })
  if (!p || p.stock <= p.stockMin) return
  await prisma.notification.updateMany({
    where: {
      userId,
      type: 'low_stock',
      resourceType: 'product',
      resourceId: productId,
      read: false,
    },
    data: { read: true, readAt: new Date() },
  })
}
