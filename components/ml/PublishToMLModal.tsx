'use client'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Store, CheckCircle2, XCircle, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Selected {
  id: string
  name: string
  sku: string
  priceUSD: number
  stock: number
  mlItemId?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  selected: Selected[]
  onDone: () => void
}

type Stage = 'review' | 'publishing' | 'done'

interface PredictionMap {
  [productId: string]: {
    categoryId: string | null
    categoryName: string
    predictionScore: number
  }
}

interface ProductResult {
  productId: string
  productName: string
  ok: boolean
  mlItemId?: string
  permalink?: string
  error?: string
  skipped?: string
}

export function PublishToMLModal({ open, onOpenChange, selected, onDone }: Props) {
  const [stage, setStage] = useState<Stage>('review')
  const [predictions, setPredictions] = useState<PredictionMap>({})
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({})
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<ProductResult[]>([])

  // Filtrar los que ya están publicados
  const eligible = selected.filter((p) => !p.mlItemId && p.stock > 0)
  const alreadyPublished = selected.filter((p) => p.mlItemId).length
  const noStock = selected.filter((p) => !p.mlItemId && p.stock <= 0).length

  useEffect(() => {
    if (!open) return
    setStage('review')
    setResults([])
    setCategoryOverrides({})
    if (eligible.length === 0) return
    setLoadingPredictions(true)
    fetch('/api/ml/predict-category', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productIds: eligible.map((p) => p.id) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.predictions) setPredictions(d.predictions)
      })
      .catch((e) => {
        console.error(e)
        toast.error('No se pudieron predecir categorías')
      })
      .finally(() => setLoadingPredictions(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const publish = async () => {
    setPublishing(true)
    setStage('publishing')
    try {
      const r = await fetch('/api/ml/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: eligible.map((p) => ({
            productId: p.id,
            categoryId: categoryOverrides[p.id] || predictions[p.id]?.categoryId || undefined,
          })),
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(typeof d.error === 'string' ? d.error : 'Error publicando')
        setStage('review')
        setPublishing(false)
        return
      }
      setResults(d.results || [])
      setStage('done')
      const publishedCount = (d.results || []).filter((x: ProductResult) => x.ok).length
      if (publishedCount > 0) toast.success(`${publishedCount} publicados`)
    } catch (e) {
      console.error(e)
      toast.error('Error de conexión')
      setStage('review')
    } finally {
      setPublishing(false)
    }
  }

  const close = () => {
    if (publishing) return
    onOpenChange(false)
    if (stage === 'done') onDone()
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={
        stage === 'done'
          ? 'Publicación terminada'
          : `Publicar ${eligible.length} ${eligible.length === 1 ? 'producto' : 'productos'} en MercadoLibre`
      }
      description={
        stage === 'review'
          ? 'Revisa la categoría sugerida para cada producto. Puedes editarla si no es correcta.'
          : stage === 'publishing'
          ? 'Publicando en ML — no cierres esta ventana…'
          : 'Resultados de la publicación.'
      }
      size="lg"
      footer={
        stage === 'review' ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              loading={publishing}
              disabled={eligible.length === 0 || loadingPredictions}
              onClick={publish}
            >
              <Store size={14} /> Publicar {eligible.length}
            </Button>
          </>
        ) : stage === 'publishing' ? null : (
          <Button onClick={close}>Cerrar</Button>
        )
      }
    >
      {stage === 'review' && (
        <>
          {(alreadyPublished > 0 || noStock > 0) && (
            <div className="bg-warning-subtle border border-warning/30 rounded-md p-3 mb-4 text-xs text-text-primary flex gap-2">
              <AlertCircle size={14} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                {alreadyPublished > 0 && (
                  <div>{alreadyPublished} {alreadyPublished === 1 ? 'producto ya está publicado' : 'productos ya están publicados'} en ML y no se enviarán de nuevo.</div>
                )}
                {noStock > 0 && (
                  <div>{noStock} sin stock — se omiten. ML requiere stock &gt; 0.</div>
                )}
              </div>
            </div>
          )}

          {loadingPredictions ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center">
              <Loader2 size={14} className="animate-spin" /> Consultando categorías con ML…
            </div>
          ) : eligible.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-6">
              Ninguno de los productos seleccionados es elegible.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border border border-border rounded-md">
              {eligible.map((p) => {
                const pred = predictions[p.id]
                const current = categoryOverrides[p.id] ?? (pred?.categoryId || '')
                const showLowConfidence = pred && pred.predictionScore < 0.5 && !categoryOverrides[p.id]
                return (
                  <div key={p.id} className="p-3 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-text-primary">{p.name}</div>
                        <div className="text-xs text-text-muted font-mono">
                          {p.sku} · ${p.priceUSD.toFixed(2)} · stock {p.stock}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 min-w-[220px]">
                        <input
                          value={current}
                          onChange={(e) => setCategoryOverrides((prev) => ({ ...prev, [p.id]: e.target.value.trim() }))}
                          placeholder="MLV..."
                          className="input-base font-mono text-xs w-full"
                        />
                      </div>
                    </div>
                    {pred?.categoryName && (
                      <div className="text-[11px] text-text-muted">
                        Sugerencia ML: {pred.categoryName}
                        {pred.predictionScore > 0 && ` · ${Math.round(pred.predictionScore * 100)}% match`}
                        {showLowConfidence && (
                          <span className="text-warning ml-2">· confianza baja, revisá</span>
                        )}
                      </div>
                    )}
                    {!pred?.categoryId && !categoryOverrides[p.id] && (
                      <div className="text-[11px] text-danger">
                        ⚠ ML no sugirió categoría. Ingresá una manualmente (ej: MLV1055) o mejorá el nombre del producto.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {stage === 'publishing' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 size={32} className="animate-spin text-accent" />
          <div className="text-sm text-text-secondary">
            Publicando {eligible.length} {eligible.length === 1 ? 'producto' : 'productos'} en MercadoLibre…
          </div>
          <div className="text-xs text-text-muted">Esto puede tardar hasta 1 minuto según la cantidad.</div>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div
              key={r.productId}
              className={cn(
                'border rounded-md p-3 flex items-start gap-3',
                r.ok
                  ? 'bg-success-subtle border-success/30'
                  : r.skipped
                  ? 'bg-surface-2 border-border'
                  : 'bg-danger-subtle border-danger/30',
              )}
            >
              {r.ok ? (
                <CheckCircle2 size={16} className="text-success flex-shrink-0 mt-0.5" />
              ) : r.skipped ? (
                <AlertCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary">{r.productName}</div>
                {r.ok ? (
                  <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{r.mlItemId}</span>
                    {r.permalink && (
                      <a href={r.permalink} target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                        Ver publicación <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary mt-0.5">{r.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
