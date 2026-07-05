import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ContactForm } from './ContactForm'

// Las imagenes de producto se guardan como /api/uploads/{id} (auth). En el
// sitio publico, redirigimos al endpoint publico /api/site-assets/{id} que
// autoriza por publicacion del sitio.
function publicImageUrl(u: string): string {
  const m = u.match(/\/api\/uploads\/([a-zA-Z0-9_-]+)/)
  return m ? `/api/site-assets/${m[1]}` : u
}

interface Props {
  params: { slug: string }
}

export default async function SitePage({ params }: Props) {
  const site = await prisma.merchantSite.findUnique({ where: { slug: params.slug } })
  if (!site || !site.isPublished) notFound()

  const products = await prisma.product.findMany({
    where: { userId: site.userId, isActive: true, stock: { gt: 0 } },
    select: { id: true, sku: true, name: true, priceUSD: true, stock: true, unit: true, images: true, category: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 60,
  })

  const heroImage = site.imageFileIds[0] ? `/api/site-assets/${site.imageFileIds[0]}` : null
  const galleryImages = site.imageFileIds.slice(1, 7).map((id) => `/api/site-assets/${id}`)
  const logoUrl = site.logoFileId ? `/api/site-assets/${site.logoFileId}` : null

  const hasAbout = !!(site.mission || site.vision || site.description)

  return (
    <>
      {/* Nav */}
      <header>
        <div className="ms-nav">
          <div className="ms-nav-brand">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={site.businessName} />
            )}
            <span>{site.businessName}</span>
          </div>
          <nav className="ms-nav-links">
            {hasAbout && <a href="#nosotros">Nosotros</a>}
            {products.length > 0 && <a href="#catalogo">Catálogo</a>}
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="ms-container ms-hero">
        <div className="ms-hero-inner">
          <div>
            <h1 className="ms-hero-title">{site.businessName}</h1>
            {site.tagline && <p className="ms-hero-tagline">{site.tagline}</p>}
            <a href="#contacto" className="ms-hero-cta">Contáctanos</a>
          </div>
          {heroImage && (
            <div className="ms-hero-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt={site.businessName} />
            </div>
          )}
        </div>
      </section>

      {/* Nosotros */}
      {hasAbout && (
        <section id="nosotros" className="ms-container ms-section">
          <h2 className="ms-section-title">Nosotros</h2>
          {site.description && <p className="ms-section-subtitle">{site.description}</p>}
          <div className="ms-about-grid">
            {site.mission && (
              <div className="ms-about-card">
                <h3>Misión</h3>
                <p>{site.mission}</p>
              </div>
            )}
            {site.vision && (
              <div className="ms-about-card">
                <h3>Visión</h3>
                <p>{site.vision}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Galería */}
      {galleryImages.length > 0 && (
        <section className="ms-container ms-section">
          <h2 className="ms-section-title">Nuestro trabajo</h2>
          <div className="ms-gallery">
            {galleryImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`${site.businessName} imagen ${i + 1}`} loading="lazy" />
            ))}
          </div>
        </section>
      )}

      {/* Catálogo */}
      {products.length > 0 && (
        <section id="catalogo" className="ms-container ms-section">
          <h2 className="ms-section-title">Catálogo</h2>
          <p className="ms-section-subtitle">
            {products.length === 60 ? 'Explora una selección de nuestros productos disponibles.' : 'Estos son los productos que tenemos disponibles ahora.'}
          </p>
          <div className="ms-catalog">
            {products.map((p) => (
              <div key={p.id} className="ms-product">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ms-product-img" src={publicImageUrl(p.images[0])} alt={p.name} loading="lazy" />
                ) : (
                  <div className="ms-product-img" />
                )}
                <div className="ms-product-body">
                  <div className="ms-product-name">{p.name}</div>
                  <div className="ms-product-price">${p.priceUSD.toFixed(2)}</div>
                  <div className="ms-product-meta">{p.category || p.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contacto */}
      <section id="contacto" className="ms-container ms-section">
        <h2 className="ms-section-title">Contáctanos</h2>
        <div className="ms-contact-grid">
          <div className="ms-contact-info">
            <p><strong>{site.businessName}</strong></p>
            {site.contactAddress && <p>{site.contactAddress}</p>}
            {site.contactPhone && <p>Teléfono: <a href={`tel:${site.contactPhone}`}>{site.contactPhone}</a></p>}
            {site.contactEmail && <p>Correo: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></p>}
          </div>
          <ContactForm slug={site.slug} />
        </div>
      </section>

      <footer className="ms-footer">
        © {new Date().getFullYear()} {site.businessName}. Sitio impulsado por DistribOS.
      </footer>
    </>
  )
}
