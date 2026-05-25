import { auth } from './auth'
import { prisma } from './prisma'

export async function requireClientSession() {
  const session = await auth()
  if (!session?.user) return null
  const su = session.user as { id?: string; role?: string; clientId?: string }
  if (su.role !== 'client' || !su.clientId || !su.id) return null
  const client = await prisma.client.findUnique({
    where: { id: su.clientId },
    include: { priceList: true, user: { select: { id: true, name: true } } },
  })
  if (!client) return null
  return { userId: su.id, clientId: client.id, client, ownerId: client.userId }
}
