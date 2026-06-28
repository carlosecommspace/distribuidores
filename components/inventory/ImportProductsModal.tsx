'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { Download, Upload } from 'lucide-react'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; error: string }>
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}

export function ImportProductsModal({ open, onOpenChange, onDone }: Props) {
  const [csv, setCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setCsv('')
    setResult(null)
  }

  const onFileSelected = async (file: File) => {
    const text = await file.text()
    setCsv(text)
  }

  const run = async () => {
    if (!csv.trim()) {
      toast.error('Pega o sube el contenido del CSV')
      return
    }
    setImporting(true)
    const r = await fetch('/api/inventory/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv }),
    })
    setImporting(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error importando')
      return
    }
    const data = (await r.json()) as ImportResult
    setResult(data)
    toast.success(`${data.created + data.updated} productos procesados`)
    onDone?.()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}
      title="Importar productos"
      description="Carga tu inventario masivamente desde un CSV. Usa el SKU como identificador único."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button loading={importing} onClick={run}>Importar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <a href="/api/inventory/template" download>
            <Button variant="secondary" size="sm"><Download size={12} /> Descargar plantilla</Button>
          </a>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFileSelected(f)
              }}
            />
            <span className="inline-flex items-center gap-1.5 px-3 h-8 text-xs bg-surface-2 border border-border rounded-md cursor-pointer hover:bg-surface-3">
              <Upload size={12} /> Subir archivo
            </span>
          </label>
        </div>

        <div className="text-xs text-text-muted leading-relaxed">
          Columnas: <span className="font-mono">sku, nombre, descripcion, categoria_slug, marca, unidad, costo_usd, precio_usd, stock, stock_min, stock_max, activo</span>.{' '}
          <strong className="text-text-secondary">sku</strong> y <strong className="text-text-secondary">precio_usd</strong> son obligatorios.
          Si el SKU ya existe, se actualiza. <span className="font-mono">categoria_slug</span> debe coincidir con una categoría existente (créalas o impórtalas primero en{' '}
          <a href="/categories" className="text-accent">/categories</a>).
        </div>

        <Textarea
          label="Contenido CSV"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="min-h-[260px] font-mono text-xs"
          placeholder="sku,nombre,descripcion,categoria_slug,marca,unidad,costo_usd,precio_usd,stock,stock_min,stock_max,activo&#10;ACE-001,Aceite Mobil 1 5W-30 1L,,lubricantes,Mobil,unidad,8.50,12.50,24,6,,si"
        />

        {result && (
          <div className="border border-border rounded-md p-4 bg-surface-2 text-sm">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <StatBox label="Creados" value={result.created} tone="success" />
              <StatBox label="Actualizados" value={result.updated} tone="info" />
              <StatBox label="Saltados" value={result.skipped} tone="neutral" />
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="text-xs text-danger mb-1.5">{result.errors.length} errores:</div>
                <ul className="text-xs text-text-secondary max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 30).map((e, i) => (
                    <li key={i}>· fila {e.row}: {e.error}</li>
                  ))}
                  {result.errors.length > 30 && (
                    <li className="text-text-muted">... y {result.errors.length - 30} más</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: 'success' | 'info' | 'neutral' }) {
  const color =
    tone === 'success' ? 'text-success' :
    tone === 'info' ? 'text-info' : 'text-text-secondary'
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className={`font-mono text-lg ${color}`}>{value}</div>
    </div>
  )
}
