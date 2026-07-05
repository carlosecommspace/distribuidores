'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { formatRelative, cn } from '@/lib/utils'
import { Inbox, Mail, Trash2, Phone } from 'lucide-react'

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  message: string
  readAt: string | null
  createdAt: string
}

export default function LeadsPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = () =>
    fetch('/api/leads').then((r) => r.json()).then((d) => {
      setLeads(d.leads || [])
      setLoading(false)
    })

  useEffect(() => {
    load()
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [])

  const open = async (l: Lead) => {
    setExpanded((cur) => (cur === l.id ? null : l.id))
    if (!l.readAt) {
      await fetch(`/api/leads/${l.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markRead: true }),
      })
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, readAt: new Date().toISOString() } : x)))
    }
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este mensaje?')) return
    const r = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (!r.ok) {
      toast.error('No se pudo eliminar')
      return
    }
    setLeads((prev) => prev.filter((x) => x.id !== id))
  }

  const unread = leads.filter((l) => !l.readAt).length

  return (
    <div>
      <PageHeader
        title="Leads del sitio web"
        subtitle={`${leads.length} mensajes · ${unread} sin leer`}
      />
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Inbox size={32} />}
              title="Aún no llegan leads"
              description="Cuando alguien complete el formulario de contacto de tu sitio web, aparecerá aquí."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((l) => {
            const isOpen = expanded === l.id
            return (
              <Card key={l.id}>
                <button
                  onClick={() => open(l)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className={cn(
                    'flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center',
                    l.readAt ? 'bg-surface-2 text-text-muted' : 'bg-accent-subtle text-accent',
                  )}>
                    <Mail size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', l.readAt ? 'text-text-primary' : 'text-text-primary font-semibold')}>
                          {l.name}
                        </span>
                        {!l.readAt && <Badge tone="info">Nuevo</Badge>}
                      </div>
                      <span className="text-[11px] text-text-muted flex-shrink-0">{formatRelative(l.createdAt)}</span>
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5 flex flex-wrap gap-2">
                      {l.email && <span>{l.email}</span>}
                      {l.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.phone}</span>}
                    </div>
                    <div className={cn('text-sm text-text-secondary mt-1', !isOpen && 'truncate')}>
                      {l.message}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border px-4 py-3 flex items-center gap-2 justify-end">
                    {l.email && (
                      <a href={`mailto:${l.email}`} className="text-sm text-accent hover:underline">Responder por correo</a>
                    )}
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className="text-sm text-accent hover:underline">Llamar</a>
                    )}
                    <button onClick={() => del(l.id)} className="text-sm text-danger hover:underline inline-flex items-center gap-1">
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
