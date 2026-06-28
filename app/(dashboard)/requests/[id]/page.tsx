'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Stat } from '@/components/ui/Stat'
import { toast } from '@/components/ui/Toast'
import { formatUSD, formatBs, formatDateTime, formatRelative } from '@/lib/utils'
import { ArrowLeft, CheckCircle, XCircle, Send, Plus, ExternalLink, RotateCcw } from 'lucide-react'

interface Payment {
  id: string
  amountUSD: number
  amountBs: number
  exchangeRate: number
  method: string
  origin: string
  reference?: string | null
  proofUrl?: string | null
  note?: string | null
  status: 'submitted' | 'verified' | 'rejected'
  verifiedAt?: string | null
  rejectedReason?: string | null
  createdAt: string
}

interface RequestDetail {
  id: string
  status: string
  notes?: string | null
  totalUSD: number
  paidUSD: number
  createdAt: string
  releasedAt?: string | null
  saleId?: string | null
  client: { id: string; name: string; company?: string | null; phone?: string | null }
  items: Array<{
    id: string
    quantity: number
    priceUSD: number
    subtotalUSD: number
    product: { id: string; name: string; sku: string; stock: number; unit: string }
  }>
  payments: Payment[]
  sale?: { id: string; createdAt: string } | null
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [form, setForm] = useState({
    amountUSD: '',
    method: 'cash_usd',
    reference: '',
    proofUrl: '',
    note: '',
    verified: true,
  })

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/requests/${params.id}`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  const onAddPayment = async () => {
    if (!form.amountUSD) {
      toast.error('Monto requerido')
      return
    }
    setSaving(true)
    const r = await fetch(`/api/requests/${params.id}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, amountUSD: Number(form.amountUSD) }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error registrando pago')
      return
    }
    toast.success('Pago registrado')
    setAddOpen(false)
    setForm({ amountUSD: '', method: 'cash_usd', reference: '', proofUrl: '', note: '', verified: true })
    load()
  }

  const onVerify = async (paymentId: string, action: 'verify' | 'reject' | 'reset') => {
    let reason: string | null = null
    if (action === 'reject') {
      reason = prompt('Razón del rechazo (opcional)') ?? null
    }
    const r = await fetch(`/api/payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    })
    if (!r.ok) {
      toast.error('Error actualizando pago')
      return
    }
    toast.success(action === 'verify' ? 'Pago verificado' : action === 'reject' ? 'Pago rechazado' : 'Pago restablecido')
    load()
  }

  const onRelease = async () => {
    if (!confirm('Esto descontará stock de todos los productos del pedido y creará la venta enlazada. ¿Continuar?')) return
    setReleasing(true)
    const r = await fetch(`/api/requests/${params.id}/release`, { method: 'POST' })
    setReleasing(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error liberando pedido')
      return
    }
    toast.success('Pedido liberado · stock descontado')
    load()
  }

  const onCancel = async () => {
    if (!confirm('¿Cancelar este pedido? No se podrá modificar después.')) return
    const r = await fetch(`/api/requests/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!r.ok) {
      toast.error('Error cancelando')
      return
    }
    toast.success('Pedido cancelado')
    load()
  }

  if (loading) return <Skeleton className="h-64" />
  if (!data) return <div className="text-text-muted">Pedido no encontrado</div>

  const outstanding = Math.max(0, data.totalUSD - data.paidUSD)
  const canRelease = data.status === 'paid'
  const isClosed = data.status === 'released' || data.status === 'cancelled'

  return (
    <div>
      <Link href="/requests" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Pedidos
      </Link>

      <PageHeader
        title={`Pedido #${data.id.slice(-6).toUpperCase()}`}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <Link href={`/clients/${data.client.id}`} className="hover:text-accent">{data.client.name}</Link>
            {data.client.company && <span>· {data.client.company}</span>}
            <span>· {formatRelative(data.createdAt)}</span>
            <StatusBadge status={data.status} />
          </span> as unknown as string
        }
        actions={
          <div className="flex gap-2 flex-wrap">
            {!isClosed && (
              <>
                <Button variant="secondary" onClick={() => setAddOpen(true)}>
                  <Plus size={14} /> Registrar pago manual
                </Button>
                {canRelease && (
                  <Button loading={releasing} onClick={onRelease}>
                    <Send size={14} /> Liberar y descontar stock
                  </Button>
                )}
                <Button variant="ghost" onClick={onCancel}>Cancelar pedido</Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total del pedido" value={formatUSD(data.totalUSD)} />
        <Stat label="Pagado verificado" value={formatUSD(data.paidUSD)} accent={data.paidUSD > 0} />
        <Stat label="Saldo pendiente" value={formatUSD(outstanding)} />
        <Stat label="Pagos registrados" value={data.payments.length} />
      </div>

      {data.saleId && (
        <Card className="mb-6 border-success/30 bg-success-subtle">
          <CardBody className="flex items-center justify-between">
            <div>
              <div className="text-sm text-success font-medium">Pedido liberado</div>
              <div className="text-xs text-text-secondary">
                {data.releasedAt && <>Liberado el {formatDateTime(data.releasedAt)}. </>}
                Stock descontado y venta creada.
              </div>
            </div>
            <Link href={`/sales`} className="text-sm text-accent inline-flex items-center gap-1">
              Ver venta <ExternalLink size={12} />
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Productos solicitados</CardTitle></CardHeader>
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Producto</TH>
                  <TH className="text-right">Cantidad</TH>
                  <TH className="text-right">Stock actual</TH>
                  <TH className="text-right">Precio</TH>
                  <TH className="text-right">Subtotal</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((it) => {
                  const insufficient = it.product.stock < it.quantity
                  return (
                    <TR key={it.id}>
                      <TD className="font-mono text-xs text-text-secondary">{it.product.sku}</TD>
                      <TD>{it.product.name}</TD>
                      <TD className="text-right font-mono">{it.quantity}</TD>
                      <TD className={`text-right font-mono ${insufficient ? 'text-danger' : ''}`}>
                        {it.product.stock} {it.product.unit}
                      </TD>
                      <TD className="text-right font-mono">{formatUSD(it.priceUSD)}</TD>
                      <TD className="text-right font-mono text-accent">{formatUSD(it.subtotalUSD)}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            {data.notes && (
              <div className="px-5 py-3 border-t border-border text-xs">
                <span className="text-text-secondary uppercase tracking-wider">Notas del cliente: </span>
                <span className="text-text-primary">{data.notes}</span>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {data.payments.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-text-muted">
                Aún no se han registrado pagos.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.payments.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-accent">{formatUSD(p.amountUSD)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-text-secondary mb-1">
                      {labelMethod(p.method)} · {p.origin === 'portal' ? 'cliente' : 'admin'} · {formatRelative(p.createdAt)}
                    </div>
                    {p.reference && (
                      <div className="text-xs text-text-muted">Ref: <span className="font-mono">{p.reference}</span></div>
                    )}
                    {p.note && (
                      <div className="text-xs text-text-secondary mt-1">{p.note}</div>
                    )}
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-accent inline-flex items-center gap-1 mt-1">
                        Ver comprobante <ExternalLink size={10} />
                      </a>
                    )}
                    {p.status === 'rejected' && p.rejectedReason && (
                      <div className="text-xs text-danger mt-1">Razón: {p.rejectedReason}</div>
                    )}
                    {!isClosed && p.status === 'submitted' && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => onVerify(p.id, 'verify')} className="text-xs text-success hover:underline inline-flex items-center gap-1">
                          <CheckCircle size={11} /> Verificar
                        </button>
                        <button onClick={() => onVerify(p.id, 'reject')} className="text-xs text-danger hover:underline inline-flex items-center gap-1">
                          <XCircle size={11} /> Rechazar
                        </button>
                      </div>
                    )}
                    {!isClosed && p.status !== 'submitted' && (
                      <button onClick={() => onVerify(p.id, 'reset')} className="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1 mt-2">
                        <RotateCcw size={10} /> Volver a revisión
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Registrar pago manual"
        description="Para cuando el cliente paga en persona o el comprobante llega por otro canal."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={onAddPayment}>Registrar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Monto USD"
            type="number"
            step="0.01"
            mono
            value={form.amountUSD}
            onChange={(e) => setForm({ ...form, amountUSD: e.target.value })}
            hint={`Saldo pendiente: ${formatUSD(outstanding)}`}
          />
          <Select
            label="Método"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            options={[
              { value: 'cash_usd', label: 'Efectivo USD' },
              { value: 'cash_bs', label: 'Efectivo Bs' },
              { value: 'zelle', label: 'Zelle' },
              { value: 'binance', label: 'Binance' },
              { value: 'transfer_bs', label: 'Transferencia Bs' },
              { value: 'transfer_usd', label: 'Transferencia USD' },
              { value: 'other', label: 'Otro' },
            ]}
          />
          <Input label="Referencia" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="últimos 4 dígitos, # de transacción" />
          <Input label="URL del comprobante (opcional)" type="url" value={form.proofUrl} onChange={(e) => setForm({ ...form, proofUrl: e.target.value })} placeholder="https://..." />
          <Textarea label="Nota" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              className="accent-accent"
            />
            <span>Marcar como verificado de inmediato</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'neutral' | 'warning' | 'info' | 'success' | 'danger'; label: string }> = {
    pending: { tone: 'warning', label: 'Pendiente' },
    partially_paid: { tone: 'info', label: 'Parcialmente pagado' },
    paid: { tone: 'success', label: 'Pagado · listo' },
    released: { tone: 'success', label: 'Liberado' },
    cancelled: { tone: 'danger', label: 'Cancelado' },
  }
  const m = map[status] || { tone: 'neutral', label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}

function PaymentStatusBadge({ status }: { status: string }) {
  if (status === 'verified') return <Badge tone="success">Verificado</Badge>
  if (status === 'rejected') return <Badge tone="danger">Rechazado</Badge>
  return <Badge tone="warning">En revisión</Badge>
}

function labelMethod(m: string): string {
  const map: Record<string, string> = {
    cash_usd: 'Efectivo USD',
    cash_bs: 'Efectivo Bs',
    zelle: 'Zelle',
    binance: 'Binance',
    transfer_bs: 'Transf. Bs',
    transfer_usd: 'Transf. USD',
    other: 'Otro',
  }
  return map[m] || m
}
