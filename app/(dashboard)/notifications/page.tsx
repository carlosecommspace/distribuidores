'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { formatRelative, cn } from '@/lib/utils'
import { Bell, Check, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

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

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [unreadCount, setUnreadCount] = useState(0)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/notifications?filter=${filter}&take=200`)
    const d = await r.json()
    setItems(d.items || [])
    setUnreadCount(d.unreadCount || 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const markAll = async () => {
    const r = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allRead: true }),
    })
    if (!r.ok) {
      toast.error('Error marcando notificaciones')
      return
    }
    toast.success('Todas marcadas como leídas')
    load()
  }

  const markOne = async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)))
    setUnreadCount((c) => Math.max(0, c - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        subtitle={unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAll}>
              <Check size={14} /> Marcar todas como leídas
            </Button>
          ) : null
        }
      />

      <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md w-fit mb-4">
        {[
          { v: 'unread', l: 'Sin leer' },
          { v: 'all', l: 'Todas' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setFilter(t.v as 'all' | 'unread')}
            className={cn(
              'px-3 py-1.5 text-xs rounded',
              filter === t.v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Bell size={28} />}
              title={filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones'}
              description="Las alertas de stock bajo, preguntas de MercadoLibre y ventas aparecerán aquí."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => <Row key={n.id} n={n} onMark={markOne} />)}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ n, onMark }: { n: Notification; onMark: (id: string) => void }) {
  const Icon =
    n.severity === 'danger' ? AlertCircle :
    n.severity === 'warning' ? AlertTriangle :
    n.severity === 'success' ? CheckCircle2 : Info
  const color =
    n.severity === 'danger' ? 'text-danger' :
    n.severity === 'warning' ? 'text-warning' :
    n.severity === 'success' ? 'text-success' : 'text-info'

  const titleNode = <span className={cn(!n.read && 'font-medium')}>{n.title}</span>

  return (
    <li className={cn('px-5 py-4 flex items-start gap-3 hover:bg-surface-2/40', !n.read && 'bg-accent-subtle/20')}>
      <div className={cn('mt-0.5 flex-shrink-0', color)}><Icon size={16} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary">
          {n.link ? <Link href={n.link} className="hover:text-accent">{titleNode}</Link> : titleNode}
        </div>
        {n.body && <div className="text-xs text-text-secondary mt-0.5">{n.body}</div>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-text-muted">{formatRelative(n.createdAt)}</span>
          <Badge tone={n.severity === 'danger' ? 'danger' : n.severity === 'warning' ? 'warning' : n.severity === 'success' ? 'success' : 'info'}>
            {labelType(n.type)}
          </Badge>
        </div>
      </div>
      {!n.read && (
        <button
          onClick={() => onMark(n.id)}
          className="text-xs text-text-muted hover:text-accent flex-shrink-0 inline-flex items-center gap-1"
        >
          <Check size={12} /> Marcar leída
        </button>
      )}
    </li>
  )
}

function labelType(type: string): string {
  switch (type) {
    case 'low_stock': return 'Stock bajo'
    case 'ml_question': return 'MercadoLibre'
    case 'new_sale': return 'Nueva venta'
    default: return type
  }
}
