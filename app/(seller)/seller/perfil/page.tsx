'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'

interface Profile {
  seller: {
    name: string
    phone: string | null
    isActive: boolean
  } | null
  email: string | null
  clientsCount: number
}

export default function ProfilePage() {
  const [data, setData] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/seller/profile').then((r) => r.json()).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  const changePassword = async () => {
    if (pw1.length < 8) { toast.error('La nueva contraseña debe tener al menos 8 caracteres'); return }
    if (pw1 !== pw2) { toast.error('Las contraseñas no coinciden'); return }
    if (!current) { toast.error('Ingresa tu contraseña actual'); return }
    setSaving(true)
    const r = await fetch('/api/seller/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: pw1 }),
    })
    setSaving(false)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(typeof d.error === 'string' ? d.error : 'Error cambiando contraseña')
      return
    }
    toast.success('Contraseña actualizada')
    setCurrent(''); setPw1(''); setPw2('')
  }

  return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Datos de la cuenta y cambio de contraseña" />

      {loading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Nombre</label>
                <div className="text-sm text-text-primary mt-1">{data.seller?.name}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Email</label>
                <div className="text-sm text-text-primary font-mono mt-1">{data.email}</div>
              </div>
              {data.seller?.phone && (
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Teléfono</label>
                  <div className="text-sm text-text-primary mt-1">{data.seller.phone}</div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Clientes asignados</label>
                <div className="text-sm text-text-primary mt-1">{data.clientsCount}</div>
              </div>
              <div className="text-xs text-text-muted mt-2">
                Para cambiar tu nombre, email o teléfono, contacta al administrador.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cambiar contraseña</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Input
                label="Contraseña actual"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                label="Nueva contraseña"
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                hint="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <Input
                label="Confirmar nueva contraseña"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
              />
              <Button loading={saving} onClick={changePassword}>Actualizar contraseña</Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
