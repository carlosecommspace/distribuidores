'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Switch } from '@/components/ui/Switch'
import { toast } from '@/components/ui/Toast'
import { formatRelative, cn } from '@/lib/utils'
import { ArrowLeft, Send, Search, MessageCircle, Bot, Sparkles, MessageSquareQuote, X } from 'lucide-react'

interface ContactPreview {
  id: string
  phoneNumber: string
  name: string | null
  unreadCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastDirection: string | null
  aiEnabled: boolean
  client?: { id: string; name: string; company?: string | null } | null
}

interface WAMessage {
  id: string
  direction: 'in' | 'out'
  content: string
  mediaType?: string | null
  status: string
  respondedByBot: boolean
  createdAt: string
}

interface ContactDetail extends ContactPreview {
  messages: WAMessage[]
}

interface FaqReply {
  id: string
  trigger: string
  reply: string
}

export default function InboxPage() {
  const searchParams = useSearchParams()
  const initialContactId = searchParams.get('contact')

  const [contacts, setContacts] = useState<ContactPreview[]>([])
  const [selected, setSelected] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalAi, setGlobalAi] = useState<boolean>(false)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [faqs, setFaqs] = useState<FaqReply[]>([])
  const [faqOpen, setFaqOpen] = useState(false)
  const [faqQuery, setFaqQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadContacts = async () => {
    const r = await fetch('/api/whatsapp/conversations')
    if (r.ok) setContacts(await r.json())
    setLoading(false)
  }

  const loadContact = async (id: string) => {
    const r = await fetch(`/api/whatsapp/conversations/${id}`)
    if (r.ok) {
      const d = await r.json()
      setSelected(d)
      // Marcar como leído
      fetch(`/api/whatsapp/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markRead: true }),
      }).then(() => loadContacts())
    }
  }

  useEffect(() => {
    loadContacts()
    // Cargar toggle global de IA
    fetch('/api/settings').then((r) => r.json()).then((d) => {
      setGlobalAi(!!d?.settings?.waAiEnabled)
    }).catch(() => {})
    fetch('/api/whatsapp/replies').then((r) => r.json()).then((d) => {
      setFaqs(d?.replies || [])
    }).catch(() => {})
    const t = setInterval(loadContacts, 8000)
    return () => clearInterval(t)
  }, [])

  const toggleGlobalAi = async (v: boolean) => {
    setGlobalAi(v)
    const r = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: { waAiEnabled: v } }),
    })
    if (!r.ok) {
      toast.error('No se pudo guardar el ajuste')
      setGlobalAi(!v)
      return
    }
    toast.success(v ? 'IA activada para TODOS los chats' : 'IA global desactivada')
  }

  useEffect(() => {
    if (initialContactId) loadContact(initialContactId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContactId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [selected?.messages.length])

  // Poll mensajes del chat abierto
  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => loadContact(selected.id), 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  const filtered = contacts.filter((c) => {
    if (!q) return true
    const s = q.toLowerCase()
    return (
      c.phoneNumber.includes(s) ||
      c.name?.toLowerCase().includes(s) ||
      c.client?.name?.toLowerCase().includes(s)
    )
  })

  const toggleAi = async (v: boolean) => {
    if (!selected) return
    setSelected({ ...selected, aiEnabled: v })
    await fetch(`/api/whatsapp/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aiEnabled: v }),
    })
    toast.success(v ? 'IA activada para este chat' : 'IA desactivada')
    loadContacts()
  }

  const insertFaq = (reply: string) => {
    setDraft((d) => (d.trim() ? `${d}\n${reply}` : reply))
    setFaqOpen(false)
    setFaqQuery('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const sendFaq = async (reply: string) => {
    if (!selected) return
    setFaqOpen(false)
    setFaqQuery('')
    setSending(true)
    const r = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contactId: selected.id, content: reply }),
    })
    setSending(false)
    if (!r.ok) {
      toast.error('Error enviando')
      return
    }
    loadContact(selected.id)
  }

  const filteredFaqs = faqs.filter((f) => {
    if (!faqQuery.trim()) return true
    const s = faqQuery.toLowerCase()
    return f.trigger.toLowerCase().includes(s) || f.reply.toLowerCase().includes(s)
  })

  const send = async () => {
    if (!selected || !draft.trim()) return
    setSending(true)
    const r = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contactId: selected.id, content: draft }),
    })
    setSending(false)
    if (!r.ok) {
      toast.error('Error enviando')
      return
    }
    setDraft('')
    loadContact(selected.id)
  }

  return (
    <div>
      <Link href="/whatsapp" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-3">
        <ArrowLeft size={14} /> WhatsApp
      </Link>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="font-display text-xl md:text-2xl font-bold text-text-primary">Bandeja de entrada</h1>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-1.5">
          <Bot size={14} className={globalAi ? 'text-accent' : 'text-text-muted'} />
          <Switch checked={globalAi} onCheckedChange={toggleGlobalAi} label="IA global" />
        </div>
      </div>

      {globalAi && (
        <div className="bg-accent-subtle border border-accent-border rounded-md p-3 mb-4 text-sm flex items-start gap-2">
          <Bot size={16} className="text-accent flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-accent font-medium">Modo IA global activo</div>
            <div className="text-xs text-text-secondary mt-0.5">
              La IA responde automáticamente a todos los mensajes entrantes. Puedes desactivarla arriba para volver al control por conversación.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-3 md:gap-4 min-h-[600px]">
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                className="input-base pl-9 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<MessageCircle size={28} />}
                title="Sin conversaciones"
                description="Cuando alguien te escriba por WhatsApp aparecerá aquí."
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => loadContact(c.id)}
                      className={cn(
                        'w-full text-left p-3 hover:bg-surface-2 flex items-start gap-2',
                        selected?.id === c.id && 'bg-surface-2 border-l-2 border-l-accent',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-sm text-text-primary truncate">
                            {c.client?.name || c.name || `+${c.phoneNumber}`}
                          </span>
                          {c.lastMessageAt && (
                            <span className="text-[10px] text-text-muted flex-shrink-0">
                              {formatRelative(c.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-text-muted truncate flex-1">
                            {c.lastDirection === 'out' && '→ '}
                            {c.lastMessagePreview || '—'}
                          </div>
                          {c.unreadCount > 0 && (
                            <span className="bg-accent text-black text-[10px] font-mono font-semibold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center flex-shrink-0">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        {c.aiEnabled && (
                          <Badge tone="info" className="mt-1"><Bot size={9} /> IA activa</Badge>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          {!selected ? (
            <EmptyState
              icon={<MessageCircle size={32} />}
              title="Selecciona una conversación"
              description="Elige un contacto para ver el hilo y responder."
            />
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {selected.client?.name || selected.name || `+${selected.phoneNumber}`}
                  </div>
                  <div className="text-xs text-text-muted font-mono">+{selected.phoneNumber}</div>
                  {selected.client && (
                    <Link href={`/clients/${selected.client.id}`} className="text-xs text-accent hover:underline">
                      Ver ficha del cliente →
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Sparkles size={12} className="text-text-muted" />
                  <Switch checked={selected.aiEnabled} onCheckedChange={toggleAi} label="IA" />
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-bg">
                {selected.messages.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-8">Sin mensajes en el historial retenido.</div>
                ) : (
                  selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                        m.direction === 'in'
                          ? 'bg-surface self-start border border-border'
                          : 'bg-accent-subtle border border-accent-border self-end',
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.content || <em className="text-text-muted">[{m.mediaType || 'sin texto'}]</em>}</div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                        {m.respondedByBot && <Bot size={10} className="text-info" />}
                        <span>{formatRelative(m.createdAt)}</span>
                        {m.direction === 'out' && <span>· {m.status}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-border">
                {faqOpen && (
                  <div className="mb-2 border border-border rounded-md bg-surface-2 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary">
                        <MessageSquareQuote size={12} /> Respuestas rápidas
                      </div>
                      <button
                        onClick={() => setFaqOpen(false)}
                        className="text-text-muted hover:text-text-primary"
                        aria-label="Cerrar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          autoFocus
                          value={faqQuery}
                          onChange={(e) => setFaqQuery(e.target.value)}
                          placeholder="Buscar por trigger o texto..."
                          className="input-base pl-7 text-xs py-1.5"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredFaqs.length === 0 ? (
                        <div className="text-xs text-text-muted text-center py-6 px-3">
                          {faqs.length === 0 ? (
                            <>
                              No hay respuestas rápidas configuradas.{' '}
                              <Link href="/whatsapp" className="text-accent hover:underline">Crearlas →</Link>
                            </>
                          ) : (
                            'Sin coincidencias'
                          )}
                        </div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {filteredFaqs.map((f) => (
                            <li key={f.id} className="p-2 hover:bg-surface flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-text-primary truncate">{f.trigger}</div>
                                <div className="text-xs text-text-muted line-clamp-2 whitespace-pre-wrap">{f.reply}</div>
                              </div>
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <button
                                  onClick={() => insertFaq(f.reply)}
                                  className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-surface-2 text-text-secondary"
                                  title="Insertar en el borrador"
                                >
                                  Insertar
                                </button>
                                <button
                                  onClick={() => sendFaq(f.reply)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-accent text-black font-medium"
                                  title="Enviar tal cual"
                                >
                                  Enviar
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setFaqOpen((v) => !v)}
                    className={cn(
                      'p-2 rounded-md border border-border hover:bg-surface-2 text-text-secondary',
                      faqOpen && 'bg-accent-subtle border-accent-border text-accent',
                    )}
                    title="Insertar respuesta rápida"
                    aria-label="Insertar respuesta rápida"
                  >
                    <MessageSquareQuote size={14} />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    className="input-base flex-1 resize-none min-h-[40px] max-h-[120px]"
                    rows={1}
                  />
                  <Button loading={sending} onClick={send} disabled={!draft.trim()}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
