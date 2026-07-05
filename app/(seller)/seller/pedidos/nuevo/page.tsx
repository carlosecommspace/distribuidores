'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { formatUSD } from '@/lib/utils'
import { Search, Package, ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Client { id: string; name: string; company: string | null }
interface Product {
  id: string
  sku: string
  name: string
  priceUSD: number
  stock: number
  unit: string
  category: string | null
  effectivePrice?: number
  hasListPrice?: boolean
  basePrice?: number
}
interface LineItem {
  productId: string
  name: string
  sku: string
  quantity: number
  priceUSD: number
  stock: number
  unit: string
}

export default function NewOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClient = searchParams.get('clientId')

  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [clientId, setClientId] = useState(preselectedClient || '')
  const [items, setItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [priceListName, setPriceListName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/seller/clients').then((r) => r.json()).then((d) => {
      setClients(d.clients || [])
      setLoadingClients(false)
    })
  }, [])

  useEffect(() => {
    if (!clientId) return
    setLoadingProducts(true)
    const url = new URL('/api/products/search', window.location.origin)
    url.searchParams.set('q', productQuery)
    url.searchParams.set('clientId', clientId) // aplica lista de precios del cliente
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        // API devuelve {products, priceListName}. Retrocompat con array crudo.
        if (Array.isArray(d)) {
          setProducts(d)
          setPriceListName(null)
        } else {
          setProducts(d.products || [])
          setPriceListName(d.priceListName || null)
        }
        setLoadingProducts(false)
      })
      .catch(() => setLoadingProducts(false))
  }, [productQuery, clientId])

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clientId, clients])

  const total = useMemo(() => items.reduce((s, it) => s + it.quantity * it.priceUSD, 0), [items])

  const addProduct = (p: Product) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === p.id)
      if (existing) {
        return prev.map((it) =>
          it.productId === p.id
            ? { ...it, quantity: Math.min(it.quantity + 1, p.stock) }
            : it,
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: 1,
          priceUSD: p.effectivePrice ?? p.priceUSD,
          stock: p.stock,
          unit: p.unit,
        },
      ]
    })
  }

  const setQuantity = (productId: string, qty: number) => {
    setItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, quantity: Math.max(1, Math.min(qty, it.stock)) } : it)))
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId))
  }

  const submit = async () => {
    if (!clientId) { toast.error('Selecciona un cliente'); return }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setSubmitting(true)
    const r = await fetch('/api/seller/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId,
        items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        notes: notes || null,
      }),
    })
    setSubmitting(false)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (d.error === 'insufficient_stock' && Array.isArray(d.items)) {
        toast.error(`Stock insuficiente en: ${d.items.map((x: { name: string }) => x.name).join(', ')}`)
      } else {
        toast.error(typeof d.error === 'string' ? d.error : 'Error creando pedido')
      }
      return
    }
    toast.success(`Pedido ${d.code} creado`)
    router.push('/seller/pedidos')
  }

  return (
    <div>
      <Link href="/seller/pedidos" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-3">
        <ArrowLeft size={14} /> Mis pedidos
      </Link>
      <PageHeader
        title="Nuevo pedido"
        subtitle="Selecciona un cliente asignado y arma el pedido"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-4">
        <div className="flex flex-col gap-4">
          {/* Cliente */}
          <Card>
            <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
            <CardBody>
              {loadingClients ? (
                <Skeleton className="h-10" />
              ) : clients.length === 0 ? (
                <div className="text-sm text-text-muted">
                  No tienes clientes asignados. <Link href="/seller/clientes" className="text-accent hover:underline">Crear uno →</Link>
                </div>
              ) : (
                <Select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  options={[
                    { value: '', label: 'Selecciona un cliente…' },
                    ...clients.map((c) => ({
                      value: c.id,
                      label: c.company ? `${c.name} · ${c.company}` : c.name,
                    })),
                  ]}
                />
              )}
            </CardBody>
          </Card>

          {/* Productos */}
          {clientId && (
            <Card>
              <CardHeader><CardTitle>Buscar productos</CardTitle></CardHeader>
              <CardBody className="flex flex-col gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Buscar por nombre o SKU"
                    className="pl-9"
                  />
                </div>
                {priceListName && (
                  <div className="text-xs text-accent bg-accent-subtle border border-accent-border rounded-md px-2.5 py-1.5">
                    Precios de la lista <strong>{priceListName}</strong> del cliente
                  </div>
                )}
                {loadingProducts ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-4">
                    {productQuery ? 'Sin resultados' : 'Empieza a escribir para buscar productos o dejalo vacío para ver los últimos 30.'}
                  </div>
                ) : (
                  <ul className="border border-border rounded-md divide-y divide-border max-h-[400px] overflow-y-auto">
                    {products.slice(0, 30).map((p) => {
                      const outOfStock = p.stock <= 0
                      const price = p.effectivePrice ?? p.priceUSD
                      const hasListPrice = !!p.hasListPrice && p.basePrice !== undefined && p.basePrice !== price
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={() => addProduct(p)}
                            className="w-full text-left p-3 hover:bg-surface-2 flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-text-primary truncate">{p.name}</div>
                              <div className="text-xs text-text-muted font-mono flex items-center gap-2 flex-wrap">
                                <span>{p.sku}</span>
                                <span>·</span>
                                <span className={hasListPrice ? 'text-accent' : ''}>
                                  {formatUSD(price)}
                                  {hasListPrice && p.basePrice !== undefined && (
                                    <span className="ml-1 text-text-muted line-through">{formatUSD(p.basePrice)}</span>
                                  )}
                                </span>
                                <span>·</span>
                                <span>stock {p.stock} {p.unit}</span>
                              </div>
                            </div>
                            {outOfStock ? (
                              <span className="text-xs text-danger">Sin stock</span>
                            ) : (
                              <Plus size={14} className="text-accent flex-shrink-0" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar: carrito */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen ({items.length})</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {items.length === 0 ? (
                <EmptyState
                  icon={<Package size={28} />}
                  title="Sin productos"
                  description="Busca y añade productos al pedido."
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {items.map((it) => (
                      <div key={it.productId} className="border border-border rounded-md p-2 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-text-primary truncate">{it.name}</div>
                            <div className="text-xs text-text-muted font-mono">{formatUSD(it.priceUSD)}/{it.unit}</div>
                          </div>
                          <button onClick={() => removeItem(it.productId)} className="text-text-muted hover:text-danger p-1">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQuantity(it.productId, it.quantity - 1)} className="h-7 w-7 rounded bg-surface-2 hover:bg-surface-3 flex items-center justify-center">
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => setQuantity(it.productId, parseInt(e.target.value) || 1)}
                            min={1}
                            max={it.stock}
                            className="input-base w-16 text-center text-sm h-7 py-0"
                          />
                          <button onClick={() => setQuantity(it.productId, it.quantity + 1)} className="h-7 w-7 rounded bg-surface-2 hover:bg-surface-3 flex items-center justify-center">
                            <Plus size={12} />
                          </button>
                          <span className="ml-auto text-sm font-mono text-accent">{formatUSD(it.quantity * it.priceUSD)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Total</span>
                    <span className="text-xl font-mono text-accent">{formatUSD(total)}</span>
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas del pedido (opcional)"
                    className="input-base text-sm min-h-[60px] resize-none"
                    maxLength={500}
                  />

                  <Button loading={submitting} onClick={submit} disabled={!clientId}>
                    Crear pedido
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
