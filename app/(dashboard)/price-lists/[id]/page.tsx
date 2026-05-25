'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { formatUSD } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2, Tag, Search } from 'lucide-react'

interface Item {
  id: string
  productId: string
  priceUSD: number
  product: { id: string; sku: string; name: string; priceUSD: number; category?: string | null }
}
interface PriceList {
  id: string
  name: string
  notes?: string | null
  isActive: boolean
  items: Item[]
  clients: Array<{ id: string; name: string; company?: string | null }>
}
interface Product {
  id: string
  sku: string
  name: string
  priceUSD: number
  category?: string | null
}

export default function PriceListDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [list, setList] = useState<PriceList | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/price-lists/${params.id}`)
    if (r.ok) setList(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  useEffect(() => {
    if (!addOpen) return
    fetch(`/api/inventory${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => r.json())
      .then(setProducts)
  }, [addOpen, q])

  const existingIds = new Set(list?.items.map((i) => i.productId))
  const availableProducts = products.filter((p) => !existingIds.has(p.id))

  const onAdd = async () => {
    const items = Object.entries(selected)
      .filter(([id]) => !existingIds.has(id))
      .map(([productId, raw]) => ({ productId, priceUSD: parseFloat(raw) || 0 }))
    if (items.length === 0) {
      toast.error('Selecciona al menos un producto con precio')
      return
    }
    setSaving(true)
    const r = await fetch(`/api/price-lists/${params.id}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error('Error guardando precios')
      return
    }
    toast.success(`${items.length} ${items.length === 1 ? 'producto agregado' : 'productos agregados'}`)
    setAddOpen(false)
    setSelected({})
    setQ('')
    load()
  }

  const onUpdatePrice = async (productId: string, priceUSD: number) => {
    const r = await fetch(`/api/price-lists/${params.id}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, priceUSD }),
    })
    if (!r.ok) toast.error('Error actualizando precio')
    else load()
  }

  const onRemove = async (productId: string) => {
    if (!confirm('¿Quitar este producto de la lista?')) return
    const r = await fetch(`/api/price-lists/${params.id}/items?productId=${productId}`, { method: 'DELETE' })
    if (!r.ok) toast.error('Error eliminando')
    else load()
  }

  const onDeleteList = async () => {
    if (!confirm(`¿Eliminar la lista "${list?.name}"? Esto removerá la asignación de todos los clientes.`)) return
    setDeleting(true)
    const r = await fetch(`/api/price-lists/${params.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!r.ok) {
      toast.error('Error eliminando lista')
      return
    }
    toast.success('Lista eliminada')
    router.push('/price-lists')
  }

  if (loading) return <Skeleton className="h-40" />
  if (!list) return <EmptyState icon={<Tag size={32} />} title="Lista no encontrada" />

  return (
    <div>
      <Link href="/price-lists" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Listas de precio
      </Link>
      <PageHeader
        title={list.name}
        subtitle={list.notes || `${list.items.length} productos · ${list.clients.length} clientes asignados`}
        actions={
          <>
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Agregar productos
            </Button>
            <Button variant="ghost" onClick={onDeleteList} loading={deleting}>
              <Trash2 size={16} /> Eliminar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Productos en esta lista</CardTitle></CardHeader>
          <CardBody className="p-0">
            {list.items.length === 0 ? (
              <EmptyState
                icon={<Tag size={32} />}
                title="Sin productos"
                description="Agrega productos y asígnales un precio custom para esta lista."
                action={<Button onClick={() => setAddOpen(true)}><Plus size={16} /> Agregar productos</Button>}
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>SKU</TH>
                    <TH>Producto</TH>
                    <TH className="text-right">Precio base</TH>
                    <TH className="text-right">Precio lista</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {list.items.map((it) => (
                    <TR key={it.id}>
                      <TD className="font-mono text-xs text-text-secondary">{it.product.sku}</TD>
                      <TD>
                        <div className="text-sm">{it.product.name}</div>
                        {it.product.category && <div className="text-xs text-text-muted">{it.product.category}</div>}
                      </TD>
                      <TD className="text-right font-mono text-xs text-text-muted">{formatUSD(it.product.priceUSD)}</TD>
                      <TD className="text-right">
                        <PriceEditor value={it.priceUSD} onSave={(v) => onUpdatePrice(it.productId, v)} />
                      </TD>
                      <TD className="text-right">
                        <button onClick={() => onRemove(it.productId)} className="text-text-muted hover:text-danger p-1">
                          <Trash2 size={14} />
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Clientes asignados</CardTitle></CardHeader>
          <CardBody>
            {list.clients.length === 0 ? (
              <div className="text-sm text-text-muted">Aún no hay clientes con esta lista.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.clients.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="block hover:bg-surface-2 rounded-md p-2 -mx-2">
                      <div className="text-sm text-text-primary">{c.name}</div>
                      {c.company && <div className="text-xs text-text-muted">{c.company}</div>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Agregar productos a la lista"
        description="Selecciona productos y define el precio custom para esta lista."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={onAdd}>Agregar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" className="pl-9" />
          </div>
          {availableProducts.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-6">Todos los productos ya están en esta lista.</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
              {availableProducts.map((p) => {
                const checked = !!selected[p.id]
                return (
                  <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-surface-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = { ...selected }
                        if (e.target.checked) next[p.id] = String(p.priceUSD)
                        else delete next[p.id]
                        setSelected(next)
                      }}
                      className="accent-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.name}</div>
                      <div className="text-xs text-text-muted">{p.sku} · base {formatUSD(p.priceUSD)}</div>
                    </div>
                    {checked && (
                      <Input
                        type="number"
                        step="0.01"
                        value={selected[p.id]}
                        onChange={(e) => setSelected({ ...selected, [p.id]: e.target.value })}
                        className="w-28"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function PriceEditor({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState(String(value))
  useEffect(() => setRaw(String(value)), [value])

  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="font-mono text-accent hover:underline"
        title="Click para editar"
      >
        {formatUSD(value)}
      </button>
    )

  return (
    <Input
      type="number"
      step="0.01"
      value={raw}
      autoFocus
      className="w-28 text-right"
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const v = parseFloat(raw)
        if (!isNaN(v) && v !== value) onSave(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setRaw(String(value))
          setEditing(false)
        }
      }}
    />
  )
}
