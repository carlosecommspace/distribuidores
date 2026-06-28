'use client'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardBody } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { Plus, Tag, Pencil, Trash2, Upload, Download, ChevronRight, ChevronDown } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  color?: string | null
  parentId?: string | null
  sortOrder: number
  isActive: boolean
  parent?: { id: string; name: string; slug: string } | null
  _count: { products: number; children: number }
}

interface TreeNode extends Category {
  childNodes: TreeNode[]
  depth: number
}

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    name: string
    slug: string
    parentId: string
    description: string
    color: string
    sortOrder: number
    isActive: boolean
  }>({
    name: '', slug: '', parentId: '', description: '', color: '', sortOrder: 0, isActive: true,
  })
  const [saving, setSaving] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<null | { created: number; updated: number; skipped: number; errors: Array<{ row: number; error: string }> }>(null)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/categories')
    setItems(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const tree = useMemo(() => buildTree(items), [items])
  const flat = useMemo(() => flatten(tree, collapsed), [tree, collapsed])

  const toggle = (id: string) => {
    const c = new Set(collapsed)
    if (c.has(id)) c.delete(id); else c.add(id)
    setCollapsed(c)
  }

  const openCreate = (parentId = '') => {
    setEditingId(null)
    setForm({ name: '', slug: '', parentId, description: '', color: '', sortOrder: 0, isActive: true })
    setOpen(true)
  }

  const openEdit = (c: Category) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      slug: c.slug,
      parentId: c.parentId || '',
      description: c.description || '',
      color: c.color || '',
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editingId ? `/api/categories/${editingId}` : '/api/categories'
    const method = editingId ? 'PATCH' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, parentId: form.parentId || null }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error guardando categoría')
      return
    }
    toast.success(editingId ? 'Categoría actualizada' : 'Categoría creada')
    setOpen(false)
    load()
  }

  const remove = async (c: Category) => {
    if (c._count.products > 0 || c._count.children > 0) {
      if (!confirm(`Esta categoría tiene ${c._count.products} producto(s) y ${c._count.children} sub-categoría(s). ¿Eliminar de todas formas? Los productos quedarán sin categoría.`)) return
    } else {
      if (!confirm('¿Eliminar esta categoría?')) return
    }
    const r = await fetch(`/api/categories/${c.id}`, { method: 'DELETE' })
    if (!r.ok) {
      toast.error('Error eliminando categoría')
      return
    }
    toast.success('Categoría eliminada')
    load()
  }

  const runImport = async () => {
    if (!importCsv.trim()) {
      toast.error('Pega o sube el contenido del CSV')
      return
    }
    setImporting(true)
    const r = await fetch('/api/categories/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: importCsv }),
    })
    setImporting(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error importando')
      return
    }
    const result = await r.json()
    setImportResult(result)
    toast.success(`Importadas ${result.created + result.updated} categorías`)
    load()
  }

  const onFileSelected = async (file: File) => {
    const text = await file.text()
    setImportCsv(text)
  }

  // Categorías disponibles como padres (excluye la actual y sus descendientes para evitar ciclos)
  const possibleParents = useMemo(() => {
    if (!editingId) return items
    const banned = new Set<string>([editingId])
    for (const c of items) if (c.parentId && banned.has(c.parentId)) banned.add(c.id)
    return items.filter((c) => !banned.has(c.id))
  }, [items, editingId])

  return (
    <div>
      <PageHeader
        title="Categorías"
        subtitle="Organiza tus productos en categorías jerárquicas"
        actions={
          <div className="flex gap-2">
            <a href="/api/categories/template" download>
              <Button variant="ghost"><Download size={14} /> Plantilla</Button>
            </a>
            <Button variant="secondary" onClick={() => { setImportResult(null); setImportCsv(''); setImportOpen(true) }}>
              <Upload size={14} /> Importar
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus size={16} /> Nueva categoría
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Tag size={32} />}
              title="No tienes categorías todavía"
              description="Crea categorías manualmente o importa una plantilla con jerarquía precargada para distribuidoras venezolanas."
              action={
                <div className="flex gap-2">
                  <Button onClick={() => openCreate()}><Plus size={16} /> Nueva categoría</Button>
                  <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload size={14} /> Importar plantilla</Button>
                </div>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {flat.map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-2.5 flex items-center gap-2 hover:bg-surface-2/50"
                  style={{ paddingLeft: `${16 + n.depth * 22}px` }}
                >
                  {n.childNodes.length > 0 ? (
                    <button onClick={() => toggle(n.id)} className="text-text-muted hover:text-text-primary p-0.5">
                      {collapsed.has(n.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                  ) : (
                    <span className="w-[18px]" />
                  )}
                  {n.color && (
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: n.color }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary truncate">{n.name}</span>
                      {!n.isActive && <Badge tone="neutral">Inactiva</Badge>}
                    </div>
                    <div className="text-xs text-text-muted font-mono truncate">{n.slug}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary">
                    <span>{n._count.products} productos</span>
                    {n._count.children > 0 && <span>{n._count.children} sub</span>}
                  </div>
                  <button onClick={() => openCreate(n.id)} className="text-text-muted hover:text-accent p-1" title="Crear sub-categoría">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => openEdit(n)} className="text-text-muted hover:text-accent p-1" title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(n)} className="text-text-muted hover:text-danger p-1" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editingId ? 'Editar categoría' : 'Nueva categoría'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={save}>{editingId ? 'Guardar' : 'Crear'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Slug (opcional)"
            mono
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            hint="Se autogenera si lo dejas vacío"
          />
          <Select
            label="Categoría padre (opcional)"
            value={form.parentId}
            onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            options={[
              { value: '', label: '— Sin padre (raíz) —' },
              ...possibleParents.map((c) => ({ value: c.id, label: c.parent ? `${c.parent.name} / ${c.name}` : c.name })),
            ]}
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Color (hex)"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#F5A623"
            />
            <Input
              label="Orden"
              type="number"
              mono
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar categorías"
        description="Pega un CSV o sube un archivo. Descarga la plantilla para ver el formato."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cerrar</Button>
            <Button loading={importing} onClick={runImport}>Importar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <a href="/api/categories/template" download>
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
            <span className="text-xs text-text-muted">Formato: nombre, slug, categoria_padre, descripcion, color</span>
          </div>
          <Textarea
            label="Contenido CSV"
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            className="min-h-[260px] font-mono text-xs"
            placeholder="nombre,slug,categoria_padre,descripcion,color&#10;Alimentos,alimentos,,Productos al mayor,#4ADE80&#10;Granos,granos,alimentos,..."
          />
          {importResult && (
            <div className="border border-border rounded-md p-4 bg-surface-2 text-sm">
              <div className="grid grid-cols-3 gap-3 mb-2">
                <Stat label="Creadas" value={importResult.created} tone="success" />
                <Stat label="Actualizadas" value={importResult.updated} tone="info" />
                <Stat label="Saltadas" value={importResult.skipped} tone="neutral" />
              </div>
              {importResult.errors.length > 0 && (
                <div>
                  <div className="text-xs text-danger mb-1.5">{importResult.errors.length} errores:</div>
                  <ul className="text-xs text-text-secondary max-h-40 overflow-y-auto">
                    {importResult.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>· fila {e.row}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'info' | 'neutral' }) {
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

function buildTree(items: Category[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  for (const c of items) byId.set(c.id, { ...c, childNodes: [], depth: 0 })
  const roots: TreeNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.childNodes.push(node)
    } else {
      roots.push(node)
    }
  }
  const fixDepth = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      n.depth = depth
      n.childNodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      fixDepth(n.childNodes, depth + 1)
    }
  }
  roots.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  fixDepth(roots, 0)
  return roots
}

function flatten(tree: TreeNode[], collapsed: Set<string>): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      out.push(n)
      if (!collapsed.has(n.id)) walk(n.childNodes)
    }
  }
  walk(tree)
  return out
}
