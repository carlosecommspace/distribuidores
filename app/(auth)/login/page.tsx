'use client'
import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setLoading(false)
      toast.error('Credenciales inválidas o cuenta suspendida')
      return
    }
    // Rutear por rol. Usamos getSession para leer el rol del JWT recien emitido
    // y despues hard-navigation al destino, mas confiable que router.replace
    // cuando cambia el rol (evita conflictos con caches del RSC).
    try {
      const session = await getSession()
      const role = (session?.user as { role?: string })?.role
      const dest = role === 'client' ? '/portal' : role === 'seller' ? '/seller' : role === 'superadmin' ? '/' : '/'
      window.location.href = dest
    } catch {
      window.location.href = '/'
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-baseline gap-1.5">
          <span className="font-display font-bold text-3xl text-text-primary">Distrib</span>
          <span className="font-display font-bold text-3xl text-accent">OS</span>
        </div>
        <p className="text-sm text-text-secondary mt-2">Sistema operativo para distribuidoras</p>
      </div>

      <form onSubmit={onSubmit} className="bg-surface border border-border rounded-lg p-7 flex flex-col gap-4">
        <h1 className="font-display text-xl font-semibold">Inicia sesión</h1>
        <Input
          label="Email"
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@empresa.com"
        />
        <Input
          label="Contraseña"
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <Button type="submit" loading={loading} className="mt-2">
          Entrar
        </Button>
        <div className="text-xs text-text-muted text-center mt-1">
          Demo: <span className="font-mono">demo@distribos.app</span> / <span className="font-mono">demo1234</span>
        </div>
      </form>
    </div>
  )
}
