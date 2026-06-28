'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Stat } from '@/components/ui/Stat'
import { toast } from '@/components/ui/Toast'
import { formatUSD, formatDateTime, formatRelative } from '@/lib/utils'
import { ArrowLeft, Plus, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Payment {
  id: string
  amountUSD: number
  amountBs: number
  method: string
  reference?: string | null
  proofUrl?: string | null
  note?: string | null
  status: 'submitted' | 'verified' | 'rejected'
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
  items: Array<{
    id: string
    quantity: number
    priceUSD: number
    subtotalUSD: number
    product: { id: string; name: string; sku: string; unit: string }
  }>
  payments: Payment[]
}

export default function PortalRequestDetail() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amountUSD: '',
    method: 'zelle',
    reference: '',
    proofUrl: '',
    note: '',
  })

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/portal/requests/${params.id}`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [params.id])

  const openPaymentForm = () => {
    const outstanding = data ? Math.max(0, data.totalUSD - data.paidUSD) : 0
    setForm({
      amountUSD: outstanding > 0 ? outstanding.toFixed(2) : '',
      method: 'zelle',
      reference: '',
      proofUrl: '',
      note: '',
    })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.amountUSD) {
      toast.error('Indica el monto pagado')
      return
    }
    setSaving(true)
    const r = await fetch(`/api/portal/requests/${params.id}/payments`, {
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
    toast.success('Pago notificado al distribuidor')
    setOpen(false)
    load()
  }

  if (loading) return <Skeleton className="h-64" />
  if (!data) return <div className="text-text-muted">Pedido no encontrado</div>

  const outstanding = Math.max(0, data.totalUSD - data.paidUSD)
  const isClosed = data.status === 'released' || data.status === 'cancelled'
  const canPay = !isClosed && outstanding > 0

  return (
    <div>
      <Link href="/portal/requests" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Mis pedidos
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Pedido #{data.id.slice(-6).toUpperCase()}</h1>
          <div className="text-sm text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
            <span>{formatRelative(data.createdAt)}</span>
            <StatusBadge status={data.status} />
          </div>
        </div>
        {canPay && (
          <Button onClick={openPaymentForm}>
            <Plus size={14} /> Notificar pago
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Stat label="Total del pedido" value={formatUSD(data.totalUSD)} />
        <Stat label="Pagado" value={formatUSD(data.paidUSD)} accent={data.paidUSD > 0} />
        <Stat label="Saldo pendiente" value={formatUSD(outstanding)} />
      </div>

      {data.status === 'paid' && (
        <Card className="mb-4 border-success/30 bg-success-subtle">
          <CardBody className="text-sm">
            ✓ Tu pago fue verificado. El distribuidor procesará y liberará tu pedido pronto.
          </CardBody>
        </Card>
      )}
      {data.status === 'released' && (
        <Card className="mb-4 border-success/30 bg-success-subtle">
          <CardBody className="text-sm">
            ✓ Pedido liberado{data.releasedAt && ` el ${formatDateTime(data.releasedAt)}`}. Coordina la entrega con el distribuidor.
          </CardBody>
        </Card>
      )}
      {data.status === 'cancelled' && (
        <Card className="mb-4 border-danger/30 bg-danger-subtle">
          <CardBody className="text-sm">Este pedido fue cancelado.</CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Productos</CardTitle></CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {data.items.map((it) => (
                <li key={it.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm">{it.product.name}</div>
                    <div className="text-xs text-text-muted font-mono">{it.product.sku} · {it.quantity} {it.product.unit} × {formatUSD(it.priceUSD)}</div>
                  </div>
                  <div className="font-mono text-accent">{formatUSD(it.subtotalUSD)}</div>
                </li>
              ))}
            </ul>
            {data.notes && (
              <div className="px-5 py-3 border-t border-border text-xs text-text-secondary">
                <span className="uppercase tracking-wider">Tus notas: </span>{data.notes}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mis pagos</CardTitle></CardHeader>
          <CardBody className="p-0">
            {data.payments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                No has registrado pagos aún.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.payments.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-accent">{formatUSD(p.amountUSD)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-text-secondary">
                      {labelMethod(p.method)} · {formatRelative(p.createdAt)}
                    </div>
                    {p.reference && (
                      <div className="text-xs text-text-muted">Ref: <span className="font-mono">{p.reference}</span></div>
                    )}
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-accent inline-flex items-center gap-1 mt-1">
                        Ver comprobante <ExternalLink size={10} />
                      </a>
                    )}
                    {p.status === 'rejected' && p.rejectedReason && (
                      <div className="text-xs text-danger mt-1">El distribuidor rechazó este pago: {p.rejectedReason}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Notificar pago"
        description="Carga el comprobante para que el distribuidor verifique tu pago."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={submit}>Enviar</Button>
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
            hint={`Saldo pendiente: ${formatUSD(outstanding)} — puedes pagar parcial`}
          />
          <Select
            label="Método de pago"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            options={[
              { value: 'zelle', label: 'Zelle' },
              { value: 'binance', label: 'Binance' },
              { value: 'transfer_bs', label: 'Transferencia Bs' },
              { value: 'transfer_usd', label: 'Transferencia USD' },
              { value: 'cash_usd', label: 'Efectivo USD' },
              { value: 'cash_bs', label: 'Efectivo Bs' },
              { value: 'other', label: 'Otro' },
            ]}
          />
          <Input
            label="Referencia / # de operación"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="Ej: últimos 4 dígitos, # de Binance..."
          />
          <Input
            label="URL del comprobante"
            type="url"
            value={form.proofUrl}
            onChange={(e) => setForm({ ...form, proofUrl: e.target.value })}
            placeholder="https://..."
            hint="Sube la captura a Drive/ImgBB/Telegram y pega el enlace aquí"
          />
          <Textarea
            label="Notas adicionales"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'neutral' | 'warning' | 'info' | 'success' | 'danger'; label: string; Icon: typeof Clock }> = {
    pending: { tone: 'warning', label: 'Pendiente de pago', Icon: Clock },
    partially_paid: { tone: 'info', label: 'Pago parcial', Icon: Clock },
    paid: { tone: 'success', label: 'Pagado · esperando liberación', Icon: CheckCircle },
    released: { tone: 'success', label: 'Liberado', Icon: CheckCircle },
    cancelled: { tone: 'danger', label: 'Cancelado', Icon: XCircle },
  }
  const m = map[status] || { tone: 'neutral', label: status, Icon: Clock }
  const Icon = m.Icon
  return <Badge tone={m.tone}><Icon size={10} /> {m.label}</Badge>
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
