import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

/**
 * Cifrado AES-256-GCM del authState de WhatsApp.
 *
 * Formato del buffer resultante:  [ iv(12) | tag(16) | ciphertext ]
 *
 * La clave viene de env WA_ENCRYPTION_KEY (hex 64 chars = 32 bytes).
 * Si la env está vacía o inválida, se usa una clave derivada de NEXTAUTH_SECRET
 * como fallback — no ideal, pero evita crashes en dev.
 */

function getKey(): Buffer {
  const envKey = process.env.WA_ENCRYPTION_KEY?.trim()
  if (envKey && /^[0-9a-fA-F]{64}$/.test(envKey)) {
    return Buffer.from(envKey, 'hex')
  }
  const fallback = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'insecure-dev-key'
  // Derivamos 32 bytes de forma determinística. NO usar en producción.
  return createHash('sha256').update(fallback).digest()
}

export function encryptAuthState(state: unknown): Buffer {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const json = Buffer.from(JSON.stringify(state), 'utf8')
  const enc = Buffer.concat([cipher.update(json), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

export function decryptAuthState<T = unknown>(buf: Buffer | Uint8Array): T | null {
  try {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
    if (b.length < 12 + 16 + 1) return null
    const iv = b.subarray(0, 12)
    const tag = b.subarray(12, 28)
    const ciphertext = b.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(dec.toString('utf8')) as T
  } catch {
    return null
  }
}
