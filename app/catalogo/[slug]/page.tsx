import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatUSD } from '@/lib/utils'
import { CatalogSearch } from './CatalogSearch'

export const revalidate = 60

export default async function CatalogPage({ params }: { params: { slug: string } }) {
  // El slug puede ser el slug o un prefijo del ID
  let user = await prisma.user.findFirst({ where: { OR: [{ slug: params.slug }, { id: { startsWith: params.slug } }] } })
  if (!user) notFound()

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } })
  const products = await prisma.product.findMany({
    where: { userId: user.id, isActive: true, stock: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })

  const phone = settings?.waPhoneNumber?.replace(/[^\d]/g, '') || ''

  return (
    <main className="min-h-screen bg-bg">
      <div className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{user.company || user.name || 'Catálogo'}</h1>
            <p className="text-sm text-text-secondary mt-0.5">Catálogo en línea</p>
          </div>
          {phone && (
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent('Hola, vengo del catálogo')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-accent text-black px-4 py-2 rounded-md font-medium text-sm"
            >
              Contactar
            </a>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <CatalogSearch products={products.map((p) => ({
          id: p.id, sku: p.sku, name: p.name, category: p.category,
          priceUSD: p.priceUSD, stock: p.stock, unit: p.unit, images: p.images,
        }))} phone={phone} />
      </div>

      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-text-muted">
        Catálogo en línea — generado por DistribOS
      </footer>
    </main>
  )
}
