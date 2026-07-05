'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Stat } from '@/components/ui/Stat'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { formatUSD } from '@/lib/utils'
import { ArrowLeft, UserPlus, KeyRound, Copy, Check, Trash2, Search } from 'lucide-react'

interface SellerData {
  seller: {
    id: string
    name: string
    phone: string | null
    notes: string | null
    isActive: boolean
    user: { email: string; name: string | null }
  }
  assignedClients: Array<{
    id: string
    name: string
    company: string | null
    phone: string | null
    email: string | null
    totalPurchases: number
    priceList: { id: string; name: string } | null
  }>
  stats: {
    requests: number
    salesCount: number
    salesTotalUSD: number
  }
}

interface AllClient {
  id: string
  name: string
  company: string | null
}

export default function SellerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<SellerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [allClients, setAllClients] = useState<AllClient[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignQuery, setAssignQuery] = useState('')
  const [selectedToAssign, setSelectedToAssign] = useState<Set<string>>(new Set())
  const [savingAssignments, setSavingAssignments] = useState(false)
  const [pwd, setPwd] = useState<string | null>(null)
  const [pwdCopied, setPwdCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/sellers/${params.id}`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  const openAssignModal = async () => {
    setSelectedToAssign(new Set())
    if (allClients.length === 0) {
      const r = await fetch('/api/clients')
      if (r.ok) setAllClients(await r.json())
    }
    setAssignOpen(true)
  }

  const currentAssignedIds = useMemo(() => new Set((data?.assignedClients || []).map((c) => c.id)), [data])
  const availableToAssign = useMemo(() => {
    const q = assignQuery.trim().toLowerCase()
    return allClients.filter((c) => {
      if (currentAssignedIds.has(c.id)) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    })
  }, [allClients, assignQuery, currentAssignedIds])

  const saveAssignments = async () => {
    if (selectedToAssign.size === 0) {
      setAssignOpen(false)
      return
    }
    setSavingAssignments(true)
    const r = await fetch(`/api/sellers/${params.id}/clients`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientIds: Array.from(selectedToAssign) }),
    })
    setSavingAssignments(false)
    if (!r.ok) {
      toast.error('Error asignando clientes')
      return
    }
    toast.success(`${selectedToAssign.size} clientes asignados`)
    setAssignOpen(false)
    load()
  }

  const unassign = async (clientId: string) => {
    if (!confirm('¿Quitar este cliente del vendedor?')) return
    const r = await fetch(`/api/sellers/${params.id}/clients?clientId=${clientId}`, { method: 'DELETE' })
    if (!r.ok) { toast.error('Error'); return }
    load()
  }

  const toggleActive = async (isActive: boolean) => {
    const r = await fetch(`/api/sellers/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    if (!r.ok) { toast.error('Error'); return }
    toast.success(isActive ? 'Vendedor habilitado' : 'Vendedor suspendido')
    load()
  }

  const resetPassword = async () => {
    if (!confirm('¿Generar una nueva contraseña? La actual dejará de funcionar.')) return
    const r = await fetch(`/api/sellers/${params.id}/reset-password`, { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error('Error'); return }
    setPwd(d.newPassword)
  }

  const deleteSeller = async () => {
    if (!confirm('¿Eliminar el vendedor? Se le retirará el acceso y se eliminarán todas sus asignaciones. Los pedidos históricos permanecen sin vendedor asociado.')) return
    const r = await fetch(`/api/sellers/${params.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.error('Error'); return }
    toast.success('Vendedor eliminado')
    router.push('/sellers')
  }

  const sellerLoginUrl = typeof window !== 'undefined' ? `${window.location.origin}/vendedor` : '/vendedor'

  const copyPwd = () => {
    if (!pwd || !data) return
    const text = `Portal del vendedor de DistribOS
Enlace: ${sellerLoginUrl}
Usuario: ${data.seller.user.email}
Contraseña: ${pwd}`
    navigator.clipboard.writeText(text)
    setPwdCopied(true)
    setTimeout(() => setPwdCopied(false), 2000)
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Cargando..." subtitle="" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/sellers" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-3">
        <ArrowLeft size={14} /> Vendedores
      </Link>

      <PageHeader
        title={data.seller.name}
        subtitle={data.seller.user.email}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-1.5">
              <Switch
                checked={data.seller.isActive}
                onCheckedChange={toggleActive}
                label={data.seller.isActive ? 'Acceso habilitado' : 'Suspendido'}
              />
            </div>
            <Button variant="secondary" onClick={resetPassword}>
              <KeyRound size={14} /> Nueva contraseña
            </Button>
            <Button variant="danger" onClick={deleteSeller}>
              <Trash2 size={14} /> Eliminar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Stat label="Clientes asignados" value={data.assignedClients.length} accent />
        <Stat label="Pedidos" value={data.stats.requests} />
        <Stat label="Ventas" value={data.stats.salesCount} />
        <Stat label="Total vendido" value={formatUSD(data.stats.salesTotalUSD)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Clientes asignados</CardTitle>
            <Button size="sm" onClick={openAssignModal}>
              <UserPlus size={14} /> Asignar clientes
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {data.assignedClients.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              Aún no tiene clientes asignados. Todos los clientes que este vendedor cree se le asignarán automáticamente.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Cliente</TH>
                  <TH>Contacto</TH>
                  <TH>Lista de precios</TH>
                  <TH className="text-right">Total compras</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data.assignedClients.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <div className="text-sm">{c.name}</div>
                      {c.company && <div className="text-xs text-text-muted">{c.company}</div>}
                    </TD>
                    <TD className="text-xs text-text-secondary">
                      {c.email && <div>{c.email}</div>}
                      {c.phone && <div>{c.phone}</div>}
                    </TD>
                    <TD>
                      {c.priceList ? (
                        <Badge tone="info">{c.priceList.name}</Badge>
                      ) : (
                        <span className="text-xs text-text-muted">Precios base</span>
                      )}
                    </TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(c.totalPurchases)}</TD>
                    <TD className="text-right">
                      <button
                        onClick={() => unassign(c.id)}
                        className="text-text-muted hover:text-danger p-1"
                        title="Quitar asignación"
                      >
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

      {/* Asignar clientes modal */}
      <Modal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Asignar clientes"
        description={`Selecciona clientes para asignar a ${data.seller.name}.`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button
              loading={savingAssignments}
              disabled={selectedToAssign.size === 0}
              onClick={saveAssignments}
            >
              Asignar {selectedToAssign.size > 0 ? `(${selectedToAssign.size})` : ''}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={assignQuery}
              onChange={(e) => setAssignQuery(e.target.value)}
              placeholder="Buscar cliente por nombre o empresa"
              className="pl-9"
            />
          </div>
          <div className="border border-border rounded-md max-h-[400px] overflow-y-auto">
            {availableToAssign.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-muted">
                {allClients.length === 0
                  ? 'No hay clientes creados aún.'
                  : 'No hay clientes disponibles para asignar (o el filtro no matchea).'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {availableToAssign.map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 p-3 hover:bg-surface-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedToAssign.has(c.id)}
                        onChange={(e) => {
                          setSelectedToAssign((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            return next
                          })
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary">{c.name}</div>
                        {c.company && <div className="text-xs text-text-muted">{c.company}</div>}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Nueva password */}
      <Modal
        open={!!pwd}
        onOpenChange={(o) => !o && setPwd(null)}
        title="Nueva contraseña generada"
        description="La contraseña anterior ya no funciona. Compártela con el vendedor."
        size="md"
        footer={<Button onClick={() => setPwd(null)}>Cerrar</Button>}
      >
        {pwd && (
          <div className="flex flex-col gap-3">
            <div className="bg-surface-2 border border-border rounded-md p-4 font-mono text-sm">
              <div className="text-text-secondary">Enlace de acceso</div>
              <div className="text-accent break-all mb-3">{sellerLoginUrl}</div>
              <div className="text-text-secondary">Usuario</div>
              <div className="text-text-primary mb-3">{data.seller.user.email}</div>
              <div className="text-text-secondary">Nueva contraseña</div>
              <div className="text-text-primary text-lg font-semibold">{pwd}</div>
            </div>
            <Button variant="secondary" onClick={copyPwd}>
              {pwdCopied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link + credenciales</>}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
