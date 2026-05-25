'use client'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stat } from '@/components/ui/Stat'
import { Select } from '@/components/ui/Select'
import { SaleForm, emptySale, type SaleFormValues } from '@/components/sales/SaleForm'
import { toast } from '@/components/ui/Toast'
import { formatUSD, formatBs, formatDateTime } from '@/lib/utils'
import { Plus, ShoppingCart } from 'lucide-react'

interface Sale {
  id: string
  channel: string
  paymentMethod: string
  paymentStatus: string
  totalUSD: number
  totalBs: number
  createdAt: string
  client?: { name: string } | null
  items: Array<{ quantity: number; product: { name: string } }>
}

export default function SalesPage() {
  const [items, setItems] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [channelFilter, setChannelFilter] = useState('')
  const [rate, setRate] = useState(0)
  const [form, setForm] = useState<SaleFormValues>(emptySale(0))

  const load = async () => {
    setLoading(true)
    const url = new URL('/api/sales', window.location.origin)
    if (channelFilter) url.searchParams.set('channel', channelFilter)
    const r = await fetch(url.toString())
    setItems(await r.json())
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => {
      const r = d?.settings?.exchangeRate || 0
      setRate(r)
      setForm(emptySale(r))
    })
  }, [])

  useEffect(() => { load() }, [channelFilter])

  const onSave = async () => {
    if (form.items.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    setSaving(true)
    const r = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        items: form.items.map((i) => ({ productId: i.productId, quantity: i.quantity, priceUSD: i.priceUSD })),
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error guardando la venta')
      return
    }
    toast.success('Venta registrada')
    setOpen(false)
    setForm(emptySale(rate))
    load()
  }

  const stats = useMemo(() => {
    const totalUSD = items.reduce((s, x) => s + x.totalUSD, 0)
    const totalBs = items.reduce((s, x) => s + x.totalBs, 0)
    return { totalUSD, totalBs, count: items.length }
  }, [items])

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Registra y consulta tus ventas de todos los canales"
        actions={
          <Button onClick={() => { setForm(emptySale(rate)); setOpen(true) }}>
            <Plus size={16} /> Registrar venta
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <Stat label="Total período (USD)" value={formatUSD(stats.totalUSD)} accent />
        <Stat label="Total período (Bs)" value={formatBs(stats.totalBs)} />
        <Stat label="Transacciones" value={stats.count} />
      </div>

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border flex gap-3 items-center flex-wrap">
          <span className="text-xs uppercase tracking-wider text-text-secondary whitespace-nowrap">Filtrar por canal</span>
          <Select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              { value: 'direct', label: 'Directo' },
              { value: 'mercadolibre', label: 'MercadoLibre' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'phone', label: 'Teléfono' },
              { value: 'other', label: 'Otro' },
            ]}
            className="max-w-[200px]"
          />
        </div>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={32} />}
              title="Sin ventas todavía"
              description="Registra tu primera venta para empezar a ver tus métricas."
              action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Registrar venta</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Cliente</TH>
                  <TH>Canal</TH>
                  <TH>Productos</TH>
                  <TH>Método</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((s) => (
                  <TR key={s.id}>
                    <TD className="text-xs text-text-secondary">{formatDateTime(s.createdAt)}</TD>
                    <TD>{s.client?.name || <span className="text-text-muted">Ocasional</span>}</TD>
                    <TD><Badge>{channelLabel(s.channel)}</Badge></TD>
                    <TD className="text-xs text-text-secondary">
                      {s.items.length} {s.items.length === 1 ? 'producto' : 'productos'} · {s.items.reduce((a, i) => a + i.quantity, 0)} unid.
                    </TD>
                    <TD className="text-xs">{paymentLabel(s.paymentMethod)}</TD>
                    <TD>{statusBadge(s.paymentStatus)}</TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(s.totalUSD)}</TD>
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
        title="Registrar venta"
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={onSave}>Guardar venta</Button>
          </>
        }
      >
        <SaleForm value={form} onChange={setForm} />
      </Modal>
    </div>
  )
}

function channelLabel(c: string) {
  return { mercadolibre: 'ML', whatsapp: 'WA', direct: 'Directo', phone: 'Teléfono', other: 'Otro' }[c] || c
}

function paymentLabel(p: string) {
  const map: Record<string, string> = {
    cash_usd: 'Efectivo USD', cash_bs: 'Efectivo Bs', zelle: 'Zelle', binance: 'Binance',
    transfer_bs: 'Transf. Bs', transfer_usd: 'Transf. USD', mixed: 'Mixto',
  }
  return map[p] || p
}

function statusBadge(s: string) {
  if (s === 'paid') return <Badge tone="success">Pagado</Badge>
  if (s === 'pending') return <Badge tone="warning">Pendiente</Badge>
  return <Badge tone="info">Parcial</Badge>
}
