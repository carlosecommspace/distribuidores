import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import { siteBasePath } from '@/lib/merchant-site'
import { Nav } from '../Nav'
import { ContactForm } from '../ContactForm'
import { CatalogBrowser } from './CatalogBrowser'

function publicImageUrl(u: string): string {
  const m = u.match(/\/api\/uploads\/([a-zA-Z0-9_-]+)/)
  return m ? `/api/site-assets/${m[1]}` : u
}

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await prisma.merchantSite.findUnique({
    where: { slug: params.slug },
    select: { businessName: true, tagline: true, isPublished: true },
  })
  if (!site || !site.isPublished) return { title: 'Catálogo' }
  return {
    title: `Catálogo · ${site.businessName}`,
    description: site.tagline || undefined,
  }
}

export default async function CatalogoPage({ params }: Props) {
  const site = await prisma.merchantSite.findUnique({ where: { slug: params.slug } })
  if (!site || !site.isPublished) notFound()

  const products = await prisma.product.findMany({
    where: { userId: site.userId, isActive: true, stock: { gt: 0 } },
    select: {
      id: true, name: true, priceUSD: true, unit: true, category: true,
      images: true, description: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: 500,
  })

  const logoUrl = site.logoFileId ? `/api/site-assets/${site.logoFileId}` : null

  const categoriesSet = new Set<string>()
  for (const p of products) {
    if (p.category) categoriesSet.add(p.category)
  }
  const categories = Array.from(categoriesSet).sort()

  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    priceUSD: p.priceUSD,
    unit: p.unit,
    category: p.category,
    imageUrl: p.images[0] ? publicImageUrl(p.images[0]) : null,
    description: p.description,
  }))

  const host = headers().get('host')
  const base = siteBasePath(params.slug, host)
  const home = base || '/'

  const links = [
    { href: home, label: 'Inicio' },
    { href: `${home}#nosotros`, label: 'Nosotros' },
    { href: `${home}#trabajo`, label: 'Trabajo' },
  ]

  return (
    <div id="top">
      <Nav businessName={site.businessName} logoUrl={logoUrl} links={links} />

      {/* Header de la página */}
      <section className="ms-cat-header">
        <div className="ms-container">
          <span className="ms-section-eyebrow">Catálogo</span>
          <h1 className="ms-cat-title">Todos los productos</h1>
          <p className="ms-cat-lead">
            {products.length > 0
              ? `${products.length} ${products.length === 1 ? 'producto disponible' : 'productos disponibles'}. Escríbenos por cualquier producto que te interese.`
              : 'Aún no hay productos publicados. Vuelve pronto o escríbenos directamente.'}
          </p>
        </div>
      </section>

      {/* Browser */}
      <section className="ms-section" style={{ paddingTop: '2rem' }}>
        <div className="ms-container">
          <CatalogBrowser products={items} categories={categories} />
        </div>
      </section>

      {/* Contacto compacto — CTA para consultar */}
      <section id="contacto" className="ms-section">
        <div className="ms-container">
          <span className="ms-section-eyebrow">Contacto</span>
          <h2 className="ms-section-title">¿Te interesa algún producto?</h2>
          <p className="ms-section-subtitle">
            Cuéntanos qué necesitas y te respondemos con precio, disponibilidad y forma de pago.
          </p>
          <div className="ms-contact-grid">
            <div className="ms-contact-info">
              <h3>{site.businessName}</h3>
              <dl>
                {site.contactAddress && (
                  <div><dt>Dirección</dt><dd>{site.contactAddress}</dd></div>
                )}
                {site.contactPhone && (
                  <div><dt>Teléfono</dt><dd><a href={`tel:${site.contactPhone}`}>{site.contactPhone}</a></dd></div>
                )}
                {site.contactEmail && (
                  <div><dt>Correo</dt><dd><a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></dd></div>
                )}
              </dl>
            </div>
            <div className="ms-form-wrap">
              <h3>Envíanos un mensaje</h3>
              <p>Completa el formulario y te contactamos.</p>
              <ContactForm slug={site.slug} />
            </div>
          </div>
        </div>
      </section>

      <footer className="ms-footer">
        <div className="ms-footer-inner">
          <div>
            <div className="ms-footer-brand">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={site.businessName} />
              )}
              <span>{site.businessName}</span>
            </div>
            {site.tagline && <p>{site.tagline}</p>}
          </div>
          <div>
            <h4>Navegación</h4>
            <div className="ms-footer-links">
              <a href={home}>Inicio</a>
              <a href={`${home}#nosotros`}>Nosotros</a>
              <a href={`${base}/catalogo`}>Catálogo</a>
              <a href="#contacto">Contacto</a>
            </div>
          </div>
          <div>
            <h4>Contacto</h4>
            <div className="ms-footer-links">
              {site.contactEmail && <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>}
              {site.contactPhone && <a href={`tel:${site.contactPhone}`}>{site.contactPhone}</a>}
              {site.contactAddress && <span style={{ opacity: 0.65, fontSize: '0.9rem' }}>{site.contactAddress}</span>}
            </div>
          </div>
        </div>
        <div className="ms-footer-credit">
          © {new Date().getFullYear()} {site.businessName}. Sitio impulsado por DistribOS.
        </div>
      </footer>
    </div>
  )
}
