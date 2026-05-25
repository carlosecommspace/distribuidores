'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { RefreshCw, Store } from 'lucide-react'

export function MLConnectButton() {
  return (
    <a href="/api/ml/auth">
      <Button><Store size={16} /> Conectar con MercadoLibre</Button>
    </a>
  )
}

export function SyncNowButton() {
  const [loading, setLoading] = useState(false)
  const sync = async () => {
    setLoading(true)
    const r = await fetch('/api/ml/sync', { method: 'POST' })
    setLoading(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(e.error || 'Error sincronizando')
      return
    }
    const d = await r.json()
    toast.success(`Sincronizados ${d.synced}/${d.total} productos`)
  }
  return (
    <Button loading={loading} onClick={sync}>
      <RefreshCw size={14} /> Sincronizar ahora
    </Button>
  )
}

export function RefreshQuestionsButton({ onDone }: { onDone?: () => void }) {
  const [loading, setLoading] = useState(false)
  const refresh = async () => {
    setLoading(true)
    const r = await fetch('/api/ml/questions', { method: 'POST' })
    setLoading(false)
    if (!r.ok) {
      toast.error('No se pudieron actualizar las preguntas')
      return
    }
    const d = await r.json()
    toast.success(`${d.added} preguntas nuevas`)
    onDone?.()
  }
  return (
    <Button variant="secondary" loading={loading} onClick={refresh}>
      <RefreshCw size={14} /> Actualizar
    </Button>
  )
}
