'use client'
import { useEffect, useState } from 'react'

interface NavLink {
  href: string
  label: string
}

interface Props {
  businessName: string
  logoUrl: string | null
  links: NavLink[]
  /** URL a la que apunta el logo/nombre. En el home usar "#top", en otras rutas la URL del home. */
  homeHref: string
}

export function Nav({ businessName, logoUrl, links, homeHref }: Props) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    // Bloquear scroll cuando el menu mobile esta abierto
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header className={`ms-nav-wrap${scrolled ? ' ms-nav-scrolled' : ''}`}>
      <div className="ms-nav">
        <a href={homeHref} className="ms-nav-brand" onClick={() => setOpen(false)}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} />
          )}
          <span>{businessName}</span>
        </a>
        <nav className="ms-nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
          <a href="#contacto" className="ms-nav-cta">Contactar</a>
        </nav>
        <button
          type="button"
          className="ms-nav-toggle"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`ms-nav-toggle-icon${open ? ' is-open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>
      </div>

      {/* Menu mobile: overlay full-screen */}
      <div className={`ms-nav-mobile${open ? ' is-open' : ''}`} onClick={() => setOpen(false)}>
        <nav className="ms-nav-mobile-inner" onClick={(e) => e.stopPropagation()}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <a href="#contacto" className="ms-nav-cta" onClick={() => setOpen(false)}>Contactar</a>
        </nav>
      </div>
    </header>
  )
}
