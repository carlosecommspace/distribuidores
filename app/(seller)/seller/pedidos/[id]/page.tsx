'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { formatUSD, formatBs, formatDateTime } from '@/lib/utils'
import { ArrowLeft, DollarSign, Info, CheckCircle2, Clock, Ban } from 'lucide-react'

interface PaymentRow {
  id: string
  amountUSD: number
  amountBs: number
  method: string
  reference: string | null
  proofUrl: string | null
  note: string | null
  origin: string
  status: string
  createdAt: string
  verifiedAt: string | null
  rejectedReason: string | null
}

interface RequestDetail {
  id: string
  code: string | null
  status: string
  notes: string | null
  totalUSD: number
  discountUSD: number
  discountReason: string | null
  paidUSD: number
  createdAt: string
  releasedAt: string | null
  client: {
    id: string
    name: string
    company: string | null
    phone: string | null
    email: string | null
    rif: string | null
    city: string | null
    address: string | null
  }
  items: Array<{
    id: string
    quantity: number
    priceUSD: number
    subtotalUSD: number
    product: { id: string; sku: string; name: string; unit: string | null }
  }>
  payments: PaymentRow[]
}

const METHOD_LABELS: Record<string, string> = {
  cash_usd: 'Efectivo USD',
  cash_bs: 'Efectivo Bs',
  zelle: 'Zelle',
  binance: 'Binance',
  transfer_bs: 'Transf. Bs',
  transfer_usd: 'Transf. USD',
  other: 'Otro',
}

