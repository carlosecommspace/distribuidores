'use client'
import { useState } from 'react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Sparkles, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'

interface Insight {
  type: 'opportunity' | 'warning' | 'action' | 'positive'
  title: string
  detail: string
  action?: string
}

interface Response {
  generatedAt: string
  period: string
  summary: string
  insights: Insight[]
  meta: {
    salesInPeriod: number
    revenueInPeriodUSD: number
  }
}

interface Props {
  period?: string
  from?: string
  to?: string
}

const TYPE_META: Record<Insight['type'], { icon: React.ElementType; label: string; className: string; iconClass: string }> = {
  opportunity: {
    icon: TrendingUp,
    label: 'Oportunidad',
    className: 'bg-info-subtle border-info/30',
    iconClass: 'text-info',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Atención',
    className: 'bg-warning-subtle border-warning/30',
    iconClass: 'text-warning',
  },
  action: {
    icon: ArrowRight,
    label: 'Acción',
    className: 'bg-accent-subtle border-accent-border',
    iconClass: 'text-accent',
  },
  positive: {
    icon: CheckCircle2,
    label: 'Va bien',
    className: 'bg-success-subtle border-success/30',
    iconClass: 'text-success',
  },
}

export function AiInsights({ period, from, to }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Response | null>(null)

  const generate = async () => {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {}
      if (from) {
        payload.from = from
        if (to) payload.to = to
      } else {
        payload.period = period
      }
      const r = await fetch('/api/analytics/insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(typeof d.error === 'string' ? d.error : 'No se pudieron generar los insights')
        setLoading(false)
        return
      }
      setData(d as Response)
    } catch (e) {
      toast.error('Error de conexión')
      console.error('[ai-insights]', e)
    } finally {
      setLoading(false)
    }
  }

  const empty = data && (!data.insights || data.insights.length === 0)

  return (
    <Card className="mb-6 relative overflow-hidden">
      {/* Sutil gradiente decorativo en la esquina */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />

      <CardBody className="relative">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md bg-accent-subtle border border-accent-border flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-accent" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base md:text-lg font-semibold text-text-primary flex items-center gap-2 flex-wrap">
                Insights con IA
                {data && (
                  <span className="text-[11px] font-mono text-text-muted font-normal">
                    · {formatRelative(data.generatedAt)}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {data
                  ? 'Análisis basado en tus ventas, inventario y clientes del periodo seleccionado.'
                  : 'Analiza tus datos con IA y obtén oportunidades, alertas y acciones concretas.'}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant={data ? 'secondary' : 'primary'}
            loading={loading}
            onClick={generate}
          >
            {data ? <><RefreshCw size={13} /> Actualizar</> : <><Sparkles size={13} /> Generar insights</>}
          </Button>
        </div>

        {data && data.summary && (
          <div className="text-sm text-text-primary bg-surface-2 border border-border rounded-md p-3 mb-4">
            {data.summary}
          </div>
        )}

        {data && !empty && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.insights.map((ins, i) => {
              const meta = TYPE_META[ins.type] || TYPE_META.action
              const Icon = meta.icon
              return (
                <div
                  key={i}
                  className={cn('border rounded-md p-3 flex flex-col gap-2', meta.className)}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn('h-6 w-6 rounded-full bg-black/20 flex items-center justify-center', meta.iconClass)}>
                      <Icon size={12} />
                    </div>
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider', meta.iconClass)}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-text-primary leading-tight">
                    {ins.title}
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed">
                    {ins.detail}
                  </div>
                  {ins.action && (
                    <div className="text-xs text-text-primary bg-black/25 border border-border rounded px-2 py-1.5 mt-1 flex items-start gap-1.5">
                      <ArrowRight size={11} className="mt-0.5 flex-shrink-0 text-accent" />
                      <span>{ins.action}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {empty && (
          <div className="text-sm text-text-muted text-center py-6">
            No hay suficiente información para generar insights en este periodo. Prueba con un rango más amplio.
          </div>
        )}
      </CardBody>
    </Card>
  )
}
