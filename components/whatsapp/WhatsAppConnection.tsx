'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { Smartphone, RefreshCw, LogOut, Inbox, AlertCircle } from 'lucide-react'
import { formatRelative } from '@/lib/utils'

interface SessionState {
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected' | 'banned'
  phoneNumber: string | null
  displayName: string | null
  qrCode: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  lastError: string | null
}

export function WhatsAppConnection() {
  const [data, setData] = useState<SessionState | null>(null)
  const [workerConfigured, setWorkerConfigured] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const load = async () => {
    const r = await fetch('/api/whatsapp/session')
    if (!r.ok) return
    const d = await r.json()
    setData(d.session)
    setWorkerConfigured(!!d.workerConfigured)
  }

  useEffect(() => {
    load()
    // Poll while awaiting QR or connecting
    const t = setInterval(() => {
      if (data?.status === 'qr_pending' || data?.status === 'connecting') load()
      else load() // heartbeat cada 10s
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status])

  const connect = async () => {
    setConnecting(true)
    const r = await fetch('/api/whatsapp/session', { method: 'POST' })
    setConnecting(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error iniciando conexión')
      return
    }
    toast.info('Escanea el QR en unos segundos...')
    load()
  }

  const disconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Perderás la sesión actual.')) return
    setDisconnecting(true)
    const r = await fetch('/api/whatsapp/session', { method: 'DELETE' })
    setDisconnecting(false)
    if (!r.ok) {
      toast.error('Error desconectando')
      return
    }
    toast.success('Desconectado')
    load()
  }

  if (!data) return (
    <Card>
      <CardBody><div className="h-32 animate-pulse bg-surface-2 rounded-md" /></CardBody>
    </Card>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone size={16} /> Conexión WhatsApp</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {!workerConfigured ? (
          <div className="flex items-start gap-2 bg-warning-subtle border border-warning/30 rounded-md p-3">
            <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-warning font-medium">Worker no configurado</div>
              <div className="text-xs text-text-secondary mt-1">
                Setea <code className="font-mono">WA_WORKER_URL</code> en el servidor para habilitar esta feature.
                Ver README para instrucciones de deploy.
              </div>
            </div>
          </div>
        ) : data.status === 'connected' ? (
          <>
            <div className="flex items-center gap-3">
              <Badge tone="success" dot>Conectado</Badge>
              {data.phoneNumber && (
                <span className="font-mono text-sm text-text-primary">+{data.phoneNumber}</span>
              )}
            </div>
            {data.displayName && <div className="text-xs text-text-muted">{data.displayName}</div>}
            {data.connectedAt && (
              <div className="text-xs text-text-muted">
                Conectado {formatRelative(data.connectedAt)}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Link href="/whatsapp/inbox">
                <Button><Inbox size={14} /> Abrir bandeja de entrada</Button>
              </Link>
              <Button variant="ghost" loading={disconnecting} onClick={disconnect}>
                <LogOut size={14} /> Desconectar
              </Button>
            </div>
          </>
        ) : data.status === 'qr_pending' && data.qrCode ? (
          <>
            <Badge tone="warning" dot>Esperando escaneo</Badge>
            <div className="flex flex-col items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrCode} alt="QR de WhatsApp" className="w-56 h-56 rounded-md bg-white p-2" />
              <p className="text-xs text-text-secondary text-center max-w-xs">
                Abre WhatsApp en tu teléfono → Configuración → <strong>Dispositivos vinculados</strong> → Vincular dispositivo → Escanea este código.
              </p>
              <button onClick={load} className="text-xs text-accent inline-flex items-center gap-1">
                <RefreshCw size={12} /> Refrescar
              </button>
            </div>
          </>
        ) : data.status === 'connecting' ? (
          <>
            <Badge tone="info" dot>Conectando…</Badge>
            <p className="text-xs text-text-muted">
              Generando código QR. Espera unos segundos y verás la imagen aparecer aquí.
            </p>
          </>
        ) : (
          <>
            <Badge>Desconectado</Badge>
            <p className="text-sm text-text-secondary">
              Conecta tu WhatsApp escaneando un QR (igual que WhatsApp Web) para atender los chats desde el panel.
              Tu WhatsApp del móvil sigue funcionando en paralelo.
            </p>
            {data.lastError && (
              <div className="text-xs text-danger">Último error: {data.lastError}</div>
            )}
            <Button loading={connecting} onClick={connect}>
              <Smartphone size={14} /> Conectar mi WhatsApp
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}
