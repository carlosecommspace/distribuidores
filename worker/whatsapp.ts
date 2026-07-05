/**
 * Worker de WhatsApp (Baileys) — proceso separado del web.
 *
 * Responsabilidades:
 * - Mantiene una sesión Baileys viva por cada WhatsAppSession con status=connected
 *   o qr_pending. Al arrancar reconecta las que estaban vivas.
 * - Expone HTTP interno para que el web pida conectar/desconectar/enviar.
 * - Al recibir mensajes: guarda en DB, crea/actualiza contacto, dispara bot IA
 *   si el toggle está activo.
 *
 * Autenticación del HTTP: Bearer WA_WORKER_SECRET.
 *
 * Env:
 *   WA_WORKER_PORT       (default 3001)
 *   WA_WORKER_SECRET     (compartido con el web)
 *   WA_ENCRYPTION_KEY    (cifra el authState en DB)
 *   DATABASE_URL         (Postgres)
 *   ANTHROPIC_API_KEY    (bot)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { PrismaClient } from '@prisma/client'
import qrcode from 'qrcode'
import pino from 'pino'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
  proto,
  type WASocket,
  type AuthenticationState,
  type AuthenticationCreds,
  initAuthCreds,
  BufferJSON,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { encryptAuthState, decryptAuthState } from '../lib/wa-crypto'

const prisma = new PrismaClient()
const log = pino({ level: 'info' }).child({ mod: 'wa-worker' })

const PORT = Number(process.env.WA_WORKER_PORT || 3001)
const SECRET = process.env.WA_WORKER_SECRET || ''

interface Session {
  userId: string
  sock: WASocket | null
  status: 'connecting' | 'qr_pending' | 'connected' | 'disconnected'
  lastQr: string | null
}
const sessions = new Map<string, Session>()

// ---------------------------------------------------------------------------
// Auth state cifrado en Postgres
// ---------------------------------------------------------------------------

/**
 * Adaptador Baileys → Postgres para el authState. Persiste todo en la fila
 * WhatsAppSession.authState (JSON cifrado). No es el más eficiente pero es
 * simple y correcto para MVP.
 */
async function loadAuthState(userId: string): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  const existing = await prisma.whatsAppSession.findUnique({ where: { userId } })
  let creds: AuthenticationCreds
  let keysStore: Record<string, Record<string, unknown>> = {}

  if (existing?.authState) {
    const decrypted = decryptAuthState<{ creds: AuthenticationCreds; keys: typeof keysStore }>(
      Buffer.from(existing.authState),
    )
    if (decrypted) {
      // Baileys usa BufferJSON.replacer/reviver para serialización
      const parsed = JSON.parse(JSON.stringify(decrypted), BufferJSON.reviver)
      creds = parsed.creds || initAuthCreds()
      keysStore = parsed.keys || {}
    } else {
      creds = initAuthCreds()
    }
  } else {
    creds = initAuthCreds()
  }

  const saveCreds = async () => {
    const serialized = JSON.parse(
      JSON.stringify({ creds, keys: keysStore }, BufferJSON.replacer),
    )
    const encrypted = encryptAuthState(serialized)
    await prisma.whatsAppSession.upsert({
      where: { userId },
      update: { authState: encrypted },
      create: { userId, authState: encrypted, status: 'connecting' },
    })
  }

  const state: AuthenticationState = {
    creds,
    keys: makeCacheableSignalKeyStore(
      {
        get: async (type, ids) => {
          const map: Record<string, unknown> = {}
          for (const id of ids) {
            const value = keysStore[type]?.[id]
            if (value) {
              map[id] = type === 'app-state-sync-key'
                ? proto.Message.AppStateSyncKeyData.fromObject(value as object)
                : value
            }
          }
          return map as never
        },
        set: async (data) => {
          for (const category in data) {
            const items = (data as Record<string, Record<string, unknown> | null>)[category]
            if (!items) continue
            keysStore[category] = keysStore[category] || {}
            for (const id in items) {
              const value = items[id]
              if (value == null) delete keysStore[category][id]
              else keysStore[category][id] = value
            }
          }
          await saveCreds()
        },
      },
      log,
    ),
  }

  return { state, saveCreds }
}

// ---------------------------------------------------------------------------
// Conexión Baileys
// ---------------------------------------------------------------------------

// Cache de la versión más reciente de WhatsApp conocida por Baileys.
// Se refresca cada 6 horas para no golpear el endpoint público en cada conexión.
let cachedVersion: [number, number, number] | null = null
let cachedVersionAt = 0
const VERSION_CACHE_MS = 6 * 60 * 60 * 1000

async function getWAVersion(): Promise<[number, number, number]> {
  const now = Date.now()
  if (cachedVersion && now - cachedVersionAt < VERSION_CACHE_MS) return cachedVersion
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    log.info({ version, isLatest }, 'fetched WhatsApp version')
    cachedVersion = version
    cachedVersionAt = now
    return version
  } catch (e) {
    log.warn({ err: e }, 'fetchLatestBaileysVersion failed, using bundled default')
    // Fallback si el endpoint público está caído — usa una versión razonable reciente
    const fallback: [number, number, number] = cachedVersion || [2, 3000, 1015901307]
    return fallback
  }
}

