'use client'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Copy, MessageCircle } from 'lucide-react'

export function CopyLinkButton({ url }: { url: string }) {
  const full = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full)
      toast.success('Link copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }
  const share = () => {
    const text = encodeURIComponent(`Mira nuestro catálogo: ${full}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={copy}><Copy size={14} /> Copiar link</Button>
      <Button onClick={share}><MessageCircle size={14} /> Compartir por WhatsApp</Button>
    </div>
  )
}
