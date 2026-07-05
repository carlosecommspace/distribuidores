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
    eurExchangeRate: 0,
    autoUpdateEurRate: true,
    primaryCurrency: 'USD' as 'USD' | 'EUR',
    defaultMargin: 0.15,
    waPhoneNumber: '',
    waRetentionDays: 90,
    waAiEnabled: false,
    waAiPrompt: '',
    mlAutoAnswer: false,
    mlAutoSync: true,
    mlSyncInterval: 60,
    notifLowStock: true,
    notifNewQuestion: true,
    notifNewSale: false,
  })
  const [rateLogs, setRateLogs] = useState<Array<{ rate: number; source: string; currency?: string; createdAt: string }>>([])
  const [refreshingUSD, setRefreshingUSD] = useState(false)
  const [refreshingEUR, setRefreshingEUR] = useState(false)
  const [historyTab, setHistoryTab] = useState<'USD' | 'EUR'>('USD')

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

  const refreshRate = async (currency: 'USD' | 'EUR') => {
    if (currency === 'USD') setRefreshingUSD(true)
    else setRefreshingEUR(true)
    const r = await fetch('/api/bcv', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currency }),
    })
    if (currency === 'USD') setRefreshingUSD(false)
    else setRefreshingEUR(false)
    if (!r.ok) {
      toast.error(`No se pudo obtener la tasa BCV ${currency}`)
      return
    }
    const d = await r.json()
    setSettings((s) =>
      currency === 'USD'
        ? { ...s, exchangeRate: d.rate }
        : { ...s, eurExchangeRate: d.rate },
    )
    // Refresh history
    const logs = await fetch('/api/settings').then((r) => r.json()).then((x) => x.rateLogs || [])
    setRateLogs(logs)
    toast.success(`${currency}: Bs ${d.rate.toFixed(2)}`)
  }

  const filteredLogs = rateLogs.filter((l) => (l.currency || 'USD') === historyTab)

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
          <CardBody className="flex flex-col gap-6">
            <Select
              label="Moneda principal para precios"
              value={settings.primaryCurrency}
              onChange={(e) => setSettings({ ...settings, primaryCurrency: e.target.value as 'USD' | 'EUR' })}
              options={[
                { value: 'USD', label: 'Dólar (USD)' },
                { value: 'EUR', label: 'Euro (EUR)' },
              ]}
            />
            <div className="text-xs text-text-muted -mt-3">
              Esta moneda se usa para calcular automáticamente el precio Bs de tus productos.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RateBlock
                code="USD"
                label="Dólar (USD)"
                rate={settings.exchangeRate}
                auto={settings.autoUpdateRate}
                isPrimary={settings.primaryCurrency === 'USD'}
                refreshing={refreshingUSD}
                onRateChange={(v) => setSettings({ ...settings, exchangeRate: v })}
                onAutoChange={(v) => setSettings({ ...settings, autoUpdateRate: v })}
                onRefresh={() => refreshRate('USD')}
              />
              <RateBlock
                code="EUR"
                label="Euro (EUR)"
                rate={settings.eurExchangeRate}
                auto={settings.autoUpdateEurRate}
                isPrimary={settings.primaryCurrency === 'EUR'}
                refreshing={refreshingEUR}
                onRateChange={(v) => setSettings({ ...settings, eurExchangeRate: v })}
                onAutoChange={(v) => setSettings({ ...settings, autoUpdateEurRate: v })}
                onRefresh={() => refreshRate('EUR')}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-text-secondary">Historial de tasas</span>
                <div className="flex gap-1 p-1 bg-surface-2 border border-border rounded-md">
                  {(['USD', 'EUR'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHistoryTab(c)}
                      className={
                        'px-2.5 py-1 text-xs rounded ' +
                        (historyTab === c ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary')
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {filteredLogs.length === 0 ? (
                <div className="text-xs text-text-muted py-6 text-center border border-border rounded-md">
                  Sin registros para {historyTab}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-border rounded-md">
                  <Table>
                    <THead><TR><TH>Fecha</TH><TH>Fuente</TH><TH className="text-right">Tasa</TH></TR></THead>
                    <TBody>
                      {filteredLogs.slice(0, 20).map((l, i) => (
                        <TR key={i}>
                          <TD className="text-xs text-text-secondary">{formatDateTime(l.createdAt)}</TD>
                          <TD className="text-xs text-text-muted uppercase">{l.source}</TD>
                          <TD className="text-right font-mono">Bs {l.rate.toFixed(2)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </div>
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
          <CardHeader><CardTitle>Métodos de pago del portal</CardTitle></CardHeader>
          <CardBody className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-text-secondary">
              Configura Zelle, Binance, transferencias y otros métodos que tus clientes verán al pagar desde el portal.
            </p>
            <a href="/settings/payment-methods">
              <Button variant="secondary">Administrar</Button>
            </a>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>WhatsApp</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Input
              label="Número de negocio"
              placeholder="+58412..."
              hint="Solo referencia visual. La conexión real se hace en /whatsapp con QR."
              value={settings.waPhoneNumber}
              onChange={(e) => setSettings({ ...settings, waPhoneNumber: e.target.value })}
            />

            <Select
              label="Retención de mensajes"
              value={String(settings.waRetentionDays)}
              onChange={(e) => setSettings({ ...settings, waRetentionDays: Number(e.target.value) })}
              options={[
                { value: '0', label: 'Modo privado (no guardar contenido)' },
                { value: '30', label: '30 días' },
                { value: '90', label: '90 días (recomendado)' },
                { value: '180', label: '180 días' },
                { value: '365', label: '1 año' },
                { value: '-1', label: 'Sin límite' },
              ]}
            />
            <div className="text-xs text-text-muted -mt-2">
              Los mensajes viejos se borran automáticamente cada día. En modo privado sólo guardamos metadata (contacto, fecha) — desactiva bot IA y búsqueda.
            </div>

            <Switch
              checked={settings.waAiEnabled}
              onCheckedChange={(v) => setSettings({ ...settings, waAiEnabled: v })}
              label="Chatbot IA disponible"
              hint="Cuando está activo, cada conversación tiene un toggle para dejar que la IA responda"
            />

            {settings.waAiEnabled && (
              <div>
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">
                  Prompt del bot (opcional)
                </label>
                <textarea
                  className="input-base min-h-[100px] resize-y"
                  placeholder="Eres el asistente de mi distribuidora. Responde en español, tono profesional pero cercano..."
                  value={settings.waAiPrompt}
                  onChange={(e) => setSettings({ ...settings, waAiPrompt: e.target.value })}
                />
                <div className="text-xs text-text-muted mt-1">
                  Si lo dejas vacío, usa un prompt genérico razonable.
                </div>
              </div>
            )}
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

function RateBlock({
  code,
  label,
  rate,
  auto,
  isPrimary,
  refreshing,
  onRateChange,
  onAutoChange,
  onRefresh,
}: {
  code: 'USD' | 'EUR'
  label: string
  rate: number
  auto: boolean
  isPrimary: boolean
  refreshing: boolean
  onRateChange: (v: number) => void
  onAutoChange: (v: boolean) => void
  onRefresh: () => void
}) {
  return (
    <div className={'border rounded-md p-4 flex flex-col gap-3 ' + (isPrimary ? 'border-accent-border bg-accent-subtle' : 'border-border bg-surface-2')}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-text-secondary">{label}</span>
        {isPrimary && (
          <span className="text-[10px] uppercase tracking-wider text-accent font-medium">Principal</span>
        )}
      </div>
      <div className="flex gap-2 items-end">
        <Input
          label={`Tasa BCV ${code}`}
          mono
          type="number"
          step="0.0001"
          value={rate}
          onChange={(e) => onRateChange(Number(e.target.value))}
        />
        <Button variant="secondary" loading={refreshing} onClick={onRefresh} className="flex-shrink-0">
          <RefreshCw size={14} /> Actualizar
        </Button>
      </div>
      <Switch
        checked={auto}
        onCheckedChange={onAutoChange}
        label="Actualización automática"
        hint="Cada hora consulta la tasa oficial"
      />
    </div>
  )
}