async function connectSession(userId: string): Promise<void> {
  const existing = sessions.get(userId)
  if (existing?.sock && existing.status !== 'disconnected') {
    log.info({ userId }, 'session already active')
    return
  }

  const version = await getWAVersion()
  const { state, saveCreds } = await loadAuthState(userId)
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: log.child({ userId }) as never,
    browser: Browsers.ubuntu('Chrome'), // identifier estandar; menos probable de ser flagged
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  })

  const sess: Session = { userId, sock, status: 'connecting', lastQr: null }
  sessions.set(userId, sess)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const dataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 300 })
      sess.lastQr = dataUrl
      sess.status = 'qr_pending'
      await prisma.whatsAppSession.update({
        where: { userId },
        data: { qrCode: dataUrl, qrGeneratedAt: new Date(), status: 'qr_pending' },
      }).catch(() => {})
    }

    if (connection === 'open') {
      sess.status = 'connected'
      sess.lastQr = null
      const me = sock.user
      await prisma.whatsAppSession.update({
        where: { userId },
        data: {
          status: 'connected',
          phoneNumber: me?.id?.split(':')[0]?.split('@')[0] || null,
          displayName: me?.name || null,
          qrCode: null,
          connectedAt: new Date(),
          lastActivity: new Date(),
          lastError: null,
        },
      }).catch(() => {})
      log.info({ userId, phone: me?.id }, 'connected')
    }

    if (connection === 'close') {
      const status = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
      const shouldReconnect = status !== DisconnectReason.loggedOut

      // Si estamos esperando escaneo del QR, NO sobreescribimos el status ni el qrCode.
      // El QR sigue siendo válido por unos segundos y el frontend lo tiene que poder mostrar.
      const wasWaitingQr = sess.status === 'qr_pending'

      sess.status = 'disconnected'
      await prisma.whatsAppSession.update({
        where: { userId },
        data: {
          // Mantén 'qr_pending' si estábamos esperando el escaneo — al reconectar en 3s
          // Baileys puede reutilizar la sesión o generar un QR nuevo.
          status: wasWaitingQr ? 'qr_pending' : (shouldReconnect ? 'connecting' : 'disconnected'),
          disconnectedAt: new Date(),
          lastError: String(lastDisconnect?.error || 'unknown'),
          ...(shouldReconnect ? {} : { authState: null, qrCode: null }),
        },
      }).catch(() => {})
      sessions.delete(userId)
      if (shouldReconnect) {
        setTimeout(() => connectSession(userId).catch((e) => log.error(e)), 3000)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return
    for (const msg of messages) {
      try {
        await handleIncomingMessage(userId, msg, sock)
      } catch (e) {
        log.error({ err: e }, 'handleIncomingMessage failed')
      }
    }
  })
}

async function disconnectSession(userId: string): Promise<void> {
  const s = sessions.get(userId)
  if (s?.sock) {
    try {
      await s.sock.logout('user disconnect')
    } catch {}
  }
  sessions.delete(userId)
  await prisma.whatsAppSession.update({
    where: { userId },
    data: { status: 'disconnected', disconnectedAt: new Date(), authState: null, qrCode: null },
  }).catch(() => {})
}

// ---------------------------------------------------------------------------
// Ingesta de mensajes entrantes
// ---------------------------------------------------------------------------

