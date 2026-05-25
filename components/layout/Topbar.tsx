'use client'
import { Bell, Calendar } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Topbar({ initialRate }: { initialRate: number }) {
  const [rate, setRate] = useState(initialRate)
  const today = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/bcv').then((r) => r.json())
        if (r?.rate) setRate(r.rate)
      } catch {}
    }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="h-14 border-b border-border bg-surface/40 backdrop-blur sticky top-0 z-30 flex items-center px-8 gap-6">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Calendar size={14} />
        <span className="capitalize">{today}</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-subtle border border-accent-border rounded-md">
          <span className="text-[11px] uppercase tracking-wider text-accent font-medium">BCV</span>
          <span className="font-mono text-sm text-text-primary">
            Bs {rate.toFixed(2)} <span className="text-text-muted text-xs">/ USD</span>
          </span>
        </div>
        <button className="text-text-secondary hover:text-text-primary p-1.5 rounded-md hover:bg-surface-2">
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
