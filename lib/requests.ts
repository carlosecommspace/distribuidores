import { prisma } from './prisma'

export type RequestStatus = 'pending' | 'partially_paid' | 'paid' | 'released' | 'cancelled'

/**
 * Recalcula paidUSD y status a partir de los pagos verificados.
 * Si el pedido ya está 'released' o 'cancelled', no toca el estado.
 */
export async function refreshRequestStatus(requestId: string): Promise<{
  paidUSD: number
  totalUSD: number
  status: RequestStatus
  outstanding: number
}> {
  const request = await prisma.productRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, totalUSD: true },
  })
  if (!request) throw new Error('request not found')

  const sum = await prisma.payment.aggregate({
    where: { requestId, status: 'verified' },
    _sum: { amountUSD: true },
  })
  const paidUSD = sum._sum.amountUSD || 0
  const outstanding = Math.max(0, request.totalUSD - paidUSD)

  let nextStatus = request.status as RequestStatus
  if (request.status !== 'released' && request.status !== 'cancelled') {
    if (paidUSD <= 0) nextStatus = 'pending'
    else if (paidUSD < request.totalUSD - 0.0001) nextStatus = 'partially_paid'
    else nextStatus = 'paid'
  }

  await prisma.productRequest.update({
    where: { id: requestId },
    data: { paidUSD, status: nextStatus },
  })
  return { paidUSD, totalUSD: request.totalUSD, status: nextStatus, outstanding }
}
