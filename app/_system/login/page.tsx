'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { Lock } from 'lucide-react'

export default function SystemLoginPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // El path externo (SUPERADMIN_URL_PATH) es el primer segmento de la URL, ya
  // que el middleware reescribe /{env-path}/login -> /_system/login (el path
  // externo permanece en el browser).
  const externalBase = (() => {
    const parts = (pathname || '').split('/').filter(Boolean)
    return parts[0] ? `/${parts[0]}` : ''
  })()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      toast.error('Credenciales inválidas o cuenta suspendida')
      return
    }
    router.replace(externalBase || '/')
    router.refresh()
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-text-muted text-xs uppercase tracking-widest mb-4">
            <Lock size={12} /> System Console
          </div>
          <div className="inline-flex items-baseline gap-1.5">
            <span className="font-display font-bold text-3xl text-text-primary">Distrib</span>
            <span className="font-display font-bold text-3xl text-accent">OS</span>
          </div>
          <p className="text-sm text-text-secondary mt-2">Portal del administrador global</p>
        </div>

        <form onSubmit={onSubmit} className="bg-surface border border-border rounded-lg p-7 flex flex-col gap-4">
          <h1 className="font-display text-xl font-semibold">Superadmin</h1>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" loading={loading} className="mt-2">Entrar</Button>
        </form>

        <div className="text-center mt-6 text-xs text-text-muted">
          Acceso restringido. Todos los intentos son registrados.
        </div>
      </div>
    </div>
  )
}
