import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { siteBasePath } from '@/lib/merchant-site'
import { ContactForm } from './ContactForm'
import { Nav } from './Nav'

// Las imagenes de producto se guardan como /api/uploads/{id} (auth). En el
// sitio publico las servimos via /api/site-assets/{id}, que autoriza por
// publicacion del sitio.
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
  const hasGallery = galleryImages.length > 0
  const hasCatalog = products.length > 0

  // En el home mostramos solo un preview de 12; el catalogo completo va en /catalogo
  const previewProducts = products.slice(0, 12)
  const hasMoreCatalog = products.length > previewProducts.length

  const host = headers().get('host')
  const base = siteBasePath(params.slug, host)

  const links: { href: string; label: string }[] = []
  if (hasAbout) links.push({ href: '#nosotros', label: 'Nosotros' })
  if (hasGallery) links.push({ href: '#trabajo', label: 'Trabajo' })
  if (hasCatalog) links.push({ href: `${base}/catalogo`, label: 'Catálogo' })

  return (
    <div id="top">
      <Nav businessName={site.businessName} logoUrl={logoUrl} links={links} homeHref="#top" />

      {/* Hero */}
      <section className="ms-hero">
        <div className="ms-hero-inner">
          <div className="ms-hero-copy">
            <span className="ms-eyebrow">Distribuidora en Venezuela</span>
            <h1 className="ms-hero-title">{site.businessName}</h1>
            {site.tagline && <p className="ms-hero-tagline">{site.tagline}</p>}
            <div className="ms-hero-ctas">
              <a href="#contacto" className="ms-btn ms-btn-primary">Contactar ahora</a>
              {hasCatalog && (
                <a href={`${base}/catalogo`} className="ms-btn ms-btn-outline ms-hero-arrow">Ver catálogo</a>
              )}
            </div>

            <div className="ms-hero-stats">
              <div>
                <div className="ms-hero-stat-num">{products.length}+</div>
                <div className="ms-hero-stat-label">Productos disponibles</div>
              </div>
              <div>
                <div className="ms-hero-stat-num">24 h</div>
                <div className="ms-hero-stat-label">Respuesta promedio</div>
              </div>
              <div>
                <div className="ms-hero-stat-num">100%</div>
                <div className="ms-hero-stat-label">Al mayor y detal</div>
              </div>
            </div>
          </div>
          {heroImage && (
            <div className="ms-hero-visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt={site.businessName} />
            </div>
          )}
        </div>
      </section>

      {/* Nosotros */}
      {hasAbout && (
        <section id="nosotros" className="ms-section">
          <div className="ms-container">
            <span className="ms-section-eyebrow">Sobre nosotros</span>
            <h2 className="ms-section-title">Quiénes somos</h2>
            {site.description && (
              <p className="ms-about-intro">{site.description}</p>
            )}
            {(site.mission || site.vision) && (
              <div className="ms-about-grid">
                {site.mission && (
                  <div className="ms-about-card">
                    <span className="ms-about-card-num">01</span>
                    <h3>Nuestra misión</h3>
                    <p>{site.mission}</p>
                  </div>
                )}
                {site.vision && (
                  <div className="ms-about-card">
                    <span className="ms-about-card-num">02</span>
                    <h3>Nuestra visión</h3>
                    <p>{site.vision}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Galería */}
      {hasGallery && (
        <section id="trabajo" className="ms-section">
          <div className="ms-container">
            <span className="ms-section-eyebrow">En imágenes</span>
            <h2 className="ms-section-title">Así trabajamos</h2>
            <div className="ms-gallery">
              {galleryImages.map((src, i) => (
                <div key={i} className="ms-gallery-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${site.businessName} imagen ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Catálogo (preview) */}
      {hasCatalog && (
        <section id="catalogo" className="ms-section">
          <div className="ms-container">
            <span className="ms-section-eyebrow">Productos</span>
            <h2 className="ms-section-title">Nuestro catálogo</h2>
            <p className="ms-section-subtitle">
              Estos son algunos de los productos que tenemos disponibles ahora mismo.
            </p>
            <div className="ms-catalog">
              {previewProducts.map((p) => (
                <a key={p.id} href={`${base}/catalogo`} className="ms-product">
                  <div className="ms-product-img-wrap">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="ms-product-img" src={publicImageUrl(p.images[0])} alt={p.name} loading="lazy" />
                    ) : (
                      <div className="ms-product-img-empty">◇</div>
                    )}
                  </div>
                  <div className="ms-product-body">
                    {p.category && <span className="ms-product-tag">{p.category}</span>}
                    <h3 className="ms-product-name">{p.name}</h3>
                    <div className="ms-product-price">${p.priceUSD.toFixed(2)}</div>
                  </div>
                </a>
              ))}
            </div>
            {hasMoreCatalog ? (
              <div className="ms-catalog-preview-cta">
                <a href={`${base}/catalogo`} className="ms-btn ms-btn-primary ms-hero-arrow">
                  Ver todos los productos ({products.length})
                </a>
              </div>
            ) : (
              <div className="ms-catalog-preview-cta">
                <a href={`${base}/catalogo`} className="ms-btn ms-btn-outline ms-hero-arrow">
                  Explorar el catálogo con búsqueda y filtros
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Contacto */}
      <section id="contacto" className="ms-section">
        <div className="ms-container">
          <span className="ms-section-eyebrow">Contacto</span>
          <h2 className="ms-section-title">Escríbenos</h2>
          <p className="ms-section-subtitle">
            Cuéntanos qué necesitas y te respondemos lo antes posible.
          </p>
          <div className="ms-contact-grid">
            <div className="ms-contact-info">
              <h3>{site.businessName}</h3>
              <dl>
                {site.contactAddress && (
                  <div>
                    <dt>Dirección</dt>
                    <dd>{site.contactAddress}</dd>
                  </div>
                )}
                {site.contactPhone && (
                  <div>
                    <dt>Teléfono</dt>
                    <dd><a href={`tel:${site.contactPhone}`}>{site.contactPhone}</a></dd>
                  </div>
                )}
                {site.contactEmail && (
                  <div>
                    <dt>Correo</dt>
                    <dd><a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></dd>
                  </div>
                )}
                {!site.contactAddress && !site.contactPhone && !site.contactEmail && (
                  <div>
                    <dt>Horario</dt>
                    <dd>Lunes a viernes, respondemos a la brevedad.</dd>
                  </div>
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

      {/* Footer */}
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
              <a href="#top">Inicio</a>
              {hasAbout && <a href="#nosotros">Nosotros</a>}
              {hasCatalog && <a href={`${base}/catalogo`}>Catálogo</a>}
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
