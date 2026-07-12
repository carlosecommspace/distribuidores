'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface Meta {
  company: string
  email: string
  phone: string
  from: string
  to: string
  generatedAt: string
  rate?: number
  totalUSD?: number
  totalBs?: number
  paidUSD?: number
  inventoryValue?: number
  potentialRevenue?: number
}

interface Payload {
  kind: string
  title: string
  meta: Meta
  rows: Record<string, unknown>[]
}

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ReportPrintPage() {
  const params = useParams<{ kind: string }>()
  const search = useSearchParams()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = new URLSearchParams()
    if (search.get('from')) q.set('from', search.get('from')!)
    if (search.get('to')) q.set('to', search.get('to')!)
    fetch(`/api/reports/${params.kind}?${q.toString()}`).then(async (r) => {
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(typeof d.error === 'string' ? d.error : 'No se pudo cargar el reporte')
        return
      }
      const d = (await r.json()) as Payload
      setData(d)
    }).catch((e) => setError(String(e)))
  }, [params.kind, search])

  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [data])

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-sm text-gray-500">Cargando reporte…</div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @page { size: A4 landscape; margin: 14mm; }
          @media print {
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          .report {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #0F0F0F;
            font-size: 11px;
            padding: 24px;
            max-width: 1200px;
            margin: 0 auto;
          }
          .report h1 { font-size: 22px; margin: 0 0 4px 0; font-weight: 700; }
          .report h2 { font-size: 13px; margin: 24px 0 8px 0; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
          .report .brand { color: #F5A623; }
          .report .meta-block { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin: 16px 0; padding: 12px 16px; background: #FAF7F0; border: 1px solid #E7E3DA; border-radius: 6px; }
          .report .meta-block .label { text-transform: uppercase; font-size: 9px; color: #888; letter-spacing: 0.05em; margin-bottom: 2px; }
          .report .meta-block .val { font-size: 12px; color: #0F0F0F; font-weight: 500; }
          .report table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          .report thead th { background: #F5F3EF; border-bottom: 2px solid #0F0F0F; padding: 8px 6px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.04em; }
          .report tbody td { padding: 6px; border-bottom: 1px solid #EEE; vertical-align: top; }
          .report tbody tr:nth-child(even) td { background: #FCFBF8; }
          .report .num { font-family: ui-monospace, monospace; text-align: right; white-space: nowrap; }
          .report .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E7E3DA; font-size: 9.5px; color: #888; display: flex; justify-content: space-between; }
          .report .accent-total { font-family: ui-monospace, monospace; font-weight: 700; color: #F5A623; }
          .report .status-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
          .report .status-paid { background: #DCFCE7; color: #166534; }
          .report .status-pending { background: #FEF3C7; color: #92400E; }
          .report .status-partial { background: #DBEAFE; color: #1E40AF; }
          .report .status-released { background: #E0F2FE; color: #075985; }
          .report .status-cancelled { background: #FEE2E2; color: #991B1B; }
        `,
      }} />

      <div className="no-print" style={{ position: 'fixed', top: 8, right: 8, zIndex: 10 }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#F5A623', color: '#000', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="report">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>
              {data.title}
              <span className="brand"> · DistribOS</span>
            </h1>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              {fmtDate(data.meta.from)} → {fmtDate(data.meta.to)}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#666' }}>
            <div style={{ fontWeight: 600, color: '#0F0F0F', fontSize: 13 }}>{data.meta.company}</div>
            {data.meta.email && <div>{data.meta.email}</div>}
            {data.meta.phone && <div>{data.meta.phone}</div>}
          </div>
        </div>

        <div className="meta-block">
          <div>
            <div className="label">Periodo</div>
            <div className="val">{fmtDate(data.meta.from)} — {fmtDate(data.meta.to)}</div>
          </div>
          <div>
            <div className="label">Generado</div>
            <div className="val">{fmtDateTime(data.meta.generatedAt)}</div>
          </div>
          {data.meta.rate !== undefined && data.meta.rate > 0 && (
            <div>
              <div className="label">Tasa BCV vigente</div>
              <div className="val">Bs {fmt(data.meta.rate, 4)}</div>
            </div>
          )}
          <div>
            <div className="label">Registros</div>
            <div className="val">{data.rows.length}</div>
          </div>
        </div>

        <ReportTable kind={data.kind} rows={data.rows} />

        {(data.meta.totalUSD !== undefined || data.meta.paidUSD !== undefined || data.meta.inventoryValue !== undefined) && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: '#F5F3EF', borderRadius: 6, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {data.meta.totalUSD !== undefined && (
              <div>
                <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total USD</div>
                <div className="accent-total" style={{ fontSize: 16 }}>${fmt(data.meta.totalUSD)}</div>
              </div>
            )}
            {data.meta.totalBs !== undefined && data.meta.totalBs > 0 && (
              <div>
                <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Bs</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>Bs {fmt(data.meta.totalBs)}</div>
              </div>
            )}
            {data.meta.paidUSD !== undefined && (
              <div>
                <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>${fmt(data.meta.paidUSD)}</div>
              </div>
            )}
            {data.meta.inventoryValue !== undefined && (
              <div>
                <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor de inventario (costo)</div>
                <div className="accent-total" style={{ fontSize: 16 }}>${fmt(data.meta.inventoryValue)}</div>
              </div>
            )}
            {data.meta.potentialRevenue !== undefined && (
              <div>
                <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Potencial a precio venta</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>${fmt(data.meta.potentialRevenue)}</div>
              </div>
            )}
          </div>
        )}

        <div className="footer">
          <div>Generado con DistribOS · {fmtDateTime(data.meta.generatedAt)}</div>
          <div>{data.rows.length} registros</div>
        </div>
      </div>
    </>
  )
}

function ReportTable({ kind, rows }: { kind: string; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#888', fontSize: 12 }}>Sin registros en el rango elegido.</div>
  }

  if (kind === 'sellers') {
    return (
      <table>
        <thead><tr>
          <th>Nombre</th><th>Email</th><th>Teléfono</th><th>Estado</th>
          <th className="num">Clientes asignados</th><th className="num">Creados por el vendedor</th>
          <th className="num">Ventas del periodo</th><th className="num">Ingresos USD</th>
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={String(r.id)}>
            <td>{String(r.name)}</td>
            <td>{String(r.email || '—')}</td>
            <td>{String(r.phone || '—')}</td>
            <td>{r.isActive ? <span className="status-badge status-paid">Activo</span> : <span className="status-badge status-cancelled">Suspendido</span>}</td>
            <td className="num">{String(r.clientsAssigned || 0)}</td>
            <td className="num">{String(r.clientsCreated || 0)}</td>
            <td className="num">{String(r.salesInPeriod || 0)}</td>
            <td className="num accent-total">${fmt(Number(r.revenueInPeriodUSD) || 0)}</td>
          </tr>
        ))}</tbody>
      </table>
    )
  }

  if (kind === 'clients') {
    return (
      <table>
        <thead><tr>
          <th>Cliente</th><th>Empresa</th><th>RIF</th><th>Ciudad</th><th>Lista</th>
          <th className="num">Compras totales</th><th className="num">En el periodo</th><th className="num">Última compra</th>
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={String(r.id)}>
            <td>
              <div>{String(r.name)}</div>
              {r.phone ? <div style={{ fontSize: 9, color: '#888' }}>{String(r.phone)}</div> : null}
            </td>
            <td>{String(r.company || '—')}</td>
            <td>{String(r.rif || '—')}</td>
            <td>{String(r.city || '—')}</td>
            <td>{String(r.priceList || 'Base')}</td>
            <td className="num accent-total">${fmt(Number(r.totalPurchases) || 0)}</td>
            <td className="num">${fmt(Number(r.revenueInPeriodUSD) || 0)}</td>
            <td className="num">{r.lastPurchase ? fmtDate(String(r.lastPurchase)) : '—'}</td>
          </tr>
        ))}</tbody>
      </table>
    )
  }

  if (kind === 'sales') {
    return (
      <table>
        <thead><tr>
          <th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Canal</th><th>Método</th><th>Estado</th>
          <th className="num">Items</th><th className="num">Unid.</th><th className="num">USD</th><th className="num">Bs</th>
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={String(r.id)}>
            <td>{fmtDateTime(String(r.createdAt))}</td>
            <td>{String(r.client || 'Ocasional')}{r.clientCompany ? <div style={{ fontSize: 9, color: '#888' }}>{String(r.clientCompany)}</div> : null}</td>
            <td>{String(r.seller || '—')}</td>
            <td>{String(r.channel)}</td>
            <td>{String(r.paymentMethod)}</td>
            <td><span className={`status-badge status-${r.paymentStatus === 'paid' ? 'paid' : r.paymentStatus === 'pending' ? 'pending' : 'partial'}`}>{String(r.paymentStatus)}</span></td>
            <td className="num">{String(r.itemsCount)}</td>
            <td className="num">{String(r.unitsCount)}</td>
            <td className="num accent-total">${fmt(Number(r.totalUSD))}</td>
            <td className="num">Bs {fmt(Number(r.totalBs))}</td>
          </tr>
        ))}</tbody>
      </table>
    )
  }

  if (kind === 'requests') {
    return (
      <table>
        <thead><tr>
          <th>Código</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Estado</th>
          <th className="num">Items</th><th className="num">Total USD</th><th className="num">Cobrado</th><th className="num">Saldo</th>
        </tr></thead>
        <tbody>{rows.map((r) => {
          const total = Number(r.totalUSD) || 0
          const paid = Number(r.paidUSD) || 0
          const balance = total - paid
          return (
            <tr key={String(r.id)}>
              <td>{String(r.code || r.id).slice(0, 12)}</td>
              <td>{fmtDateTime(String(r.createdAt))}</td>
              <td>{String(r.client || '—')}{r.clientCompany ? <div style={{ fontSize: 9, color: '#888' }}>{String(r.clientCompany)}</div> : null}</td>
              <td>{String(r.seller || '—')}</td>
              <td><span className={`status-badge status-${String(r.status) === 'released' ? 'released' : String(r.status) === 'paid' ? 'paid' : String(r.status) === 'cancelled' ? 'cancelled' : String(r.status) === 'partially_paid' ? 'partial' : 'pending'}`}>{String(r.status)}</span></td>
              <td className="num">{String(r.itemsCount)}</td>
              <td className="num accent-total">${fmt(total)}</td>
              <td className="num">${fmt(paid)}</td>
              <td className="num" style={{ color: balance > 0 ? '#B45309' : '#166534' }}>${fmt(balance)}</td>
            </tr>
          )
        })}</tbody>
      </table>
    )
  }

  // inventory
  return (
    <table>
      <thead><tr>
        <th>SKU</th><th>Producto</th><th>Categoría</th>
        <th className="num">Stock</th><th className="num">Mín</th>
        <th className="num">Costo USD</th><th className="num">Precio USD</th><th className="num">Valor USD</th>
      </tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={String(r.id)}>
          <td style={{ fontFamily: 'ui-monospace, monospace' }}>{String(r.sku)}</td>
          <td>{String(r.name)}{r.lowStock ? <span className="status-badge status-pending" style={{ marginLeft: 6 }}>Bajo stock</span> : null}</td>
          <td>{String(r.category || '—')}</td>
          <td className="num">{String(r.stock)}</td>
          <td className="num">{String(r.stockMin)}</td>
          <td className="num">${fmt(Number(r.costUSD))}</td>
          <td className="num">${fmt(Number(r.priceUSD))}</td>
          <td className="num accent-total">${fmt(Number(r.valueUSD))}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}
