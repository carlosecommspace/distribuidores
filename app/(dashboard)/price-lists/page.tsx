'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { Plus, Tag, ChevronRight } from 'lucide-react'

interface PriceList {
  id: string
  name: string
  notes?: string | null
  isActive: boolean
  _count: { items: number; clients: number }
  updatedAt: string
}

export default function PriceListsPage() {
  const [items, setItems] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', notes: '' })

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/price-lists')
    setItems(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onSave = async () => {
    setSaving(true)
    const r = await fetch('/api/price-lists', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error guardando lista')
      return
    }
    toast.success('Lista creada')
    setOpen(false)
    setForm({ name: '', notes: '' })
    load()
  }

  return (
    <div>
      <PageHeader
        title="Listas de precio"
        subtitle={`${items.length} ${items.length === 1 ? 'lista' : 'listas'} configuradas`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Nueva lista
          </Button>
        }
      />

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Tag size={32} />}
              title="No hay listas de precio"
              description="Crea una lista (ej. Mayorista, Distribuidor) y asígnala a tus clientes para que vean precios custom."
              action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nueva lista</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH>
                  <TH className="text-right">Productos</TH>
                  <TH className="text-right">Clientes</TH>
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((l) => (
                  <TR key={l.id}>
                    <TD>
                      <Link href={`/price-lists/${l.id}`} className="text-text-primary hover:text-accent">
                        {l.name}
                      </Link>
                      {l.notes && <div className="text-xs text-text-muted truncate max-w-xs">{l.notes}</div>}
                    </TD>
                    <TD className="text-right font-mono">{l._count.items}</TD>
                    <TD className="text-right font-mono">{l._count.clients}</TD>
                    <TD>{l.isActive ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}</TD>
                    <TD className="text-right">
                      <Link href={`/price-lists/${l.id}`} className="text-text-muted hover:text-accent inline-flex p-1">
                        <ChevronRight size={16} />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Nueva lista de precio"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={onSave} disabled={!form.name.trim()}>Crear lista</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre"
            placeholder="Ej. Mayorista, Distribuidor"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Textarea
            label="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}
