'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { toast } from '@/components/ui/Toast'
import { formatUSD } from '@/lib/utils'
import { UserPlus, Users, Search, Plus } from 'lucide-react'

interface ClientRow {
  id: string
  name: string
  company: string | null
  rif: string | null
  phone: string | null
  email: string | null
  totalPurchases: number
  priceList: { id: string; name: string } | null
}

interface PriceList { id: string; name: string }

export default function MyClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [form, setForm] = useState({
    name: '', company: '', rif: '', phone: '', email: '',
    address: '', city: '', priceListId: '',
  })

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/seller/clients')
    const d = await r.json()
    setClients(d.clients || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/seller/profile').then((r) => r.json()).then((d) => setPriceLists(d.priceLists || []))
  }, [])

  const filtered = useMemo(() => {
    if (!q.trim()) return clients
    const s = q.trim().toLowerCase()
    return clients.filter((c) =>
      c.name.toLowerCase().includes(s) ||
      c.company?.toLowerCase().includes(s) ||
      c.rif?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s),
    )
  }, [clients, q])

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setCreating(true)
    const r = await fetch('/api/seller/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        company: form.company || null,
        rif: form.rif || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        priceListId: form.priceListId || null,
      }),
    })
    setCreating(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast.error(typeof d.error === 'string' ? d.error : 'Error creando cliente')
      return
    }
    toast.success('Cliente creado y asignado a ti')
    setForm({ name: '', company: '', rif: '', phone: '', email: '', address: '', city: '', priceListId: '' })
    setOpen(false)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Mis clientes"
        subtitle={`${clients.length} ${clients.length === 1 ? 'cliente asignado' : 'clientes asignados'}`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus size={14} /> Nuevo cliente
          </Button>
        }
      />

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente por nombre, empresa, RIF o email"
              className="pl-9"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              title={clients.length === 0 ? 'Aún no tienes clientes' : 'Nada coincide'}
              description={clients.length === 0
                ? 'Crea tu primer cliente o pide al admin que te asigne clientes existentes.'
                : 'Prueba con otra búsqueda.'}
              action={clients.length === 0 ? (
                <Button onClick={() => setOpen(true)}><UserPlus size={14} /> Nuevo cliente</Button>
              ) : undefined}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Cliente</TH>
                  <TH>Contacto</TH>
                  <TH>Lista de precios</TH>
                  <TH className="text-right">Compras acumuladas</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <div className="text-sm">{c.name}</div>
                      {c.company && <div className="text-xs text-text-muted">{c.company}</div>}
                    </TD>
                    <TD className="text-xs text-text-secondary">
                      {c.email && <div>{c.email}</div>}
                      {c.phone && <div>{c.phone}</div>}
                    </TD>
                    <TD>
                      {c.priceList ? (
                        <Badge tone="info">{c.priceList.name}</Badge>
                      ) : (
                        <span className="text-xs text-text-muted">Precios base</span>
                      )}
                    </TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(c.totalPurchases)}</TD>
                    <TD className="text-right">
                      <Link
                        href={`/seller/pedidos/nuevo?clientId=${c.id}`}
                        className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                      >
                        <Plus size={12} /> Pedido
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
        title="Nuevo cliente"
        description="Se te asignará automáticamente al crearlo."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={creating} onClick={create}>Crear cliente</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input label="RIF / Cédula" value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <div className="md:col-span-2">
            <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Select
              label="Lista de precios"
              value={form.priceListId}
              onChange={(e) => setForm({ ...form, priceListId: e.target.value })}
              options={[
                { value: '', label: 'Precios base' },
                ...priceLists.map((pl) => ({ value: pl.id, label: pl.name })),
              ]}
            />
            <div className="text-xs text-text-muted mt-1">Solo puedes elegir listas que el admin ya haya creado.</div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
