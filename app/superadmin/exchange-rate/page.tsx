'use client'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils'
import { RefreshCw, Save, DollarSign, Euro, History } from 'lucide-react'

interface Global {
  id: string
  usdRate: number
  eurRate: number
  source: string
  usdUpdatedAt: string | null
  eurUpdatedAt: string | null
  updatedAt: string
}

interface Log {
  rate: number
  source: string
  currency?: string
  createdAt: string
}

export default function SuperadminExchangeRatePage() {
  const [loading, setLoading] = useState(true)
  const [global, setGlobal] = useState<Global | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [usdInput, setUsdInput] = useState<string>('')
  const [eurInput, setEurInput] = useState<string>('')
  const [savingUsd, setSavingUsd] = useState(false)
  const [savingEur, setSavingEur] = useState(false)
  const [refreshingUsd, setRefreshingUsd] = useState(false)
  const [refreshingEur, setRefreshingEur] = useState(false)
  const [tab, setTab] = useState<'USD' | 'EUR'>('USD')

  const load = async () => {
    const r = await fetch('/api/superadmin/exchange-rate')
    if (!r.ok) return
    const d = await r.json()
    setGlobal(d.global)
    setLogs(d.logs || [])
    setUsdInput(String(d.global?.usdRate ?? ''))
    setEurInput(String(d.global?.eurRate ?? ''))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const post = async (payload: unknown) => {
    const r = await fetch('/api/superadmin/exchange-rate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error')
      return null
    }
    return r.json()
  }

  const saveManual = async (currency: 'USD' | 'EUR') => {
    if (currency === 'USD') setSavingUsd(true)
    else setSavingEur(true)
    const rate = currency === 'USD' ? Number(usdInput) : Number(eurInput)
    if (!rate || rate <= 0) {
      toast.error('Ingresá un valor válido')
      if (currency === 'USD') setSavingUsd(false)
      else setSavingEur(false)
      return
    }
    const key = currency === 'USD' ? 'usdRate' : 'eurRate'
    const r = await post({ action: 'manual', [key]: rate })
    if (currency === 'USD') setSavingUsd(false)
    else setSavingEur(false)
    if (r) {
      toast.success(`${currency}: Bs ${rate.toFixed(4)} propagado a todos los merchants`)
      load()
    }
  }

  const refresh = async (currency: 'USD' | 'EUR') => {
    if (currency === 'USD') setRefreshingUsd(true)
    else setRefreshingEur(true)
    const r = await post({ action: 'refresh', currency })
    if (currency === 'USD') setRefreshingUsd(false)
    else setRefreshingEur(false)
    if (r) {
      const rate = currency === 'USD' ? r.global?.usdRate : r.global?.eurRate
      toast.success(`Tasa BCV ${currency}: Bs ${rate?.toFixed(4)}`)
      load()
    }
  }

  const filteredLogs = logs.filter((l) => (l.currency || 'USD') === tab)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Tasa de cambio global</h1>
        <p className="text-sm text-text-secondary mt-1">
          Los valores que setees acá se propagan automáticamente a todos los merchants.
          Ellos no pueden cambiar la tasa desde su panel.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RateEditor
            icon={<DollarSign size={16} />}
            label="Dólar (USD)"
            currentValue={global?.usdRate ?? 0}
            updatedAt={global?.usdUpdatedAt ?? null}
            input={usdInput}
            onInput={setUsdInput}
            onSave={() => saveManual('USD')}
            onRefresh={() => refresh('USD')}
            saving={savingUsd}
            refreshing={refreshingUsd}
          />
          <RateEditor
            icon={<Euro size={16} />}
            label="Euro (EUR)"
            currentValue={global?.eurRate ?? 0}
            updatedAt={global?.eurUpdatedAt ?? null}
            input={eurInput}
            onInput={setEurInput}
            onSave={() => saveManual('EUR')}
            onRefresh={() => refresh('EUR')}
            saving={savingEur}
            refreshing={refreshingEur}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History size={16} /> Historial</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md self-start">
            {(['USD', 'EUR'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTab(c)}
                className={
                  'px-3 py-1 text-xs rounded ' +
                  (tab === c ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary')
                }
              >
                {c}
              </button>
            ))}
          </div>
          {filteredLogs.length === 0 ? (
            <div className="text-xs text-text-muted py-6 text-center border border-border rounded-md">
              Sin registros para {tab}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-border rounded-md">
              <Table>
                <THead><TR><TH>Fecha</TH><TH>Fuente</TH><TH className="text-right">Tasa</TH></TR></THead>
                <TBody>
                  {filteredLogs.slice(0, 60).map((l, i) => (
                    <TR key={i}>
                      <TD className="text-xs text-text-secondary">{formatDateTime(l.createdAt)}</TD>
                      <TD className="text-xs text-text-muted uppercase">{l.source}</TD>
                      <TD className="text-right font-mono">Bs {l.rate.toFixed(4)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function RateEditor({
  icon,
  label,
  currentValue,
  updatedAt,
  input,
  onInput,
  onSave,
  onRefresh,
  saving,
  refreshing,
}: {
  icon: React.ReactNode
  label: string
  currentValue: number
  updatedAt: string | null
  input: string
  onInput: (v: string) => void
  onSave: () => void
  onRefresh: () => void
  saving: boolean
  refreshing: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon} {label}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <div className="bg-accent-subtle border border-accent-border rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-text-secondary">Vigente</div>
          <div className="font-mono text-2xl text-accent mt-1">Bs {currentValue.toFixed(4)}</div>
          {updatedAt && (
            <div className="text-xs text-text-muted mt-1">Actualizado {formatDateTime(updatedAt)}</div>
          )}
        </div>
        <Input
          label="Nuevo valor manual"
          type="number"
          step="0.0001"
          mono
          value={input}
          onChange={(e) => onInput(e.target.value)}
        />
        <div className="flex gap-2">
          <Button loading={saving} onClick={onSave} className="flex-1">
            <Save size={14} /> Guardar
          </Button>
          <Button variant="secondary" loading={refreshing} onClick={onRefresh} className="flex-1">
            <RefreshCw size={14} /> Refrescar BCV
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
