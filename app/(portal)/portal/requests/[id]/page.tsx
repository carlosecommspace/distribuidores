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
import { FileUpload } from '@/components/ui/FileUpload'
import { formatUSD, formatDateTime, formatRelative } from '@/lib/utils'
import { ArrowLeft, Plus, ExternalLink, CheckCircle, XCircle, Clock, Printer, Trash2, Pencil, Minus, Search, Wallet, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  code?: string | null
  status: string
  notes?: string | null
  totalUSD: number
  discountUSD: number
  discountReason?: string | null
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

interface CatalogProduct {
  id: string
  sku: string
  name: string
  priceUSD: number
  stock: number
  unit: string
}

export default function PortalRequestDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
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
  const [cancelling, setCancelling] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editItems, setEditItems] = useState<Record<string, { product: CatalogProduct; quantity: number }>>({})
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<CatalogProduct[]>([])
  const [methodsOpen, setMethodsOpen] = useState(false)
  const [methods, setMethods] = useState<Array<{
    id: string; type: string; label: string; accountName?: string | null;
    accountNumber?: string | null; bankName?: string | null; documentId?: string | null;
    currency: string; instructions?: string | null;
  }>>([])
  const [methodsLoaded, setMethodsLoaded] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/portal/requests/${params.id}`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [params.id])

  useEffect(() => {
    fetch('/api/portal/payment-methods').then((r) => r.json()).then((d) => {
      setMethods(Array.isArray(d) ? d : [])
      setMethodsLoaded(true)
    }).catch(() => setMethodsLoaded(true))
  }, [])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

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

  const cancelOrder = async () => {
    if (!confirm('¿Cancelar este pedido? No podrás recuperarlo.')) return
    setCancelling(true)
    const r = await fetch(`/api/portal/requests/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    setCancelling(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error cancelando')
      return
    }
    toast.success('Pedido cancelado')
    load()
  }

  const openEdit = () => {
    if (!data) return
    const map: Record<string, { product: CatalogProduct; quantity: number }> = {}
    for (const it of data.items) {
      map[it.product.id] = {
        product: { id: it.product.id, sku: it.product.sku, name: it.product.name, unit: it.product.unit, priceUSD: it.priceUSD, stock: 9999 },
        quantity: it.quantity,
      }
    }
    setEditItems(map)
    setEditNotes(data.notes || '')
    setProductSearch('')
    setProductResults([])
    setEditOpen(true)
  }

  useEffect(() => {
    if (!editOpen) return
    const t = setTimeout(async () => {
      if (!productSearch.trim()) return setProductResults([])
      const r = await fetch(`/api/portal/catalog?q=${encodeURIComponent(productSearch)}`)
      const d = await r.json()
      setProductResults((d.products || []).slice(0, 8))
    }, 200)
    return () => clearTimeout(t)
  }, [productSearch, editOpen])

  const addEditItem = (p: CatalogProduct) => {
    setEditItems((prev) => {
      const cur = prev[p.id]?.quantity || 0
      const next = Math.min(p.stock, cur + 1)
      if (next <= 0) return prev
      return { ...prev, [p.id]: { product: p, quantity: next } }
    })
    setProductSearch('')
    setProductResults([])
  }

  const changeEditQty = (productId: string, delta: number) => {
    setEditItems((prev) => {
      const cur = prev[productId]
      if (!cur) return prev
      const next = Math.max(0, cur.quantity + delta)
      if (next === 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      if (next > cur.product.stock && cur.product.stock < 9999) {
        toast.error(`Sólo hay ${cur.product.stock} disponibles`)
        return prev
      }
      return { ...prev, [productId]: { ...cur, quantity: next } }
    })
  }

  const submitEdit = async () => {
    const items = Object.values(editItems).map((v) => ({ productId: v.product.id, quantity: v.quantity }))
    if (items.length === 0) {
      toast.error('El pedido debe tener al menos un producto')
      return
    }
    setEditSaving(true)
    const r = await fetch(`/api/portal/requests/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update', items, notes: editNotes || null }),
    })
    setEditSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({} as { error?: string; message?: string; items?: Array<{ name: string; requested: number; available: number }> }))
      if (e?.error === 'insufficient_stock' && e.items?.length) {
        const first = e.items[0]
        toast.error(`Sin stock para ${first.name}: pediste ${first.requested}, hay ${first.available}`)
        return
      }
      toast.error(typeof e.error === 'string' ? e.error : 'Error editando pedido')
      return
    }
    toast.success('Pedido actualizado')
    setEditOpen(false)
    load()
  }

  if (loading) return <Skeleton className="h-64" />
  if (!data) return <div className="text-text-muted">Pedido no encontrado</div>

  const effectiveTotal = Math.max(0, data.totalUSD - (data.discountUSD || 0))
  const outstanding = Math.max(0, effectiveTotal - data.paidUSD)
  const isClosed = data.status === 'released' || data.status === 'cancelled'
  const canPay = !isClosed && outstanding > 0
  const hasAnyPayment = data.payments.length > 0
  const canCancel = !isClosed && !data.payments.some((p) => p.status === 'verified')
  const canEdit = !isClosed && !hasAnyPayment
  const editTotal = Object.values(editItems).reduce((s, l) => s + l.quantity * l.product.priceUSD, 0)

  return (
    <div>
      <Link href="/portal/requests" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Mis pedidos
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary font-mono">
            {data.code || `Pedido #${data.id.slice(-6).toUpperCase()}`}
          </h1>
          <div className="text-sm text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
            <span>{formatRelative(data.createdAt)}</span>
            <StatusBadge status={data.status} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={`/print/portal/${data.id}`} target="_blank" rel="noreferrer">
            <Button variant="secondary"><Printer size={14} /> Imprimir / PDF</Button>
          </a>
          {canEdit && (
            <Button variant="ghost" onClick={openEdit}>
              <Pencil size={14} /> Editar
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" onClick={cancelOrder} loading={cancelling}>
              <Trash2 size={14} /> Cancelar
            </Button>
          )}
          {canPay && methods.length > 0 && (
            <Button variant="secondary" onClick={() => setMethodsOpen(true)}>
              <Wallet size={14} /> Métodos de pago
            </Button>
          )}
          {canPay && (
            <Button onClick={openPaymentForm}>
              <Plus size={14} /> Notificar pago
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <Stat
          label={data.discountUSD > 0 ? 'Total con descuento' : 'Total del pedido'}
          value={formatUSD(effectiveTotal)}
          hint={
            data.discountUSD > 0
              ? <span className="text-success">Descuento: −{formatUSD(data.discountUSD)}</span>
              : undefined
          }
        />
        <Stat label="Pagado" value={formatUSD(data.paidUSD)} accent={data.paidUSD > 0} />
        <Stat label="Saldo pendiente" value={formatUSD(outstanding)} />
      </div>

      {data.discountUSD > 0 && (
        <div className="bg-success-subtle border border-success/30 rounded-md p-3 mb-4 text-sm">
          <div className="font-medium text-success">Descuento del distribuidor: −{formatUSD(data.discountUSD)}</div>
          {data.discountReason && <div className="text-xs text-text-secondary mt-1">{data.discountReason}</div>}
        </div>
      )}

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
          <FileUpload
            label="Comprobante de pago"
            hint="JPG, PNG o PDF. Máximo 5 MB."
            value={form.proofUrl || null}
            onChange={(url) => setForm({ ...form, proofUrl: url || '' })}
          />
          <Textarea
            label="Notas adicionales"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar pedido"
        description="Ajusta cantidades, agrega o quita productos. Sólo puedes editar antes de notificar el pago."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button loading={editSaving} onClick={submitEdit}>Guardar cambios</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              className="pl-9"
              placeholder="Buscar producto para agregar"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {productResults.length > 0 && (
              <ul className="absolute left-0 right-0 mt-1 z-10 bg-surface border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto shadow-lg">
                {productResults.map((p) => (
                  <li
                    key={p.id}
                    className="px-3 py-2 hover:bg-surface-2 cursor-pointer flex items-center justify-between"
                    onClick={() => addEditItem(p)}
                  >
                    <div>
                      <div className="text-sm">{p.name}</div>
                      <div className="text-xs text-text-muted font-mono">{p.sku} · stock {p.stock}</div>
                    </div>
                    <div className="text-sm font-mono text-accent">{formatUSD(p.priceUSD)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {Object.keys(editItems).length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted border border-border rounded-md">
              Aún no hay productos en el pedido.
            </div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-md">
              {Object.values(editItems).map((line) => (
                <li key={line.product.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{line.product.name}</div>
                    <div className="text-xs text-text-muted font-mono">{line.product.sku}</div>
                  </div>
                  <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-md p-1">
                    <button onClick={() => changeEditQty(line.product.id, -1)} className="p-1 text-text-secondary hover:text-text-primary">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-mono text-sm">{line.quantity}</span>
                    <button onClick={() => changeEditQty(line.product.id, 1)} className="p-1 text-text-secondary hover:text-text-primary">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="font-mono text-sm text-accent w-24 text-right">
                    {formatUSD(line.quantity * line.product.priceUSD)}
                  </div>
                </li>
              ))}
              <li className="px-4 py-2 flex items-center justify-between bg-surface-2">
                <span className="text-xs text-text-secondary uppercase tracking-wider">Total</span>
                <span className="font-mono text-accent">{formatUSD(editTotal)}</span>
              </li>
            </ul>
          )}

          <Textarea
            label="Notas para el distribuidor"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={methodsOpen}
        onOpenChange={setMethodsOpen}
        title="Métodos de pago disponibles"
        description="Elige uno de estos métodos, realiza el pago y luego notifícalo con el comprobante."
        size="md"
      >
        {methods.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-6">
            El distribuidor aún no ha cargado métodos de pago.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {methods.map((m) => (
              <li key={m.id} className="border border-border rounded-md p-4 bg-surface-2">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="font-medium text-text-primary">{m.label}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="info">{m.currency}</Badge>
                    <Badge>{labelMethodPortal(m.type)}</Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  {m.accountName && (
                    <MethodRow label="Titular" value={m.accountName} onCopy={copyToClipboard} />
                  )}
                  {m.accountNumber && (
                    <MethodRow label="Cuenta / ID" value={m.accountNumber} mono onCopy={copyToClipboard} />
                  )}
                  {m.bankName && <MethodRow label="Banco" value={m.bankName} onCopy={copyToClipboard} />}
                  {m.documentId && (
                    <MethodRow label="C.I./RIF" value={m.documentId} mono onCopy={copyToClipboard} />
                  )}
                </div>
                {m.instructions && (
                  <div className="mt-3 text-xs text-text-muted italic border-t border-border pt-2">
                    {m.instructions}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}

function MethodRow({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy: (v: string, l: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-sm text-text-primary truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        <button onClick={() => onCopy(value, label)} className="text-text-muted hover:text-accent flex-shrink-0 p-1" title="Copiar">
          <Copy size={12} />
        </button>
      </div>
    </div>
  )
}

function labelMethodPortal(t: string): string {
  const map: Record<string, string> = {
    zelle: 'Zelle',
    binance: 'Binance',
    bank_transfer_usd: 'Transf. USD',
    bank_transfer_bs: 'Transf. Bs',
    cash_usd: 'Efectivo USD',
    cash_bs: 'Efectivo Bs',
    other: 'Otro',
  }
  return map[t] || t
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
