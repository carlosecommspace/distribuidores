'use client'
import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { BadgeCheck } from 'lucide-react'

export default function VendedorLoginPage() {
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
      const dest = role === 'seller' ? '/seller' : role === 'client' ? '/portal' : '/'
      window.location.href = dest
    } catch {
      window.location.href = '/seller'
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent mb-3">
          <BadgeCheck size={14} /> Portal del vendedor
        </div>
        <div className="inline-flex items-baseline gap-1.5">
          <span className="font-display font-bold text-3xl text-text-primary">Distrib</span>
          <span className="font-display font-bold text-3xl text-accent">OS</span>
        </div>
        <p className="text-sm text-text-secondary mt-2">Ingresa con las credenciales que te dio tu administrador</p>
      </div>

      <form onSubmit={onSubmit} className="bg-surface border border-border rounded-lg p-7 flex flex-col gap-4">
        <h1 className="font-display text-xl font-semibold">Bienvenido</h1>
        <Input
          label="Email"
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
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
          ¿No tienes cuenta? Pídesela a tu administrador.
        </div>
      </form>
    </div>
  )
}
