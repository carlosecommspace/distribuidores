'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Bell, Check, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  severity: 'info' | 'warning' | 'danger' | 'success'
  title: string
  body?: string | null
  link?: string | null
  read: boolean
  createdAt: string
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/notifications?take=20')
      const d = await r.json()
      setItems(d.items || [])
      setUnread(d.unreadCount || 0)
    } catch {}
    setLoading(false)
  }

  // Poll unread count cada 30s
  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markRead = async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)))
    setUnread((c) => Math.max(0, c - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })))
    setUnread(0)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allRead: true }),
    }).catch(() => {})
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        className="text-text-secondary hover:text-text-primary p-1.5 rounded-md hover:bg-surface-2 relative"
        aria-label="Notificaciones"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-black text-[10px] font-mono font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-display text-sm font-semibold">Notificaciones</div>
              <div className="text-xs text-text-muted">
                {unread > 0 ? `${unread} sin leer` : 'Todo al día'}
              </div>
            </div>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                <Check size={12} /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-text-muted mb-2 inline-flex"><Bell size={24} /></div>
                <div className="text-sm text-text-secondary">No hay notificaciones</div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => <NotificationRow key={n.id} n={n} onRead={markRead} onClose={() => setOpen(false)} />)}
              </ul>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-border text-center">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-accent hover:underline">
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({ n, onRead, onClose }: { n: Notification; onRead: (id: string) => void; onClose: () => void }) {
  const Icon =
    n.severity === 'danger' ? AlertCircle :
    n.severity === 'warning' ? AlertTriangle :
    n.severity === 'success' ? CheckCircle2 : Info
  const color =
    n.severity === 'danger' ? 'text-danger' :
    n.severity === 'warning' ? 'text-warning' :
    n.severity === 'success' ? 'text-success' : 'text-info'

  const handleClick = () => {
    if (!n.read) onRead(n.id)
    onClose()
  }

  const content = (
    <div className={cn('px-4 py-3 flex gap-2.5 hover:bg-surface-2/60 cursor-pointer', !n.read && 'bg-accent-subtle/30')}>
      <div className={cn('mt-0.5 flex-shrink-0', color)}><Icon size={14} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{n.title}</div>
        {n.body && <div className="text-xs text-text-muted truncate">{n.body}</div>}
        <div className="text-[10px] text-text-muted mt-1">{formatRelative(n.createdAt)}</div>
      </div>
      {!n.read && <span className="h-2 w-2 rounded-full bg-accent mt-2 flex-shrink-0" />}
    </div>
  )

  return (
    <li>
      {n.link ? (
        <Link href={n.link} onClick={handleClick}>{content}</Link>
      ) : (
        <button onClick={handleClick} className="w-full text-left">{content}</button>
      )}
    </li>
  )
}