export default function SellerRequestDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<RequestDetail | null>(null)
  const [rate, setRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payForm, setPayForm] = useState({
    amountUSD: '',
    method: 'cash_usd' as PaymentRow['method'],
    reference: '',
    note: '',
  })

  const load = async () => {
    const r = await fetch(`/api/seller/requests/${params.id}`)
    if (r.status === 404) {
      setNotFound(true)
      setLoading(false)
      return
    }
    if (!r.ok) {
      toast.error('No se pudo cargar el pedido')
      setLoading(false)
      return
    }
    const d = await r.json()
    setData(d.request)
    setRate(d.exchangeRate || 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const openPay = () => {
    if (!data) return
    const outstanding = Math.max(0, data.totalUSD - data.discountUSD - data.paidUSD)
    setPayForm({
      amountUSD: outstanding > 0 ? outstanding.toFixed(2) : '',
      method: 'cash_usd',
      reference: '',
      note: '',
    })
    setPayOpen(true)
  }

  const submitPay = async () => {
    if (!data) return
    const amt = Number(payForm.amountUSD)
    if (!amt || amt <= 0) {
      toast.error('Ingresá un monto en USD válido')
      return
    }
    setSaving(true)
    const r = await fetch(`/api/seller/requests/${params.id}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amountUSD: amt,
        method: payForm.method,
        reference: payForm.reference || null,
        note: payForm.note || null,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'No se pudo registrar el pago')
      return
    }
    toast.success('Pago reportado. Pendiente de verificación del admin.')
    setPayOpen(false)
    load()
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Detalle del pedido" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div>
        <Link href="/seller/pedidos" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-3">
          <ArrowLeft size={14} /> Volver
        </Link>
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-lg font-display text-text-primary mb-1">Pedido no encontrado</div>
            <div className="text-sm text-text-muted mb-4">O no tienes acceso a este pedido.</div>
            <Button variant="secondary" onClick={() => router.push('/seller/pedidos')}>Volver a mis pedidos</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  const effectiveTotal = Math.max(0, data.totalUSD - data.discountUSD)
  const outstanding = Math.max(0, effectiveTotal - data.paidUSD)
  const canReportPayment = data.status !== 'released' && data.status !== 'cancelled'
  const verifiedPayments = data.payments.filter((p) => p.status === 'verified')
  const pendingPayments = data.payments.filter((p) => p.status === 'submitted')
  const rejectedPayments = data.payments.filter((p) => p.status === 'rejected')

  return (
    <div>
      <Link href="/seller/pedidos" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-3">
        <ArrowLeft size={14} /> Mis pedidos
      </Link>

      <PageHeader
        title={`Pedido ${data.code || data.id.slice(0, 8)}`}
        subtitle={`Creado ${formatDateTime(data.createdAt)}`}
        actions={
          canReportPayment ? (
            <Button onClick={openPay}>
              <DollarSign size={14} /> Registrar pago del cliente
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4 md:gap-6">
        <div className="flex flex-col gap-4 md:gap-6">
          <Card>
            <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Productos</CardTitle>
              <StatusBadge status={data.status} />
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>SKU</TH>
                    <TH>Producto</TH>
                    <TH className="text-right">Cantidad</TH>
                    <TH className="text-right">Precio USD</TH>
                    <TH className="text-right">Subtotal</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((it) => (
                    <TR key={it.id}>
                      <TD className="font-mono text-xs text-text-secondary">{it.product.sku}</TD>
                      <TD>
                        <div className="text-sm">{it.product.name}</div>
                        {it.product.unit && <div className="text-xs text-text-muted">{it.product.unit}</div>}
                      </TD>
                      <TD className="text-right font-mono">{it.quantity}</TD>
                      <TD className="text-right font-mono">{formatUSD(it.priceUSD)}</TD>
                      <TD className="text-right font-mono text-accent">{formatUSD(it.subtotalUSD)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de pagos</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {data.payments.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">
                  No hay pagos registrados en este pedido.
                </div>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Fecha</TH>
                      <TH>Método</TH>
                      <TH>Referencia</TH>
                      <TH>Origen</TH>
                      <TH>Estado</TH>
                      <TH className="text-right">Monto</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.payments.map((p) => (
                      <TR key={p.id}>
                        <TD className="text-xs text-text-secondary">{formatDateTime(p.createdAt)}</TD>
                        <TD className="text-xs">{METHOD_LABELS[p.method] || p.method}</TD>
                        <TD className="text-xs text-text-secondary">{p.reference || '—'}</TD>
                        <TD>
                          <Badge tone={p.origin === 'seller' ? 'info' : p.origin === 'admin' ? 'success' : 'neutral' as never}>
                            {p.origin === 'seller' ? 'Vendedor' : p.origin === 'admin' ? 'Admin' : 'Portal'}
                          </Badge>
                        </TD>
                        <TD>
                          <PaymentStatusBadge status={p.status} rejectedReason={p.rejectedReason} />
                        </TD>
                        <TD className="text-right font-mono text-accent">{formatUSD(p.amountUSD)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          {data.notes && (
            <Card>
              <CardHeader><CardTitle>Notas del pedido</CardTitle></CardHeader>
              <CardBody>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{data.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card>
            <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-2 text-sm">
              <div>
                <div className="text-text-primary">{data.client.name}</div>
                {data.client.company && <div className="text-xs text-text-muted">{data.client.company}</div>}
              </div>
              {data.client.rif && (
                <div className="text-xs">
                  <span className="text-text-muted">RIF/Cédula: </span>
                  <span className="font-mono">{data.client.rif}</span>
                </div>
              )}
              {data.client.phone && (
                <div className="text-xs">
                  <span className="text-text-muted">Teléfono: </span>{data.client.phone}
                </div>
              )}
              {data.client.email && (
                <div className="text-xs">
                  <span className="text-text-muted">Email: </span>{data.client.email}
                </div>
              )}
              {data.client.city && (
                <div className="text-xs">
                  <span className="text-text-muted">Ciudad: </span>{data.client.city}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Row label="Subtotal" value={formatUSD(data.totalUSD)} />
              {data.discountUSD > 0 && (
                <Row label={`Descuento${data.discountReason ? ` (${data.discountReason})` : ''}`} value={`-${formatUSD(data.discountUSD)}`} muted />
              )}
              <div className="border-t border-border pt-3">
                <Row label="Total a cobrar" value={formatUSD(effectiveTotal)} accent />
              </div>
              <Row
                label={`Cobrado (${verifiedPayments.length}${pendingPayments.length ? ` +${pendingPayments.length} pend.` : ''})`}
                value={formatUSD(data.paidUSD)}
                tone={data.paidUSD > 0 ? 'success' : undefined}
              />
              <div className="border-t border-border pt-3">
                <Row
                  label="Saldo pendiente"
                  value={formatUSD(outstanding)}
                  tone={outstanding > 0 ? 'warning' : 'success'}
                />
              </div>
              {rate > 0 && (
                <div className="text-[11px] text-text-muted mt-1">
                  Tasa BCV vigente: Bs {rate.toFixed(4)} · Total ≈ {formatBs(effectiveTotal * rate)}
                </div>
              )}
            </CardBody>
          </Card>

          {(rejectedPayments.length > 0 || pendingPayments.length > 0) && (
            <Card>
              <CardBody className="flex flex-col gap-2 text-xs">
                {pendingPayments.length > 0 && (
                  <div className="flex items-start gap-2 text-warning">
                    <Clock size={14} className="mt-0.5 shrink-0" />
                    <span>{pendingPayments.length} pago{pendingPayments.length > 1 ? 's' : ''} en espera de verificación del administrador.</span>
                  </div>
                )}
                {rejectedPayments.length > 0 && (
                  <div className="flex items-start gap-2 text-danger">
                    <Ban size={14} className="mt-0.5 shrink-0" />
                    <span>{rejectedPayments.length} pago{rejectedPayments.length > 1 ? 's' : ''} rechazado{rejectedPayments.length > 1 ? 's' : ''}. Revisá el detalle con el admin.</span>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Registrar pago del cliente"
        description="El admin va a verificar el pago para que se aplique al saldo del pedido."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={submitPay}>Registrar pago</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="bg-info-subtle border border-info/30 rounded-md p-3 flex items-start gap-2 text-sm">
            <Info size={16} className="text-info shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary">
              Reportar el pago no lo aplica al saldo automáticamente. El admin lo revisa desde <span className="font-medium text-text-primary">/requests</span> y lo verifica.
              Cuando lo verifique, se descuenta del saldo pendiente.
            </div>
          </div>
          <Input
            label="Monto en USD *"
            type="number"
            step="0.01"
            mono
            value={payForm.amountUSD}
            onChange={(e) => setPayForm({ ...payForm, amountUSD: e.target.value })}
            hint={outstanding > 0 ? `Saldo pendiente: ${formatUSD(outstanding)}` : undefined}
          />
          <Select
            label="Método de pago *"
            value={payForm.method}
            onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentRow['method'] })}
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
          <Input
            label="Referencia (opcional)"
            placeholder="Últimos 4 dígitos, número de transacción, etc."
            value={payForm.reference}
            onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
          />
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">
              Nota (opcional)
            </label>
            <textarea
              className="input-base min-h-[70px] resize-y"
              placeholder="Aclaraciones para el admin"
              value={payForm.note}
              onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Row({
  label,
  value,
  accent,
  muted,
  tone,
}: {
  label: string
  value: string
  accent?: boolean
  muted?: boolean
  tone?: 'success' | 'warning'
}) {
  const color = tone === 'success' ? 'text-success'
    : tone === 'warning' ? 'text-warning'
    : accent ? 'text-accent'
    : muted ? 'text-text-muted'
    : 'text-text-primary'
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-text-muted' : 'text-text-secondary'}>{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'paid' || status === 'released' ? 'success' :
    status === 'partially_paid' ? 'warning' :
    status === 'cancelled' ? 'danger' :
    'neutral'
  const label =
    status === 'pending' ? 'Pendiente' :
    status === 'partially_paid' ? 'Pago parcial' :
    status === 'paid' ? 'Pagado' :
    status === 'released' ? 'Liberado' :
    status === 'cancelled' ? 'Cancelado' :
    status
  return <Badge tone={tone as never}>{label}</Badge>
}

function PaymentStatusBadge({ status, rejectedReason }: { status: string; rejectedReason: string | null }) {
  if (status === 'verified') {
    return <span className="inline-flex items-center gap-1 text-success text-xs"><CheckCircle2 size={12} /> Verificado</span>
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-danger text-xs" title={rejectedReason || ''}>
        <Ban size={12} /> Rechazado
      </span>
    )
  }
  return <span className="inline-flex items-center gap-1 text-warning text-xs"><Clock size={12} /> Pendiente</span>
}
