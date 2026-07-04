'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Switch } from '@/components/ui/Switch'
import { toast } from '@/components/ui/Toast'
import { ArrowLeft, Plus, Pencil, Trash2, Wallet } from 'lucide-react'

interface PaymentMethod {
  id: string
  type: string
  label: string
  accountName?: string | null
  accountNumber?: string | null
  bankName?: string | null
  documentId?: string | null
  currency: 'USD' | 'VES'
  instructions?: string | null
  isActive: boolean
  sortOrder: number
}

const emptyForm = {
  type: 'zelle',
  label: '',
  accountName: '',
  accountNumber: '',
  bankName: '',
  documentId: '',
  currency: 'USD',
  instructions: '',
  isActive: true,
  sortOrder: 0,
}

export default function PaymentMethodsPage() {
  const [items, setItems] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/payment-methods')
    setItems(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id)
    setForm({
      type: m.type,
      label: m.label,
      accountName: m.accountName || '',
      accountNumber: m.accountNumber || '',
      bankName: m.bankName || '',
      documentId: m.documentId || '',
      currency: m.currency,
      instructions: m.instructions || '',
      isActive: m.isActive,
      sortOrder: m.sortOrder,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.label.trim()) {
      toast.error('Etiqueta requerida')
      return
    }
    setSaving(true)
    const url = editingId ? `/api/payment-methods/${editingId}` : '/api/payment-methods'
    const method = editingId ? 'PATCH' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error('Error guardando')
      return
    }
    toast.success(editingId ? 'Método actualizado' : 'Método agregado')
    setOpen(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este método de pago?')) return
    const r = await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' })
    if (!r.ok) {
      toast.error('Error eliminando')
      return
    }
    toast.success('Eliminado')
    load()
  }

  return (
    <div>
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Configuración
      </Link>
      <PageHeader
        title="Métodos de pago"
        subtitle="Estas son las opciones que tus clientes verán al hacer pedidos desde el portal."
        actions={<Button onClick={openCreate}><Plus size={16} /> Nuevo método</Button>}
      />

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-4 flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Wallet size={32} />}
              title="No has agregado métodos de pago"
              description="Mientras no agregues ninguno, tus clientes no verán opciones de pago en el portal. Empieza agregando Zelle, Binance, transferencias u otros."
              action={<Button onClick={openCreate}><Plus size={16} /> Agregar método</Button>}
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((m) => (
                <li key={m.id} className="px-4 sm:px-5 py-4 flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-text-primary font-medium">{m.label}</span>
                      <Badge tone={m.isActive ? 'success' : 'neutral'}>
                        {m.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge>{labelType(m.type)}</Badge>
                      <Badge tone="info">{m.currency}</Badge>
                    </div>
                    <div className="text-xs text-text-secondary mt-1 space-y-0.5">
                      {m.accountName && <div>Titular: {m.accountName}</div>}
                      {m.accountNumber && <div className="font-mono">Cuenta: {m.accountNumber}</div>}
                      {m.bankName && <div>Banco: {m.bankName}</div>}
                      {m.documentId && <div className="font-mono">C.I./RIF: {m.documentId}</div>}
                    </div>
                    {m.instructions && (
                      <div className="mt-2 text-xs text-text-muted italic">{m.instructions}</div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(m)} className="text-text-muted hover:text-accent p-2">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => remove(m.id)} className="text-text-muted hover:text-danger p-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editingId ? 'Editar método' : 'Nuevo método de pago'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={save}>{editingId ? 'Guardar' : 'Agregar'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: 'zelle', label: 'Zelle' },
                { value: 'binance', label: 'Binance' },
                { value: 'bank_transfer_usd', label: 'Transferencia USD' },
                { value: 'bank_transfer_bs', label: 'Transferencia Bs' },
                { value: 'cash_usd', label: 'Efectivo USD' },
                { value: 'cash_bs', label: 'Efectivo Bs' },
                { value: 'other', label: 'Otro' },
              ]}
            />
            <Select
              label="Moneda"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              options={[{ value: 'USD', label: 'USD' }, { value: 'VES', label: 'Bolívares' }]}
            />
          </div>
          <Input
            label="Etiqueta"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Ej. Zelle Personal · Cuenta Banesco"
            required
          />
          <Input
            label="Titular"
            value={form.accountName}
            onChange={(e) => setForm({ ...form, accountName: e.target.value })}
            placeholder="Nombre del titular de la cuenta"
          />
          <Input
            label="Número de cuenta / Email / ID"
            mono
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            placeholder="Ej. 0134-... o pagos@empresa.com"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Banco"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Banesco, Mercantil, etc."
            />
            <Input
              label="C.I. / RIF"
              mono
              value={form.documentId}
              onChange={(e) => setForm({ ...form, documentId: e.target.value })}
              placeholder="V-12345678 o J-30000000-0"
            />
          </div>
          <Textarea
            label="Instrucciones (opcional)"
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="Ej. Al hacer el pago, envía captura por WhatsApp al 04121234567"
          />
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            label="Activo"
            hint="Sólo los activos se muestran a los clientes"
          />
        </div>
      </Modal>
    </div>
  )
}

function labelType(t: string): string {
  const map: Record<string, string> = {
    zelle: 'Zelle',
    binance: 'Binance',
    bank_transfer_usd: 'Transferencia USD',
    bank_transfer_bs: 'Transferencia Bs',
    cash_usd: 'Efectivo USD',
    cash_bs: 'Efectivo Bs',
    other: 'Otro',
  }
  return map[t] || t
}
