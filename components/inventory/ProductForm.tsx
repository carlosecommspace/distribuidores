'use client'
import { useState } from 'react'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'

export interface ProductFormValues {
  sku: string
  name: string
  description: string
  category: string
  brand: string
  unit: string
  costUSD: number
  priceUSD: number
  stock: number
  stockMin: number
  stockMax: number | null
  mlSyncEnabled: boolean
  mlCategoryId: string
  mlListingType: string
  isActive: boolean
  images: string[]
}

export const emptyProduct: ProductFormValues = {
  sku: '',
  name: '',
  description: '',
  category: '',
  brand: '',
  unit: 'unidad',
  costUSD: 0,
  priceUSD: 0,
  stock: 0,
  stockMin: 5,
  stockMax: null,
  mlSyncEnabled: false,
  mlCategoryId: '',
  mlListingType: 'gold_special',
  isActive: true,
  images: [],
}

export function ProductForm({
  value,
  onChange,
  rate,
}: {
  value: ProductFormValues
  onChange: (v: ProductFormValues) => void
  rate: number
}) {
  const [imgInput, setImgInput] = useState('')
  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => onChange({ ...value, [k]: v })
  const margin = value.costUSD > 0 ? ((value.priceUSD - value.costUSD) / value.costUSD) * 100 : 0
  const priceBs = value.priceUSD * rate

  return (
    <div className="flex flex-col gap-7">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="SKU" value={value.sku} onChange={(e) => set('sku', e.target.value)} placeholder="ACE-001" required />
        <Input label="Nombre" value={value.name} onChange={(e) => set('name', e.target.value)} required />
        <Textarea
          className="md:col-span-2"
          label="Descripción"
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <Input label="Categoría" value={value.category} onChange={(e) => set('category', e.target.value)} />
        <Input label="Marca" value={value.brand} onChange={(e) => set('brand', e.target.value)} />
        <Select
          label="Unidad"
          value={value.unit}
          onChange={(e) => set('unit', e.target.value)}
          options={[
            { value: 'unidad', label: 'Unidad' },
            { value: 'caja', label: 'Caja' },
            { value: 'pack', label: 'Pack' },
            { value: 'kg', label: 'Kilogramo' },
            { value: 'litro', label: 'Litro' },
            { value: 'metro', label: 'Metro' },
          ]}
        />
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-3">Precios</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="Costo USD"
            type="number"
            step="0.01"
            mono
            value={value.costUSD}
            onChange={(e) => set('costUSD', Number(e.target.value))}
          />
          <Input
            label="Precio USD"
            type="number"
            step="0.01"
            mono
            value={value.priceUSD}
            onChange={(e) => set('priceUSD', Number(e.target.value))}
            required
          />
          <Input label="Margen %" mono readOnly value={margin.toFixed(1)} />
          <Input label={`Precio Bs (BCV ${rate || '—'})`} mono readOnly value={priceBs.toFixed(2)} />
        </div>
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-3">Inventario</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Stock actual"
            type="number"
            mono
            value={value.stock}
            onChange={(e) => set('stock', Number(e.target.value))}
          />
          <Input
            label="Stock mínimo"
            type="number"
            mono
            value={value.stockMin}
            onChange={(e) => set('stockMin', Number(e.target.value))}
          />
          <Input
            label="Stock máximo"
            type="number"
            mono
            value={value.stockMax ?? ''}
            onChange={(e) => set('stockMax', e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-3">MercadoLibre</h4>
        <div className="flex flex-col gap-4">
          <Switch
            checked={value.mlSyncEnabled}
            onCheckedChange={(v) => set('mlSyncEnabled', v)}
            label="Sincronizar con MercadoLibre"
            hint="Publica este producto y mantiene precio/stock actualizado"
          />
          {value.mlSyncEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Categoría ML"
                value={value.mlCategoryId}
                onChange={(e) => set('mlCategoryId', e.target.value)}
                placeholder="MLV1234"
              />
              <Select
                label="Tipo de publicación"
                value={value.mlListingType}
                onChange={(e) => set('mlListingType', e.target.value)}
                options={[
                  { value: 'gold_special', label: 'Clásica' },
                  { value: 'gold_pro', label: 'Premium' },
                  { value: 'free', label: 'Gratis' },
                ]}
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-3">Imágenes (URLs)</h4>
        <div className="flex gap-2">
          <input
            value={imgInput}
            onChange={(e) => setImgInput(e.target.value)}
            placeholder="https://..."
            className="input-base flex-1"
          />
          <button
            type="button"
            className="px-3 py-2 text-sm bg-surface-2 border border-border rounded-md hover:bg-surface-3"
            onClick={() => {
              if (!imgInput) return
              set('images', [...value.images, imgInput])
              setImgInput('')
            }}
          >
            Añadir
          </button>
        </div>
        {value.images.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {value.images.map((u, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-text-secondary bg-surface-2 rounded-md px-3 py-2">
                <span className="flex-1 truncate">{u}</span>
                <button
                  type="button"
                  className="text-danger"
                  onClick={() => set('images', value.images.filter((_, j) => j !== i))}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
