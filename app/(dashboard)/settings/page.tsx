'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<{ name?: string; company?: string; phone?: string; email?: string }>({})
  const [settings, setSettings] = useState({
    exchangeRate: 0,
    autoUpdateRate: true,
    defaultMargin: 0.15,
    waPhoneNumber: '',
    mlAutoAnswer: false,
    mlAutoSync: true,
    mlSyncInterval: 60,
    notifLowStock: true,
    notifNewQuestion: true,
    notifNewSale: false,
  })
  const [rateLogs, setRateLogs] = useState<Array<{ rate: number; source: string; createdAt: string }>>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => {
      setUser({ name: d.user?.name || '', company: d.user?.company || '', phone: d.user?.phone || '', email: d.user?.email })
      if (d.settings) {
        setSettings({ ...settings, ...d.settings })
      }
      setRateLogs(d.rateLogs || [])
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user: { name: user.name, company: user.company, phone: user.phone },
        settings,
      }),
    })
    setSaving(false)
    if (!r.ok) toast.error('Error guardando configuración')
    else toast.success('Configuración guardada')
  }

  const refreshRate = async () => {
    setRefreshing(true)
    const r = await fetch('/api/bcv', { method: 'POST' })
    setRefreshing(false)
    if (!r.ok) {
      toast.error('No se pudo obtener la tasa BCV')
      return
    }
    const d = await r.json()
    setSettings((s) => ({ ...s, exchangeRate: d.rate }))
    toast.success(`Tasa actualizada: Bs ${d.rate}`)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Configuración" />
        <div className="flex flex-col gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Configuración"
        actions={<Button loading={saving} onClick={save}>Guardar cambios</Button>}
      />

      <div className="flex flex-col gap-6 max-w-4xl">
        <Card>
          <CardHeader><CardTitle>Mi empresa</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre" value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} />
            <Input label="Empresa" value={user.company || ''} onChange={(e) => setUser({ ...user, company: e.target.value })} />
            <Input label="Email" value={user.email || ''} disabled />
            <Input label="Teléfono" value={user.phone || ''} onChange={(e) => setUser({ ...user, phone: e.target.value })} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tasa de cambio</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <Input
                label="Tasa BCV actual"
                mono
                type="number"
                step="0.01"
                value={settings.exchangeRate}
                onChange={(e) => setSettings({ ...settings, exchangeRate: Number(e.target.value) })}
              />
              <Button variant="secondary" loading={refreshing} onClick={refreshRate}>
                <RefreshCw size={14} /> Actualizar ahora
              </Button>
            </div>
            <Switch
              checked={settings.autoUpdateRate}
              onCheckedChange={(v) => setSettings({ ...settings, autoUpdateRate: v })}
              label="Actualización automática diaria"
              hint="Cada hora el sistema consulta la tasa oficial"
            />
            {rateLogs.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Últimas tasas</div>
                <div className="max-h-64 overflow-y-auto border border-border rounded-md">
                  <Table>
                    <THead><TR><TH>Fecha</TH><TH>Fuente</TH><TH className="text-right">Tasa</TH></TR></THead>
                    <TBody>
                      {rateLogs.slice(0, 12).map((l, i) => (
                        <TR key={i}>
                          <TD className="text-xs text-text-secondary">{formatDateTime(l.createdAt)}</TD>
                          <TD className="text-xs text-text-muted uppercase">{l.source}</TD>
                          <TD className="text-right font-mono">Bs {l.rate.toFixed(2)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>MercadoLibre</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Switch
              checked={settings.mlAutoSync}
              onCheckedChange={(v) => setSettings({ ...settings, mlAutoSync: v })}
              label="Sincronización automática"
              hint="Envía precios y stock a ML en cada ciclo"
            />
            <Select
              label="Intervalo de sincronización"
              value={String(settings.mlSyncInterval)}
              onChange={(e) => setSettings({ ...settings, mlSyncInterval: Number(e.target.value) })}
              options={[
                { value: '15', label: 'Cada 15 minutos' },
                { value: '30', label: 'Cada 30 minutos' },
                { value: '60', label: 'Cada hora' },
                { value: '180', label: 'Cada 3 horas' },
              ]}
            />
            <Switch
              checked={settings.mlAutoAnswer}
              onCheckedChange={(v) => setSettings({ ...settings, mlAutoAnswer: v })}
              label="Respuesta automática con IA"
              hint="Las preguntas se responden con Claude sin intervención humana"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>WhatsApp</CardTitle></CardHeader>
          <CardBody>
            <Input
              label="Número de negocio"
              placeholder="+58412..."
              value={settings.waPhoneNumber}
              onChange={(e) => setSettings({ ...settings, waPhoneNumber: e.target.value })}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notificaciones</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Switch
              checked={settings.notifLowStock}
              onCheckedChange={(v) => setSettings({ ...settings, notifLowStock: v })}
              label="Alerta de stock bajo"
              hint="Recibe email cuando un producto cae bajo su stock mínimo"
            />
            <Switch
              checked={settings.notifNewQuestion}
              onCheckedChange={(v) => setSettings({ ...settings, notifNewQuestion: v })}
              label="Nueva pregunta en ML"
            />
            <Switch
              checked={settings.notifNewSale}
              onCheckedChange={(v) => setSettings({ ...settings, notifNewSale: v })}
              label="Nueva venta"
            />
          </CardBody>
        </Card>

        <div className="flex justify-end mb-12">
          <Button loading={saving} onClick={save}>Guardar cambios</Button>
        </div>
      </div>
    </div>
  )
}
