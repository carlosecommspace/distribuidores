import { prisma } from './prisma'

export type RequestStatus = 'pending' | 'partially_paid' | 'paid' | 'released' | 'cancelled'

/**
 * Deriva el prefijo del código a partir del nombre de la empresa del tenant.
 * Toma los primeros 3 caracteres alfanuméricos y los normaliza a mayúsculas.
 * Fallback: 'PED'.
 */
export function codePrefix(company?: string | null, name?: string | null): string {
  const source = (company || name || '').toUpperCase()
  const letters = source.normalize('NFD').replace(/[^A-Z0-9]/g, '')
  if (letters.length >= 3) return letters.slice(0, 3)
  if (letters.length > 0) return letters.padEnd(3, 'X')
  return 'PED'
}

/**
 * Calcula el siguiente código correlativo para un tenant.
 * Ej: DIS-001 → DIS-002 → ...
 */
export async function nextRequestCode(userId: string, prefix: string): Promise<string> {
  const rows = await prisma.productRequest.findMany({
    where: { userId, code: { startsWith: `${prefix}-` } },
    select: { code: true },
  })
  const maxNum = rows.reduce((m, r) => {
    const n = parseInt((r.code || '').split('-')[1] || '0', 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`
}

/**
 * Crea un ProductRequest con código correlativo, reintentando si hay colisión
 * de unicidad por concurrencia. Devuelve el request creado.
 */
export async function createRequestWithCode<TData extends { userId: string }>(
  data: TData,
  companyName: string | null | undefined,
  companyFallback: string | null | undefined,
  createFn: (payload: TData & { code: string }) => Promise<unknown>,
): Promise<{ code: string }> {
  const prefix = codePrefix(companyName, companyFallback)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextRequestCode(data.userId, prefix)
    try {
      await createFn({ ...data, code })
      return { code }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Unique') || msg.includes('P2002')) continue
      throw e
    }
  }
  throw new Error('No se pudo generar código único después de varios intentos')
}

/**
 * Recalcula paidUSD y status a partir de los pagos verificados.
 * Considera el descuento aplicado por el admin: el "total efectivo" a pagar es
 * (totalUSD - discountUSD).
 * Si el pedido ya está 'released' o 'cancelled', no toca el estado.
 */
export async function refreshRequestStatus(requestId: string): Promise<{
  paidUSD: number
  totalUSD: number
  discountUSD: number
  effectiveTotalUSD: number
  status: RequestStatus
  outstanding: number
}> {
  const request = await prisma.productRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, totalUSD: true, discountUSD: true },
  })
  if (!request) throw new Error('request not found')

  const sum = await prisma.payment.aggregate({
    where: { requestId, status: 'verified' },
    _sum: { amountUSD: true },
  })
  const paidUSD = sum._sum.amountUSD || 0
  const effectiveTotalUSD = Math.max(0, request.totalUSD - request.discountUSD)
  const outstanding = Math.max(0, effectiveTotalUSD - paidUSD)

  let nextStatus = request.status as RequestStatus
  if (request.status !== 'released' && request.status !== 'cancelled') {
    if (paidUSD <= 0) nextStatus = 'pending'
    else if (paidUSD < effectiveTotalUSD - 0.0001) nextStatus = 'partially_paid'
    else nextStatus = 'paid'
  }

  await prisma.productRequest.update({
    where: { id: requestId },
    data: { paidUSD, status: nextStatus },
  })
  return {
    paidUSD,
    totalUSD: request.totalUSD,
    discountUSD: request.discountUSD,
    effectiveTotalUSD,
    status: nextStatus,
    outstanding,
  }
}
