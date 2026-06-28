'use client'
import { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'

interface Profile {
  user: { id: string; email: string; name?: string | null }
  client: { name: string; company?: string | null }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const load = async () => {
    const r = await fetch('/api/portal/profile')
    if (r.ok) {
      const d = await r.json()
      setProfile(d)
      setName(d.user?.name || '')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveName = async () => {
    setSavingName(true)
    const r = await fetch('/api/portal/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSavingName(false)
    if (!r.ok) {
      toast.error('Error guardando')
      return
    }
    toast.success('Nombre actualizado')
  }

  const changePassword = async () => {
    if (next.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (next !== confirm) {
      toast.error('La confirmación no coincide')
      return
    }
    setSavingPw(true)
    const r = await fetch('/api/portal/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    setSavingPw(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(typeof e.error === 'string' ? e.error : 'Error cambiando contraseña')
      return
    }
    toast.success('Contraseña actualizada')
    setCurrent(''); setNext(''); setConfirm('')
  }

  if (loading) return <Skeleton className="h-64" />
  if (!profile) return <div className="text-text-muted">Sin perfil</div>

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary mb-1">Mi perfil</h1>
      <p className="text-sm text-text-secondary mb-6">Datos de tu acceso al portal.</p>

      <Card className="mb-6">
        <CardHeader><CardTitle>Cuenta</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Input label="Empresa" value={profile.client.company || profile.client.name} disabled />
          <Input label="Email de acceso" value={profile.user.email} disabled hint="Para cambiar el email, contacta al distribuidor" />
          <div className="flex items-end gap-2">
            <Input label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <Button loading={savingName} onClick={saveName}>Guardar</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cambiar contraseña</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-4">
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
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            hint="Mínimo 6 caracteres"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex justify-end">
            <Button loading={savingPw} onClick={changePassword} disabled={!current || !next}>
              Cambiar contraseña
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
