'use client'
import { useMemo, useState } from 'react'

interface Product {
  id: string
  name: string
  priceUSD: number
  unit: string
  category: string | null
  imageUrl: string | null
  description: string | null
}

interface Props {
  products: Product[]
  categories: string[]
}

type View = 'grid' | 'list'

export function CatalogBrowser({ products, categories }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [view, setView] = useState<View>('grid')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      )
    })
  }, [products, query, category])

  return (
    <div className="ms-cat-page">
      {/* Toolbar */}
      <div className="ms-cat-toolbar">
        <div className="ms-cat-search">
          <svg className="ms-cat-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Buscar en el catálogo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="ms-cat-view-toggle" role="tablist" aria-label="Cambiar vista">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'grid'}
            className={view === 'grid' ? 'is-active' : ''}
            onClick={() => setView('grid')}
            aria-label="Vista de cuadrícula"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span>Cuadrícula</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            className={view === 'list' ? 'is-active' : ''}
            onClick={() => setView('list')}
            aria-label="Vista de lista"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Lista</span>
          </button>
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="ms-cat-chips">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`ms-cat-chip${category === null ? ' is-active' : ''}`}
          >
            Todas
            <span className="ms-cat-chip-count">{products.length}</span>
          </button>
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c).length
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`ms-cat-chip${category === c ? ' is-active' : ''}`}
              >
                {c}
                <span className="ms-cat-chip-count">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Results count */}
      <div className="ms-cat-count">
        {filtered.length === products.length
          ? `${products.length} productos`
          : `${filtered.length} de ${products.length} productos`}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="ms-cat-empty">
          <p>No encontramos productos que coincidan.</p>
          <button type="button" onClick={() => { setQuery(''); setCategory(null) }} className="ms-btn ms-btn-outline">
            Limpiar filtros
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="ms-catalog">
          {filtered.map((p) => (
            <a key={p.id} href="#contacto" className="ms-product">
              <div className="ms-product-img-wrap">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ms-product-img" src={p.imageUrl} alt={p.name} loading="lazy" />
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
      ) : (
        <ul className="ms-cat-list">
          {filtered.map((p) => (
            <li key={p.id}>
              <a href="#contacto" className="ms-cat-list-item">
                <div className="ms-cat-list-img">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" />
                  ) : (
                    <div className="ms-cat-list-img-empty">◇</div>
                  )}
                </div>
                <div className="ms-cat-list-body">
                  {p.category && <span className="ms-product-tag">{p.category}</span>}
                  <h3 className="ms-cat-list-name">{p.name}</h3>
                  {p.description && (
                    <p className="ms-cat-list-desc">{p.description}</p>
                  )}
                  <div className="ms-cat-list-meta">
                    <span>Vendido por {p.unit}</span>
                  </div>
                </div>
                <div className="ms-cat-list-price">
                  <div className="ms-product-price">${p.priceUSD.toFixed(2)}</div>
                  <span className="ms-cat-list-cta">Consultar →</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
