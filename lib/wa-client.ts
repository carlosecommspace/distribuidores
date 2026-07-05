/**
 * Cliente HTTP al worker de WhatsApp.
 *
 * El web (Next.js) habla con el worker por HTTP interno. Si WA_WORKER_URL
 * no está configurado, retornamos null y la UI muestra "worker no configurado".
 *
 * WA_WORKER_URL: URL base del worker (ej. http://worker.railway.internal:3001)
 * WA_WORKER_SECRET: token compartido para autenticar requests
 */

const WORKER_URL = process.env.WA_WORKER_URL
const WORKER_SECRET = process.env.WA_WORKER_SECRET

export function isWorkerConfigured(): boolean {
  return !!WORKER_URL
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: Record<string, unknown>
  timeout?: number
}

async function workerFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T | null> {
  if (!WORKER_URL) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeout || 10_000)
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}${path}`, {
      method: opts.method || 'GET',
      headers: {
        'content-type': 'application/json',
        ...(WORKER_SECRET ? { authorization: `Bearer ${WORKER_SECRET}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throw new Error(`worker ${r.status}: ${text || r.statusText}`)
    }
    if (r.status === 204) return null
    return (await r.json()) as T
  } catch (e) {
    console.error('[wa-client]', path, e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const waClient = {
  isConfigured: isWorkerConfigured,

  async connect(userId: string) {
    return workerFetch<{ ok: true; status: string }>(`/sessions/${userId}/connect`, {
      method: 'POST',
    })
  },

  async disconnect(userId: string) {
    return workerFetch<{ ok: true }>(`/sessions/${userId}/disconnect`, {
      method: 'POST',
    })
  },

  async send(userId: string, to: string, content: string) {
    return workerFetch<{ ok: true; externalId?: string }>(`/sessions/${userId}/send`, {
      method: 'POST',
      body: { to, content },
    })
  },
}
