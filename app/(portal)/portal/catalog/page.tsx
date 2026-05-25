'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { formatUSD } from '@/lib/utils'
import { Search, ShoppingCart, Minus, Plus, Trash2, Package } from 'lucide-react'

interface CatalogProduct {
  id: string
  sku: string
  name: string
  category?: string | null
  brand?: string | null
  unit: string
  images: string[]
  priceUSD: number
  listPriceUSD: number
  custom: boolean
  stock: number
}

interface CartLine {
  product: CatalogProduct
  quantity: number
}

export default function PortalCatalogPage() {
  const router = useRouter()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [priceListName, setPriceListName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/portal/catalog${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    const data = await r.json()
    setProducts(data.products || [])
    setPriceListName(data.priceList?.name || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [q])

  const addToCart = (p: CatalogProduct, delta = 1) => {
    setCart((prev) => {
      const cur = prev[p.id]?.quantity || 0
      const next = Math.max(0, cur + delta)
      if (next === 0) {
        const { [p.id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [p.id]: { product: p, quantity: next } }
    })
  }

  const setQty = (p: CatalogProduct, qty: number) => {
    const v = Math.max(0, Math.floor(qty))
    if (v === 0) {
      setCart((prev) => {
        const { [p.id]: _, ...rest } = prev
        return rest
      })
    } else {
      setCart((prev) => ({ ...prev, [p.id]: { product: p, quantity: v } }))
    }
  }

  const cartLines = Object.values(cart)
  const cartCount = cartLines.reduce((s, l) => s + l.quantity, 0)
  const cartTotal = cartLines.reduce((s, l) => s + l.quantity * l.product.priceUSD, 0)

  const submit = async () => {
    if (cartLines.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    setSubmitting(true)
    const r = await fetch('/api/portal/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        notes: notes || null,
      }),
    })
    setSubmitting(false)
    if (!r.ok) {
      toast.error('Error enviando el pedido')
      return
    }
    toast.success('Pedido enviado')
    setCart({})
    setNotes('')
    setCartOpen(false)
    router.push('/portal/requests')
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary">Catálogo</h1>
          <p className="text-sm text-text-secondary mt-1">
            {priceListName ? `Precios de tu lista: ${priceListName}` : 'Precios base'}
          </p>
        </div>
        <Button onClick={() => setCartOpen(true)} disabled={cartCount === 0}>
          <ShoppingCart size={16} /> Carrito ({cartCount})
        </Button>
      </div>

      <Card className="mb-4">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU o categoría" className="pl-9" />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={32} />}
            title="Sin productos"
            description="Aún no hay productos disponibles en este catálogo."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {products.map((p) => {
            const inCart = cart[p.id]?.quantity || 0
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardBody className="flex flex-col gap-3">
                  <div>
                    <div className="text-xs font-mono text-text-muted">{p.sku}</div>
                    <div className="font-display text-base text-text-primary line-clamp-2">{p.name}</div>
                    {p.category && <div className="text-xs text-text-muted">{p.category}</div>}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="font-mono text-xl text-accent">{formatUSD(p.priceUSD)}</div>
                      {p.custom && p.listPriceUSD !== p.priceUSD && (
                        <Badge tone="accent" className="mt-1">Precio especial</Badge>
                      )}
                      <div className="text-[11px] text-text-muted mt-1">Disponible: {p.stock} {p.unit}</div>
                    </div>
                    {inCart > 0 ? (
                      <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-md p-1">
                        <button
                          onClick={() => addToCart(p, -1)}
                          className="p-1.5 text-text-secondary hover:text-text-primary"
                          aria-label="Restar"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={inCart}
                          onChange={(e) => setQty(p, parseInt(e.target.value || '0', 10))}
                          className="w-12 text-center bg-transparent text-sm font-mono outline-none"
                        />
                        <button
                          onClick={() => addToCart(p, 1)}
                          className="p-1.5 text-text-secondary hover:text-text-primary"
                          aria-label="Sumar"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <Button onClick={() => addToCart(p, 1)} variant="ghost">
                        <Plus size={14} /> Agregar
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={cartOpen}
        onOpenChange={setCartOpen}
        title="Tu pedido"
        description={`${cartCount} ${cartCount === 1 ? 'unidad' : 'unidades'} · ${formatUSD(cartTotal)}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCartOpen(false)}>Seguir comprando</Button>
            <Button onClick={submit} loading={submitting} disabled={cartLines.length === 0}>
              Enviar pedido
            </Button>
          </>
        }
      >
        {cartLines.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-6">Tu carrito está vacío.</div>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-border">
              {cartLines.map((l) => (
                <li key={l.product.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{l.product.name}</div>
                    <div className="text-xs text-text-muted font-mono">{formatUSD(l.product.priceUSD)} c/u</div>
                  </div>
                  <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-md p-1">
                    <button
                      onClick={() => addToCart(l.product, -1)}
                      className="p-1 text-text-secondary hover:text-text-primary"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={l.quantity}
                      onChange={(e) => setQty(l.product, parseInt(e.target.value || '0', 10))}
                      className="w-10 text-center bg-transparent text-sm font-mono outline-none"
                    />
                    <button
                      onClick={() => addToCart(l.product, 1)}
                      className="p-1 text-text-secondary hover:text-text-primary"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="font-mono text-sm text-accent w-20 text-right">
                    {formatUSD(l.quantity * l.product.priceUSD)}
                  </div>
                  <button
                    onClick={() => setQty(l.product, 0)}
                    className="text-text-muted hover:text-danger p-1"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <Textarea
              label="Notas para el vendedor (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. fecha de entrega, observaciones, etc."
            />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-text-secondary">Total</span>
              <span className="font-mono text-lg text-accent">{formatUSD(cartTotal)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
