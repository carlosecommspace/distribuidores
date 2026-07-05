'use client'
import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { ToastViewport } from '@/components/ui/Toast'
import { Lock } from 'lucide-react'

export default function SuperadminLoginPage() {
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
    try {
      const session = await getSession()
      const role = (session?.user as { role?: string })?.role
      if (role === 'superadmin') {
        window.location.href = '/superadmin'
      } else {
        // Login OK pero no es superadmin — mandarlo a su portal correspondiente
        const dest = role === 'seller' ? '/seller' : role === 'client' ? '/portal' : '/'
        window.location.href = dest
      }
    } catch {
      window.location.href = '/superadmin'
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
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
            Acceso restringido
          </div>
        </div>
      </div>
      <ToastViewport />
    </div>
  )
}