async function handleIncomingMessage(
  userId: string,
  msg: proto.IWebMessageInfo,
  sock: WASocket,
): Promise<void> {
  const jid = msg.key.remoteJid
  if (!jid || jid.includes('@g.us') || jid === 'status@broadcast') return // ignoramos grupos y estados por ahora
  if (msg.key.fromMe) return // ignoramos ecos por ahora — se registran al enviar

  const phone = jid.split('@')[0]
  const externalId = msg.key.id || undefined
  const displayName = msg.pushName || null

  const content =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ''

  const mediaType = msg.message?.imageMessage
    ? 'image'
    : msg.message?.audioMessage
    ? 'audio'
    : msg.message?.videoMessage
    ? 'video'
    : msg.message?.documentMessage
    ? 'document'
    : msg.message?.stickerMessage
    ? 'sticker'
    : null

  // Buscar cliente por teléfono (heurística simple: los últimos 10 dígitos)
  const tail = phone.slice(-10)
  const matchedClient = tail
    ? await prisma.client.findFirst({
        where: { userId, phone: { contains: tail } },
        select: { id: true },
      })
    : null

  const contact = await prisma.whatsAppContact.upsert({
    where: { userId_phoneNumber: { userId, phoneNumber: phone } },
    update: {
      name: displayName || undefined,
      lastMessageAt: new Date(),
      lastMessagePreview: content.slice(0, 100),
      lastDirection: 'in',
      unreadCount: { increment: 1 },
      ...(matchedClient ? { clientId: matchedClient.id } : {}),
    },
    create: {
      userId,
      phoneNumber: phone,
      name: displayName,
      lastMessageAt: new Date(),
      lastMessagePreview: content.slice(0, 100),
      lastDirection: 'in',
      unreadCount: 1,
      clientId: matchedClient?.id,
    },
  })

  await prisma.whatsAppMessage.create({
    data: {
      userId,
      contactId: contact.id,
      externalId,
      direction: 'in',
      content: content || (mediaType ? `[${mediaType}]` : ''),
      mediaType,
      status: 'delivered',
    },
  }).catch((e) => {
    // dedup por externalId es esperado
    if (!String(e?.message || '').includes('Unique')) throw e
  })

  await prisma.whatsAppSession.update({
    where: { userId },
    data: { lastActivity: new Date() },
  }).catch(() => {})

  // Bot IA — sólo si toggle está activo
  const settings = await prisma.settings.findUnique({
    where: { userId },
    select: { waAiEnabled: true },
  })
  const shouldTriggerBot = contact.aiEnabled || (settings?.waAiEnabled && contact.aiEnabled)
  if (!shouldTriggerBot || !content) return

  try {
    const { generateBotReply } = await import('../lib/wa-bot')
    const result = await generateBotReply({
      userId,
      contactId: contact.id,
      contactPhone: phone,
      contactName: displayName,
    })
    if (result && 'reply' in result && result.reply) {
      await sock.sendMessage(jid, { text: result.reply })
      await prisma.whatsAppMessage.create({
        data: {
          userId,
          contactId: contact.id,
          direction: 'out',
          content: result.reply,
          status: 'sent',
          respondedByBot: true,
        },
      })
      await prisma.whatsAppContact.update({
        where: { id: contact.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: result.reply.slice(0, 100), lastDirection: 'out' },
      })
    } else if (result && 'escalate' in result) {
      // Notificar al admin que un chat necesita atención
      const { notify } = await import('../lib/notifications')
      await notify({
        userId,
        type: 'wa_escalation',
        severity: 'warning',
        title: `Chat con ${displayName || phone} requiere tu atención`,
        body: result.reason || 'El bot no pudo responder con confianza.',
        link: `/whatsapp/inbox?contact=${contact.id}`,
        resourceType: 'wa_contact',
        resourceId: contact.id,
      })
    }
  } catch (e) {
    log.error({ err: e }, 'bot reply failed')
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function auth(req: IncomingMessage): boolean {
  if (!SECRET) return true // permitido en dev sin secret
  const h = req.headers.authorization || ''
  return h === `Bearer ${SECRET}`
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  if (!auth(req)) return send(res, 401, { error: 'unauthorized' })

  const url = new URL(req.url || '/', `http://localhost`)
  const segments = url.pathname.split('/').filter(Boolean)

  // Health check
  if (segments[0] === 'health') return send(res, 200, { ok: true, sessions: sessions.size })

  // /sessions/:userId/{connect|disconnect|send}
  if (segments[0] === 'sessions' && segments[1]) {
    const userId = segments[1]
    const action = segments[2]

    if (action === 'connect' && req.method === 'POST') {
      connectSession(userId).catch((e) => log.error(e))
      return send(res, 202, { ok: true, status: 'connecting' })
    }
    if (action === 'disconnect' && req.method === 'POST') {
      await disconnectSession(userId)
      return send(res, 200, { ok: true })
    }
    if (action === 'send' && req.method === 'POST') {
      let body: { to?: string; content?: string } = {}
      try {
        const raw = await new Promise<string>((resolve) => {
          let d = ''
          req.on('data', (c) => (d += c))
          req.on('end', () => resolve(d))
        })
        body = JSON.parse(raw)
      } catch {}
      const { to, content } = body
      if (!to || !content) return send(res, 400, { error: 'to and content required' })
      const sess = sessions.get(userId)
      if (!sess?.sock || sess.status !== 'connected') {
        return send(res, 400, { error: 'session not connected' })
      }
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
      const sent = await sess.sock.sendMessage(jid, { text: content })
      return send(res, 200, { ok: true, externalId: sent?.key?.id || null })
    }
  }

  send(res, 404, { error: 'not found' })
})

// ---------------------------------------------------------------------------
// Restaurar sesiones al arrancar
// ---------------------------------------------------------------------------

async function restore(): Promise<void> {
  const list = await prisma.whatsAppSession.findMany({
    where: { status: { in: ['connected', 'qr_pending', 'connecting'] } },
    select: { userId: true },
  })
  log.info({ count: list.length }, 'restoring sessions')
  for (const { userId } of list) {
    connectSession(userId).catch((e) => log.error({ userId, err: e }, 'restore failed'))
  }
}

server.listen(PORT, () => {
  log.info({ port: PORT }, 'wa worker listening')
  restore().catch((e) => log.error(e))
})

process.on('SIGTERM', async () => {
  log.info('SIGTERM received')
  for (const [userId, s] of sessions) {
    try { await s.sock?.end(undefined) } catch {}
    log.info({ userId }, 'closed')
  }
  await prisma.$disconnect()
  process.exit(0)
})
