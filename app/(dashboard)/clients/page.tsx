'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { formatUSD, formatRelative } from '@/lib/utils'
import { Plus, Search, Users } from 'lucide-react'

interface Client {
  id: string
  name: string
  company?: string | null
  phone?: string | null
  email?: string | null
  type: string
  totalPurchases: number
  lastPurchase?: string | null
}

export default function ClientsPage() {
  const [items, setItems] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    type: 'retail',
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    setItems(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [q])

  const onSave = async () => {
    setSaving(true)
    const r = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error('Error guardando cliente')
      return
    }
    toast.success('Cliente creado')
    setOpen(false)
    setForm({ name: '', company: '', phone: '', email: '', address: '', city: '', type: 'retail', notes: '' })
    load()
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${items.length} clientes registrados`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Nuevo cliente
          </Button>
        }
      />

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, empresa o teléfono" className="pl-9" />
          </div>
        </div>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              title="Aún no hay clientes"
              description="Agrega tus clientes para registrar ventas y ver su historial."
              action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nuevo cliente</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH>
                  <TH>Empresa</TH>
                  <TH>Teléfono</TH>
                  <TH>Tipo</TH>
                  <TH className="text-right">Total comprado</TH>
                  <TH>Última compra</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/clients/${c.id}`} className="text-text-primary hover:text-accent">{c.name}</Link>
                    </TD>
                    <TD className="text-text-secondary">{c.company || '—'}</TD>
                    <TD className="font-mono text-text-secondary">{c.phone || '—'}</TD>
                    <TD>{typeBadge(c.type)}</TD>
                    <TD className="text-right font-mono">{formatUSD(c.totalPurchases)}</TD>
                    <TD className="text-text-secondary text-xs">{c.lastPurchase ? formatRelative(c.lastPurchase) : '—'}</TD>
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
        title="Nuevo cliente"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={onSave}>Crear cliente</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input label="Teléfono" placeholder="+58..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="md:col-span-2" />
          <Input label="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Select
            label="Tipo"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: 'retail', label: 'Detal' },
              { value: 'wholesale', label: 'Mayorista' },
              { value: 'distributor', label: 'Distribuidor' },
            ]}
          />
          <Textarea label="Notas internas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-2" />
        </div>
      </Modal>
    </div>
  )
}

function typeBadge(t: string) {
  if (t === 'wholesale') return <Badge tone="info">Mayorista</Badge>
  if (t === 'distributor') return <Badge tone="accent">Distribuidor</Badge>
  return <Badge>Detal</Badge>
}
