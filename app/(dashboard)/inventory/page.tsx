'use client'
import { useEffect, useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { StockBadge, MLStatusBadge } from '@/components/inventory/StockBadge'
import { ProductForm, emptyProduct, type ProductFormValues } from '@/components/inventory/ProductForm'
import { formatUSD, formatBs, formatNumber } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'
import { Plus, Search, Package, Pencil } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  sku: string
  name: string
  category?: string | null
  stock: number
  stockMin: number
  priceUSD: number
  priceBs: number
  mlItemId?: string | null
  mlStatus?: string | null
  isActive: boolean
}

export default function InventoryPage() {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'ml'>('all')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormValues>(emptyProduct)
  const [rate, setRate] = useState(0)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/inventory${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    const data = await r.json()
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setRate(d?.settings?.exchangeRate || 0))
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [q])

  const filtered = useMemo(() => {
    if (filter === 'low') return items.filter((p) => p.stock <= p.stockMin)
    if (filter === 'ml') return items.filter((p) => p.mlItemId)
    return items
  }, [items, filter])

  const onSave = async () => {
    setSaving(true)
    const url = editingId ? `/api/inventory/${editingId}` : '/api/inventory'
    const method = editingId ? 'PATCH' : 'POST'
    const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error guardando producto')
      return
    }
    toast.success(editingId ? 'Producto actualizado' : 'Producto creado')
    setOpen(false)
    setEditingId(null)
    setForm(emptyProduct)
    load()
  }

  const openEdit = async (id: string) => {
    const r = await fetch(`/api/inventory/${id}`)
    const p = await r.json()
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description || '',
      category: p.category || '',
      categoryId: p.categoryId || '',
      brand: p.brand || '',
      unit: p.unit,
      costUSD: p.costUSD,
      priceUSD: p.priceUSD,
      stock: p.stock,
      stockMin: p.stockMin,
      stockMax: p.stockMax,
      mlSyncEnabled: p.mlSyncEnabled,
      mlCategoryId: p.mlCategoryId || '',
      mlListingType: p.mlListingType,
      isActive: p.isActive,
      images: p.images || [],
    })
    setEditingId(id)
    setOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle={`${items.length} productos · ${formatNumber(items.reduce((s, p) => s + p.stock, 0))} unidades en stock`}
        actions={
          <Button onClick={() => { setEditingId(null); setForm(emptyProduct); setOpen(true) }}>
            <Plus size={16} /> Nuevo producto
          </Button>
        }
      />

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o SKU"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md overflow-x-auto">
            {[
              { v: 'all', l: 'Todos' },
              { v: 'low', l: 'Bajo stock' },
              { v: 'ml', l: 'En ML' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v as typeof filter)}
                className={`px-3 py-1 text-xs rounded whitespace-nowrap ${filter === f.v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={32} />}
              title="No hay productos"
              description="Crea tu primer producto para empezar a llevar el control de tu inventario."
              action={
                <Button onClick={() => { setEditingId(null); setForm(emptyProduct); setOpen(true) }}>
                  <Plus size={16} /> Nuevo producto
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Producto</TH>
                  <TH className="text-right">Stock</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Precio USD</TH>
                  <TH className="text-right">Precio Bs</TH>
                  <TH>ML</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs text-text-secondary">{p.sku}</TD>
                    <TD>
                      <div className="text-sm">{p.name}</div>
                      {p.category && <div className="text-xs text-text-muted">{p.category}</div>}
                    </TD>
                    <TD className="text-right font-mono">
                      {p.stock} <span className="text-text-muted text-xs">/ {p.stockMin}</span>
                    </TD>
                    <TD><StockBadge stock={p.stock} stockMin={p.stockMin} /></TD>
                    <TD className="text-right font-mono">{formatUSD(p.priceUSD)}</TD>
                    <TD className="text-right font-mono text-text-secondary">{formatBs(p.priceBs)}</TD>
                    <TD><MLStatusBadge mlItemId={p.mlItemId} mlStatus={p.mlStatus} /></TD>
                    <TD className="text-right">
                      <button onClick={() => openEdit(p.id)} className="text-text-muted hover:text-accent p-1">
                        <Pencil size={14} />
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editingId ? 'Editar producto' : 'Nuevo producto'}
        description="Información del producto, precios, inventario y publicación en MercadoLibre"
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={onSave}>{editingId ? 'Guardar cambios' : 'Crear producto'}</Button>
          </>
        }
      >
        <ProductForm value={form} onChange={setForm} rate={rate} />
      </Modal>
    </div>
  )
}
