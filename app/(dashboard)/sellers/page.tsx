'use client'
import { useEffect, useState } from 'react'
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
import { toast } from '@/components/ui/Toast'
import { UserPlus, Users, Copy, Check, ChevronRight } from 'lucide-react'
import { formatUSD } from '@/lib/utils'

interface Seller {
  id: string
  name: string
  phone: string | null
  isActive: boolean
  createdAt: string
  user: { email: string }
  _count: { clientAssignments: number; requests: number; sales: number }
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/sellers')
    const d = await r.json()
    setSellers(d.sellers || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son obligatorios')
      return
    }
    setCreating(true)
    const r = await fetch('/api/sellers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
      }),
    })
    setCreating(false)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(typeof d.error === 'string' ? d.error : 'Error creando vendedor')
      return
    }
    setCreatedCredentials({ email: d.seller.user.email, password: d.initialPassword })
    setForm({ name: '', email: '', phone: '' })
    setOpen(false)
    load()
  }

  const sellerLoginUrl = typeof window !== 'undefined' ? `${window.location.origin}/vendedor` : '/vendedor'

  const copyCredentials = () => {
    if (!createdCredentials) return
    const text = `Portal del vendedor de DistribOS
Enlace: ${sellerLoginUrl}
Usuario: ${createdCredentials.email}
Contraseña: ${createdCredentials.password}

Podrás cambiar tu contraseña una vez adentro, desde "Mi perfil".`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      <PageHeader
        title="Vendedores"
        subtitle={`${sellers.length} ${sellers.length === 1 ? 'vendedor' : 'vendedores'} · Cada uno gestiona sus clientes asignados`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus size={14} /> Nuevo vendedor
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
              Enlace para que ingresen los vendedores
            </div>
            <div className="text-sm font-mono text-accent break-all">{sellerLoginUrl}</div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(sellerLoginUrl)
              toast.success('Enlace copiado')
            }}
          >
            <Copy size={13} /> Copiar enlace
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : sellers.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              title="Aún no tienes vendedores"
              description="Crea tu primer vendedor y asignale clientes. Podrá colocar pedidos desde su propio portal."
              action={<Button onClick={() => setOpen(true)}><UserPlus size={14} /> Nuevo vendedor</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH>
                  <TH>Email</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Clientes</TH>
                  <TH className="text-right">Pedidos</TH>
                  <TH className="text-right">Ventas</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {sellers.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <div className="text-sm">{s.name}</div>
                      {s.phone && <div className="text-xs text-text-muted">{s.phone}</div>}
                    </TD>
                    <TD className="text-sm text-text-secondary">{s.user.email}</TD>
                    <TD>
                      {s.isActive ? (
                        <Badge tone="success">Activo</Badge>
                      ) : (
                        <Badge tone="danger">Suspendido</Badge>
                      )}
                    </TD>
                    <TD className="text-right font-mono">{s._count.clientAssignments}</TD>
                    <TD className="text-right font-mono">{s._count.requests}</TD>
                    <TD className="text-right font-mono">{s._count.sales}</TD>
                    <TD className="text-right">
                      <Link href={`/sellers/${s.id}`} className="text-text-muted hover:text-accent p-1 inline-block" title="Ver detalle">
                        <ChevronRight size={16} />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Modal crear vendedor */}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Nuevo vendedor"
        description="Se generará un usuario con contraseña aleatoria. Podrás compartir las credenciales una sola vez."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={creating} onClick={create}>Crear vendedor</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={120}
          />
          <Input
            label="Email (será su usuario de login)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            maxLength={200}
          />
          <Input
            label="Teléfono (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            maxLength={40}
          />
        </div>
      </Modal>

      {/* Modal credenciales generadas */}
      <Modal
        open={!!createdCredentials}
        onOpenChange={(o) => !o && setCreatedCredentials(null)}
        title="Vendedor creado — credenciales de acceso"
        description="Copiá y compartilas con el vendedor. Por seguridad, la contraseña no se muestra de nuevo."
        size="md"
        footer={<Button onClick={() => setCreatedCredentials(null)}>Entendido</Button>}
      >
        {createdCredentials && (
          <div className="flex flex-col gap-3">
            <div className="bg-surface-2 border border-border rounded-md p-4 font-mono text-sm">
              <div className="text-text-secondary">Enlace de acceso</div>
              <div className="text-accent break-all mb-3">{sellerLoginUrl}</div>
              <div className="text-text-secondary">Usuario</div>
              <div className="text-text-primary mb-3">{createdCredentials.email}</div>
              <div className="text-text-secondary">Contraseña</div>
              <div className="text-text-primary text-lg font-semibold">{createdCredentials.password}</div>
            </div>
            <Button variant="secondary" onClick={copyCredentials}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link + credenciales</>}
            </Button>
            <div className="text-xs text-text-muted">
              Compartí esos datos con el vendedor (email, WhatsApp, etc). Al entrar, puede cambiar su contraseña desde "Mi perfil".
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
