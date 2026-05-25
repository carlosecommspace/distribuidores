'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      toast.error('Email o contraseña incorrectos')
      return
    }
    router.replace('/')
    router.refresh()
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
