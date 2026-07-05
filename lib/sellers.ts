/**
 * Utilidades para el feature de vendedores.
 * Centralizamos la generacion de passwords aleatorios y el helper del owner.
 */

import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

/**
 * Genera un password aleatorio legible (alfanumerico, sin caracteres ambiguos)
 * para entregarle al vendedor. Longitud 10.
 */
export function generateSellerPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

/**
 * Trae un vendedor y verifica que pertenezca al owner (para autorizar acciones
 * del admin sobre ese vendedor). Devuelve null si no existe o no le pertenece.
 */
export async function getSellerOwned(sellerId: string, ownerId: string) {
  const s = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: { user: { select: { email: true, name: true } } },
  })
  if (!s || s.ownerId !== ownerId) return null
  return s
}
