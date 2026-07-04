'use client'
import { useEffect } from 'react'
import { formatUSD, formatDateTime } from '@/lib/utils'

interface PrintPayment {
  amountUSD: number
  method: string
  reference?: string | null
  status: string
  createdAt: string
}

interface PrintItem {
  quantity: number
  priceUSD: number
  subtotalUSD: number
  product: { name: string; sku: string; unit?: string | null }
}

export interface OrderPrintData {
  code?: string | null
  id: string
  status: string
  totalUSD: number
  paidUSD: number
  createdAt: string
  notes?: string | null
  releasedAt?: string | null
  company: {
    name: string          // Empresa emisora (distribuidor)
    phone?: string | null
    email?: string | null
    rif?: string | null
  }
  client: {
    name: string
    company?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
  }
  items: PrintItem[]
  payments?: PrintPayment[]
  exchangeRate?: number | null
}

export function OrderPrintable({ data, auto = true }: { data: OrderPrintData; auto?: boolean }) {
  useEffect(() => {
    if (!auto) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [auto])

  const outstanding = Math.max(0, data.totalUSD - data.paidUSD)

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm; }
        html, body {
          background: #ffffff !important;
          color: #111111 !important;
          font-family: 'DM Sans', system-ui, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .op-mono { font-family: 'DM Mono', ui-monospace, monospace; }
        .op-display { font-family: 'Syne', system-ui, sans-serif; }
        .op-page { max-width: 720px; margin: 24px auto; padding: 24px; color: #111; }
        .op-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px;
        }
        .op-brand { font-weight: 700; font-size: 22px; }
        .op-code { font-size: 28px; letter-spacing: 1px; color: #E8941A; font-weight: 700; }
        .op-section-title {
          font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
          color: #666; margin-bottom: 6px;
        }
        .op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
        .op-block { border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; font-size: 12px; }
        .op-block h3 { font-size: 12px; margin: 0 0 6px 0; }
        table.op-items { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        table.op-items th {
          text-align: left; padding: 8px 6px; border-bottom: 1px solid #111;
          font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
        }
        table.op-items td { padding: 8px 6px; border-bottom: 1px solid #eee; }
        table.op-items tr.op-tot td {
          font-weight: 700; border-top: 2px solid #111; border-bottom: none;
          padding-top: 10px; font-size: 13px;
        }
        table.op-items td.op-right, th.op-right { text-align: right; }
        .op-total-box {
          border: 2px solid #111; border-radius: 6px; padding: 10px 14px;
          margin-top: 20px; display: flex; justify-content: space-between; align-items: center;
        }
        .op-total-box .op-total-num { font-size: 22px; }
        .op-payments { margin-top: 20px; font-size: 11px; }
        .op-payments h3 { font-size: 12px; margin-bottom: 6px; }
        .op-payments ul { list-style: none; padding: 0; margin: 0; }
        .op-payments li { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #ddd; }
        .op-footer {
          margin-top: 32px; padding-top: 12px; border-top: 1px solid #ccc;
          text-align: center; font-size: 10px; color: #999;
        }
        .op-notes { margin-top: 12px; font-size: 11px; padding: 8px 10px; background: #f8f5ef; border-left: 3px solid #E8941A; }
        .op-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 12px auto 0; max-width: 720px; padding: 0 24px; }
        .op-actions button {
          padding: 6px 12px; border: 1px solid #ccc; background: #f5f5f5;
          border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 12px;
        }
        @media print { .op-actions { display: none; } }
      `}</style>

      <div className="op-actions">
        <button onClick={() => window.print()}>Imprimir / Guardar como PDF</button>
        <button onClick={() => window.close()}>Cerrar</button>
      </div>

      <div className="op-page">
        <div className="op-header">
          <div>
            <div className="op-display op-brand">{data.company.name}</div>
            <div style={{ fontSize: 11, color: '#666' }}>
              {[data.company.rif, data.company.phone, data.company.email].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="op-section-title">Nº Pedido</div>
            <div className="op-mono op-code">{data.code || `#${data.id.slice(-6).toUpperCase()}`}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>{formatDateTime(data.createdAt)}</div>
          </div>
        </div>

        <div className="op-grid">
          <div className="op-block">
            <div className="op-section-title">Cliente</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.client.name}</div>
            {data.client.company && <div>{data.client.company}</div>}
            {data.client.phone && <div>{data.client.phone}</div>}
            {data.client.email && <div>{data.client.email}</div>}
            {data.client.address && <div>{data.client.address}</div>}
            {data.client.city && <div>{data.client.city}</div>}
          </div>
          <div className="op-block">
            <div className="op-section-title">Estado</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{statusLabel(data.status)}</div>
            <div><span className="op-section-title" style={{ display: 'inline', marginRight: 4 }}>Total:</span> <span className="op-mono">{formatUSD(data.totalUSD)}</span></div>
            <div><span className="op-section-title" style={{ display: 'inline', marginRight: 4 }}>Pagado:</span> <span className="op-mono">{formatUSD(data.paidUSD)}</span></div>
            <div><span className="op-section-title" style={{ display: 'inline', marginRight: 4 }}>Saldo:</span> <span className="op-mono">{formatUSD(outstanding)}</span></div>
            {data.releasedAt && (
              <div style={{ marginTop: 4 }}>
                <span className="op-section-title" style={{ display: 'inline', marginRight: 4 }}>Liberado:</span> {formatDateTime(data.releasedAt)}
              </div>
            )}
          </div>
        </div>

        <div className="op-section-title">Productos</div>
        <table className="op-items">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>SKU</th>
              <th>Producto</th>
              <th className="op-right" style={{ width: '10%' }}>Cant.</th>
              <th className="op-right" style={{ width: '14%' }}>Precio</th>
              <th className="op-right" style={{ width: '16%' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i}>
                <td className="op-mono">{it.product.sku}</td>
                <td>{it.product.name}</td>
                <td className="op-right op-mono">{it.quantity}{it.product.unit ? ` ${it.product.unit}` : ''}</td>
                <td className="op-right op-mono">{formatUSD(it.priceUSD)}</td>
                <td className="op-right op-mono">{formatUSD(it.subtotalUSD)}</td>
              </tr>
            ))}
            <tr className="op-tot">
              <td colSpan={4} className="op-right">Total USD</td>
              <td className="op-right op-mono">{formatUSD(data.totalUSD)}</td>
            </tr>
          </tbody>
        </table>

        {data.notes && (
          <div className="op-notes">
            <span style={{ fontWeight: 600 }}>Notas: </span>{data.notes}
          </div>
        )}

        <div className="op-total-box">
          <div>
            <div className="op-section-title">Saldo pendiente</div>
          </div>
          <div className="op-mono op-total-num">{formatUSD(outstanding)}</div>
        </div>

        {data.payments && data.payments.length > 0 && (
          <div className="op-payments">
            <h3>Historial de pagos</h3>
            <ul>
              {data.payments.map((p, i) => (
                <li key={i}>
                  <span>
                    {formatDateTime(p.createdAt)} · {labelMethod(p.method)}
                    {p.reference ? ` · ref. ${p.reference}` : ''} — {p.status}
                  </span>
                  <span className="op-mono">{formatUSD(p.amountUSD)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="op-footer">
          Documento generado por DistribOS · {formatDateTime(new Date().toISOString())}
        </div>
      </div>
    </>
  )
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente de pago',
    partially_paid: 'Pago parcial',
    paid: 'Pagado',
    released: 'Liberado',
    cancelled: 'Cancelado',
  }
  return map[s] || s
}

function labelMethod(m: string): string {
  const map: Record<string, string> = {
    cash_usd: 'Efectivo USD',
    cash_bs: 'Efectivo Bs',
    zelle: 'Zelle',
    binance: 'Binance',
    transfer_bs: 'Transf. Bs',
    transfer_usd: 'Transf. USD',
    other: 'Otro',
  }
  return map[m] || m
}
