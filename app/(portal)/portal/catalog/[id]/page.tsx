'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatUSD } from '@/lib/utils'
import { ArrowLeft, Package } from 'lucide-react'

interface ProductDetail {
  id: string
  sku: string
  name: string
  description?: string | null
  category?: string | null
  brand?: string | null
  unit: string
  image?: string | null
  priceUSD: number
  stock: number
}

export default function PortalProductDetail() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/portal/catalog/${params.id}`).then((r) => r.json()).then((d) => {
      if (d?.error) setData(null)
      else setData(d)
      setLoading(false)
    })
  }, [params.id])

  if (loading) return <Skeleton className="h-96" />
  if (!data) {
    return (
      <EmptyState
        icon={<Package size={32} />}
        title="Producto no encontrado"
        description="Este producto ya no está disponible en el catálogo."
        action={<Link href="/portal/catalog"><Button variant="secondary"><ArrowLeft size={14} /> Volver al catálogo</Button></Link>}
      />
    )
  }

  const soldOut = data.stock <= 0

  return (
    <div>
      <Link href="/portal/catalog" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="aspect-square bg-surface-2 flex items-center justify-center">
            {data.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <Package size={64} className="text-text-muted" />
            )}
          </div>
        </Card>

        <div className="lg:col-span-3 flex flex-col gap-5">
          <div>
            <div className="text-xs font-mono text-text-muted">{data.sku}</div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary mt-1">{data.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-text-secondary flex-wrap">
              {data.category && <Badge>{data.category}</Badge>}
              {data.brand && <span>Marca: {data.brand}</span>}
              <span>Unidad: {data.unit}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl text-accent">{formatUSD(data.priceUSD)}</span>
            <span className="text-sm text-text-muted">por {data.unit}</span>
          </div>

          <div>
            {soldOut ? (
              <Badge tone="danger">Sin stock disponible</Badge>
            ) : (
              <div className="text-sm text-text-secondary">
                Stock disponible: <span className="font-mono text-text-primary">{data.stock} {data.unit}</span>
              </div>
            )}
          </div>

          {data.description && (
            <Card>
              <CardBody>
                <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Descripción</div>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{data.description}</p>
              </CardBody>
            </Card>
          )}

          <div className="flex gap-2">
            <Link href="/portal/catalog">
              <Button variant="secondary">Volver al catálogo</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
