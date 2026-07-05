'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Stat } from '@/components/ui/Stat'
import { toast } from '@/components/ui/Toast'
import { formatDateTime, formatRelative } from '@/lib/utils'
import { Users, Plus, Search, Copy, Check, ChevronRight, Building2 } from 'lucide-react'

interface Merchant {
  id: string
  email: string
  name: string | null
  company: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    products: number
    clients: number
    sales: number
    sellersOwned: number
  }
}

interface Props {
  basePath: string
}

export function MerchantsDashboard({ basePath }: Props) {
  const externalBase = basePath

  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/system/merchants')
    const d = await r.json()
    setMerchants(d.merchants || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!q.trim()) return merchants
    const s = q.trim().toLowerCase()
    return merchants.filter((m) =>
      m.email.toLowerCase().includes(s) ||
      m.name?.toLowerCase().includes(s) ||
      m.company?.toLowerCase().includes(s),
    )
  }, [merchants, q])

  const stats = useMemo(() => ({
    total: merchants.length,
    active: merchants.filter((m) => m.isActive).length,
    suspended: merchants.filter((m) => !m.isActive).length,
    lastWeek: merchants.filter((m) => {
      const d = new Date(m.createdAt).getTime()
      return Date.now() - d < 7 * 24 * 3600 * 1000
    }).length,
  }), [merchants])

  const create = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son obligatorios')
      return
    }
    setCreating(true)
    const r = await fetch('/api/system/merchants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        company: form.company || null,
        phone: form.phone || null,
      }),
    })
    setCreating(false)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(typeof d.error === 'string' ? d.error : 'Error creando merchant')
      return
    }
    setCredentials({ email: d.merchant.email, name: form.name, password: d.initialPassword })
    setForm({ name: '', email: '', company: '', phone: '' })
    setOpen(false)
    load()
  }

  const toggleActive = async (m: Merchant) => {
    const action = m.isActive ? 'suspender' : 'habilitar'
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a ${m.name || m.email}?`)) return
    const r = await fetch(`/api/system/merchants/${m.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !m.isActive }),
    })
    if (!r.ok) { toast.error('Error'); return }
    toast.success(m.isActive ? 'Merchant suspendido' : 'Merchant habilitado')
    load()
  }

  const copyCredentials = () => {
    if (!credentials) return
    const text = `Bienvenido a DistribOS

Portal: https://distribuidores-production.up.railway.app/login
Usuario: ${credentials.email}
Contraseña: ${credentials.password}

Podés cambiar tu contraseña una vez adentro.`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      <PageHeader
        title="Merchants"
        subtitle="Administrador global · Gestión de cuentas del sistema"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={14} /> Nuevo merchant
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Stat label="Total merchants" value={stats.total} accent />
        <Stat label="Activos" value={stats.active} />
        <Stat label="Suspendidos" value={stats.suspended} />
        <Stat label="Últimos 7 días" value={stats.lastWeek} />
      </div>

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por email, nombre o empresa"
              className="pl-9"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              title={merchants.length === 0 ? 'Aún no hay merchants' : 'Sin resultados'}
              description={merchants.length === 0
                ? 'Crea el primer merchant. Recibirá un usuario y contraseña para acceder al panel de su negocio.'
                : 'Ajustá el filtro para ver más.'}
              action={merchants.length === 0 ? (
                <Button onClick={() => setOpen(true)}><Plus size={14} /> Nuevo merchant</Button>
              ) : undefined}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Merchant</TH>
                  <TH>Contacto</TH>
                  <TH>Estado</TH>
                  <TH>Creado</TH>
                  <TH className="text-right">Productos</TH>
                  <TH className="text-right">Ventas</TH>
                  <TH className="text-right">Vendedores</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <div className="text-sm text-text-primary">{m.name || m.email}</div>
                      {m.company && (
                        <div className="text-xs text-text-muted flex items-center gap-1">
                          <Building2 size={10} /> {m.company}
                        </div>
                      )}
                    </TD>
                    <TD className="text-xs text-text-secondary">
                      <div className="font-mono">{m.email}</div>
                      {m.phone && <div>{m.phone}</div>}
                    </TD>
                    <TD>
                      {m.isActive ? (
                        <Badge tone="success">Activo</Badge>
                      ) : (
                        <Badge tone="danger">Suspendido</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="text-xs text-text-primary">{formatDateTime(m.createdAt)}</div>
                      <div className="text-[11px] text-text-muted">{formatRelative(m.createdAt)}</div>
                    </TD>
                    <TD className="text-right font-mono text-sm">{m._count.products}</TD>
                    <TD className="text-right font-mono text-sm">{m._count.sales}</TD>
                    <TD className="text-right font-mono text-sm">{m._count.sellersOwned}</TD>
                    <TD className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleActive(m)}
                          className={`text-xs px-2 py-1 rounded ${m.isActive ? 'text-danger hover:bg-danger-subtle' : 'text-success hover:bg-success-subtle'}`}
                        >
                          {m.isActive ? 'Suspender' : 'Habilitar'}
                        </button>
                        <Link href={`${externalBase}/merchants/${m.id}`} className="text-text-muted hover:text-accent p-1 inline-block">
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Modal crear */}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Nuevo merchant"
        description="Se creará una cuenta con contraseña aleatoria. La verás una sola vez."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={creating} onClick={create}>Crear merchant</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre del responsable"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email (será su usuario de login)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Nombre de la empresa"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </Modal>

      {/* Modal credenciales */}
      <Modal
        open={!!credentials}
        onOpenChange={(o) => !o && setCredentials(null)}
        title="Merchant creado — credenciales de acceso"
        description="Copialas y compartilas. La contraseña no vuelve a mostrarse."
        size="md"
        footer={<Button onClick={() => setCredentials(null)}>Entendido</Button>}
      >
        {credentials && (
          <div className="flex flex-col gap-3">
            <div className="bg-surface-2 border border-border rounded-md p-4 font-mono text-sm">
              <div className="text-text-secondary">Usuario</div>
              <div className="text-text-primary mb-3">{credentials.email}</div>
              <div className="text-text-secondary">Contraseña</div>
              <div className="text-text-primary text-lg font-semibold">{credentials.password}</div>
            </div>
            <Button variant="secondary" onClick={copyCredentials}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar mensaje completo</>}
            </Button>
            <div className="text-xs text-text-muted">
              El merchant entra en <code className="font-mono">/login</code> con esas credenciales y puede cambiar la contraseña desde configuración.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
