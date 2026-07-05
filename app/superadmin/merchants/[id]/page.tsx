'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { formatDateTime, formatRelative } from '@/lib/utils'
import { ArrowLeft, ExternalLink, Building2 } from 'lucide-react'

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
    requests: number
    categories: number
  }
  merchantSite: { slug: string; isPublished: boolean; businessName: string } | null
}

export default function SuperadminMerchantDetailPage() {
  const params = useParams<{ id: string }>()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/superadmin/merchants/${params.id}`)
    if (r.ok) {
      const d = await r.json()
      setMerchant(d.merchant)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  const toggleActive = async (v: boolean) => {
    const r = await fetch(`/api/superadmin/merchants/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: v }),
    })
    if (!r.ok) { toast.error('Error'); return }
    toast.success(v ? 'Merchant habilitado' : 'Merchant suspendido')
    load()
  }

  if (loading || !merchant) {
    return (
      <div>
        <PageHeader title="Cargando..." subtitle="" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/superadmin" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-3">
        <ArrowLeft size={14} /> Merchants
      </Link>

      <PageHeader
        title={merchant.name || merchant.email}
        subtitle={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono">{merchant.email}</span>
            {merchant.isActive ? (
              <Badge tone="success">Activo</Badge>
            ) : (
              <Badge tone="danger">Suspendido</Badge>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-1.5">
            <Switch
              checked={merchant.isActive}
              onCheckedChange={toggleActive}
              label={merchant.isActive ? 'Habilitado' : 'Suspendido'}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Stat label="Productos" value={merchant._count.products} accent />
        <Stat label="Clientes" value={merchant._count.clients} />
        <Stat label="Ventas" value={merchant._count.sales} />
        <Stat label="Vendedores" value={merchant._count.sellersOwned} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Datos de la cuenta</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <Field label="Empresa" value={merchant.company || '—'} icon={<Building2 size={12} />} />
            <Field label="Email" value={merchant.email} mono />
            <Field label="Teléfono" value={merchant.phone || '—'} />
            <Field label="ID" value={merchant.id} mono />
            <Field label="Creado el" value={formatDateTime(merchant.createdAt)} hint={formatRelative(merchant.createdAt)} />
            <Field label="Última modificación" value={formatDateTime(merchant.updatedAt)} hint={formatRelative(merchant.updatedAt)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actividad</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <Field label="Categorías" value={String(merchant._count.categories)} />
            <Field label="Pedidos" value={String(merchant._count.requests)} />
            {merchant.merchantSite ? (
              <>
                <Field
                  label="Sitio público"
                  value={merchant.merchantSite.businessName}
                  hint={
                    <span className="inline-flex items-center gap-1">
                      <span className="font-mono">/{merchant.merchantSite.slug}</span>
                      {merchant.merchantSite.isPublished && <Badge tone="success">Publicado</Badge>}
                    </span>
                  }
                />
                <a
                  href={`/sites/${merchant.merchantSite.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Ver sitio <ExternalLink size={11} />
                </a>
              </>
            ) : (
              <div className="text-xs text-text-muted">Aún no ha configurado su sitio web.</div>
            )}
          </CardBody>
        </Card>
      </div>

      {!merchant.isActive && (
        <div className="mt-6 bg-warning-subtle border border-warning/30 rounded-md p-4 text-sm">
          <div className="font-semibold text-text-primary mb-1">Cuenta suspendida</div>
          <div className="text-text-secondary">
            El merchant no puede iniciar sesión mientras esté suspendido. Todos sus vendedores y clientes del portal también quedan bloqueados. Sus datos permanecen intactos.
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, hint, mono, icon }: { label: string; value: string; hint?: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`text-sm text-text-primary mt-1 ${mono ? 'font-mono' : ''}`}>{value}</div>
      {hint && <div className="text-xs text-text-muted mt-0.5">{hint}</div>}
    </div>
  )
}
