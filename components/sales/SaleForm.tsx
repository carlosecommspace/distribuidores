'use client'
import { useEffect, useState } from 'react'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { formatUSD, formatBs } from '@/lib/utils'
import { Search, X, Plus } from 'lucide-react'

interface ClientLite { id: string; name: string; company?: string | null; phone?: string | null; priceList?: { id: string; name: string } | null }
interface ProductLite {
  id: string
  sku: string
  name: string
  priceUSD: number
  stock: number
  unit: string
  effectivePrice?: number
  hasListPrice?: boolean
  basePrice?: number
}

export interface SaleFormValues {
  clientId: string | null
  channel: 'mercadolibre' | 'whatsapp' | 'direct' | 'phone' | 'other'
  items: Array<{ productId: string; name: string; sku: string; quantity: number; priceUSD: number; stock: number }>
  paymentMethod: string
  paymentStatus: string
  exchangeRate: number
  notes: string
}

export const emptySale = (rate: number): SaleFormValues => ({
  clientId: null,
  channel: 'direct',
  items: [],
  paymentMethod: 'cash_usd',
  paymentStatus: 'paid',
  exchangeRate: rate,
  notes: '',
})

export function SaleForm({ value, onChange }: { value: SaleFormValues; onChange: (v: SaleFormValues) => void }) {
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientLite[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<ProductLite[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null)
  const [occasional, setOccasional] = useState(value.clientId === null)
  const [activePriceListName, setActivePriceListName] = useState<string | null>(null)

  useEffect(() => {
    if (occasional) return
    const t = setTimeout(async () => {
      const r = await fetch(`/api/clients?q=${encodeURIComponent(clientQuery)}`)
      const data = await r.json()
      setClientResults(data.slice(0, 8))
    }, 200)
    return () => clearTimeout(t)
  }, [clientQuery, occasional])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (productQuery.length < 1) return setProductResults([])
      const url = new URL('/api/products/search', window.location.origin)
      url.searchParams.set('q', productQuery)
      if (value.clientId) url.searchParams.set('clientId', value.clientId)
      const r = await fetch(url.toString())
      const data = await r.json()
      // Backward compat: si la API devuelve array crudo, normalízalo
      if (Array.isArray(data)) {
        setProductResults(data)
        setActivePriceListName(null)
      } else {
        setProductResults(data.products || [])
        setActivePriceListName(data.priceListName || null)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [productQuery, value.clientId])

  const set = <K extends keyof SaleFormValues>(k: K, v: SaleFormValues[K]) => onChange({ ...value, [k]: v })

  const addItem = (p: ProductLite) => {
    if (value.items.some((i) => i.productId === p.id)) return
    const unitPrice = p.effectivePrice ?? p.priceUSD
    set('items', [...value.items, { productId: p.id, name: p.name, sku: p.sku, quantity: 1, priceUSD: unitPrice, stock: p.stock }])
    setProductQuery('')
    setProductResults([])
  }

  const subtotal = value.items.reduce((s, i) => s + i.quantity * i.priceUSD, 0)

  return (
    <div className="flex flex-col gap-7">
      <section>
        <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-3">1 · Cliente</h4>
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => { setOccasional(false); set('clientId', null); setSelectedClient(null) }}
            className={`px-3 py-1.5 rounded-md text-xs border ${!occasional ? 'bg-accent-subtle border-accent-border text-accent' : 'border-border text-text-secondary'}`}
          >
            Cliente registrado
          </button>
          <button
            type="button"
            onClick={() => { setOccasional(true); set('clientId', null); setSelectedClient(null) }}
            className={`px-3 py-1.5 rounded-md text-xs border ${occasional ? 'bg-accent-subtle border-accent-border text-accent' : 'border-border text-text-secondary'}`}
          >
            Cliente ocasional
          </button>
        </div>
        {!occasional && (
          <div className="relative">
            {selectedClient ? (
              <div className="flex items-center justify-between bg-surface-2 border border-border rounded-md px-3 py-2">
                <div>
                  <div className="text-sm">{selectedClient.name}</div>
                  <div className="text-xs text-text-muted">{selectedClient.company || selectedClient.phone || '—'}</div>
                </div>
                <button type="button" onClick={() => { setSelectedClient(null); set('clientId', null) }} className="text-text-muted hover:text-danger">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar cliente por nombre, empresa o teléfono"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                </div>
                {clientResults.length > 0 && (
                  <ul className="mt-1 bg-surface border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto">
                    {clientResults.map((c) => (
                      <li
                        key={c.id}
                        className="px-3 py-2 hover:bg-surface-2 cursor-pointer"
                        onClick={() => { setSelectedClient(c); set('clientId', c.id); setClientResults([]); setClientQuery('') }}
                      >
                        <div className="text-sm">{c.name}</div>
                        <div className="text-xs text-text-muted">{c.company || c.phone || '—'}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        <div className="mt-4">
          <Select
            label="Canal de venta"
            value={value.channel}
            onChange={(e) => set('channel', e.target.value as SaleFormValues['channel'])}
            options={[
              { value: 'direct', label: 'Directo / Local' },
              { value: 'mercadolibre', label: 'MercadoLibre' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'phone', label: 'Teléfono' },
              { value: 'other', label: 'Otro' },
            ]}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs uppercase tracking-wider text-text-secondary">2 · Productos</h4>
          {activePriceListName && (
            <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-accent-subtle border border-accent-border text-accent">
              Lista: {activePriceListName}
            </span>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            placeholder="Buscar producto por nombre o SKU"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
          />
          {productResults.length > 0 && (
            <ul className="absolute left-0 right-0 mt-1 z-10 bg-surface border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto shadow-lg">
              {productResults.map((p) => (
                <li
                  key={p.id}
                  className="px-3 py-2 hover:bg-surface-2 cursor-pointer flex items-center justify-between"
                  onClick={() => addItem(p)}
                >
                  <div>
                    <div className="text-sm">{p.name}</div>
                    <div className="text-xs text-text-muted font-mono">{p.sku} · stock {p.stock} {p.unit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-accent">{formatUSD(p.effectivePrice ?? p.priceUSD)}</div>
                    {p.hasListPrice && p.basePrice !== undefined && p.basePrice !== p.effectivePrice && (
                      <div className="text-[10px] text-text-muted line-through font-mono">{formatUSD(p.basePrice)}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {value.items.length > 0 && (
          <div className="mt-4 border border-border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-text-secondary">
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2 text-right">Precio USD</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {value.items.map((it, idx) => (
                  <tr key={it.productId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div>{it.name}</div>
                      <div className="text-xs text-text-muted font-mono">{it.sku}</div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={it.stock}
                        value={it.quantity}
                        onChange={(e) => {
                          const items = [...value.items]
                          items[idx] = { ...it, quantity: Math.max(1, Number(e.target.value)) }
                          set('items', items)
                        }}
                        className="input-base w-20 text-right font-mono py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={it.priceUSD}
                        onChange={(e) => {
                          const items = [...value.items]
                          items[idx] = { ...it, priceUSD: Number(e.target.value) }
                          set('items', items)
                        }}
                        className="input-base w-24 text-right font-mono py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatUSD(it.quantity * it.priceUSD)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => set('items', value.items.filter((_, j) => j !== idx))}
                        className="text-text-muted hover:text-danger"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2">
                  <td colSpan={3} className="px-3 py-2 text-right text-text-secondary">Total</td>
                  <td className="px-3 py-2 text-right font-mono text-accent text-base">{formatUSD(subtotal)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-1 text-right text-xs text-text-muted">en bolívares (BCV {value.exchangeRate})</td>
                  <td className="px-3 py-1 text-right font-mono text-text-secondary">{formatBs(subtotal * value.exchangeRate)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-3">3 · Pago</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Método de pago"
            value={value.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
            options={[
              { value: 'cash_usd', label: 'Efectivo USD' },
              { value: 'cash_bs', label: 'Efectivo Bs' },
              { value: 'zelle', label: 'Zelle' },
              { value: 'binance', label: 'Binance' },
              { value: 'transfer_bs', label: 'Transferencia Bs' },
              { value: 'transfer_usd', label: 'Transferencia USD' },
              { value: 'mixed', label: 'Mixto' },
            ]}
          />
          <Input
            label="Tasa BCV aplicada"
            type="number"
            step="0.01"
            mono
            value={value.exchangeRate}
            onChange={(e) => set('exchangeRate', Number(e.target.value))}
          />
          <Select
            label="Estado"
            value={value.paymentStatus}
            onChange={(e) => set('paymentStatus', e.target.value)}
            options={[
              { value: 'paid', label: 'Pagado' },
              { value: 'pending', label: 'Pendiente' },
              { value: 'partial', label: 'Pago parcial' },
            ]}
          />
        </div>
        <div className="mt-4">
          <Textarea label="Notas" value={value.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </section>
    </div>
  )
}
