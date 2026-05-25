import { Badge } from '@/components/ui/Badge'

export function StockBadge({ stock, stockMin }: { stock: number; stockMin: number }) {
  if (stock <= 0) return <Badge tone="danger" dot>Agotado</Badge>
  if (stock <= stockMin) return <Badge tone="warning" dot>Bajo</Badge>
  return <Badge tone="success" dot>OK</Badge>
}

export function MLStatusBadge({ mlItemId, mlStatus }: { mlItemId?: string | null; mlStatus?: string | null }) {
  if (!mlItemId) return <Badge tone="neutral">No publicado</Badge>
  if (mlStatus === 'paused') return <Badge tone="warning">Pausado</Badge>
  if (mlStatus === 'closed') return <Badge tone="neutral">Cerrado</Badge>
  return <Badge tone="success">Publicado</Badge>
}
