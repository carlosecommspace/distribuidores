'use client'
import { useMemo, useState } from 'react'
import { Search, MessageCircle, Package } from 'lucide-react'
import { formatUSD } from '@/lib/utils'

interface CatalogProduct {
  id: string
  sku: string
  name: string
  category?: string | null
  priceUSD: number
  stock: number
  unit: string
  images: string[]
}

export function CatalogSearch({ products, phone }: { products: CatalogProduct[]; phone: string }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())),
    [q, products],
  )

  return (
    <div>
      <div className="relative max-w-md mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto"
          className="input-base pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">No se encontraron productos</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const text = encodeURIComponent(`Hola, me interesa: ${p.name} (${p.sku}) — $${p.priceUSD}`)
            const href = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
            return (
              <div key={p.id} className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
                <div className="aspect-square bg-surface-2 flex items-center justify-center overflow-hidden">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={32} className="text-text-muted" />
                  )}
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="text-sm line-clamp-2 min-h-[40px]">{p.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-accent font-medium">{formatUSD(p.priceUSD)}</span>
                    <span className="text-xs text-text-muted">{p.stock} {p.unit}</span>
                  </div>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center justify-center gap-1.5 text-xs bg-accent text-black px-3 py-2 rounded-md font-medium"
                  >
                    <MessageCircle size={12} /> Consultar
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
