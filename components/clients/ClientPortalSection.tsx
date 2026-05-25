'use client'
import { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { Key, Tag, Trash2 } from 'lucide-react'

interface Props {
  clientId: string
  initialPriceListId: string | null
  portalUser: { id: string; email: string; name?: string | null } | null
}

interface PriceList {
  id: string
  name: string
  isActive: boolean
}

export function ClientPortalSection({ clientId, initialPriceListId, portalUser }: Props) {
  const [priceListId, setPriceListId] = useState(initialPriceListId || '')
  const [lists, setLists] = useState<PriceList[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: portalUser?.email || '', password: '', name: portalUser?.name || '' })
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState(portalUser)

  useEffect(() => {
    fetch('/api/price-lists').then((r) => r.json()).then(setLists)
  }, [])

  const onChangePriceList = async (value: string) => {
    setPriceListId(value)
    const r = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priceListId: value || null }),
    })
    if (!r.ok) toast.error('Error guardando')
    else toast.success(value ? 'Lista asignada' : 'Lista desvinculada')
  }

  const onSavePortal = async () => {
    if (!form.email || !form.password) {
      toast.error('Email y contraseña son requeridos')
      return
    }
    setSaving(true)
    const r = await fetch(`/api/clients/${clientId}/portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error guardando credenciales')
      return
    }
    toast.success(current ? 'Credenciales actualizadas' : 'Acceso al portal creado')
    setCurrent({ id: current?.id || 'new', email: form.email, name: form.name })
    setForm({ ...form, password: '' })
    setOpen(false)
  }

  const onRevoke = async () => {
    if (!confirm('¿Revocar el acceso al portal de este cliente?')) return
    const r = await fetch(`/api/clients/${clientId}/portal`, { method: 'DELETE' })
    if (!r.ok) {
      toast.error('Error revocando acceso')
      return
    }
    toast.success('Acceso revocado')
    setCurrent(null)
    setForm({ email: '', password: '', name: '' })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Acceso al portal</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Lista de precio
            </div>
            <Select
              value={priceListId}
              onChange={(e) => onChangePriceList(e.target.value)}
              options={[
                { value: '', label: 'Sin lista (precios base)' },
                ...lists.filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
              <Key size={12} /> Credenciales
            </div>
            {current ? (
              <div className="space-y-3">
                <div className="bg-surface-2 border border-border rounded-md p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm text-text-primary truncate">{current.email}</div>
                    <Badge tone="success" className="mt-1">Portal activo</Badge>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="ghost" onClick={() => setOpen(true)}>Cambiar credenciales</Button>
                  <Button variant="ghost" onClick={onRevoke}>
                    <Trash2 size={14} /> Revocar
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setOpen(true)}>
                <Key size={14} /> Crear acceso al portal
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={current ? 'Cambiar credenciales' : 'Crear acceso al portal'}
        description="El cliente podrá entrar al portal con estas credenciales para hacer pedidos."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSavePortal} loading={saving}>Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="cliente@empresa.com"
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={current ? 'Nueva contraseña' : 'Mínimo 6 caracteres'}
            required
          />
          <Input
            label="Nombre (opcional)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
      </Modal>
    </>
  )
}
