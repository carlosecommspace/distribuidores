'use client'
import { Bell, Calendar, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  initialRate: number
  initialCurrency?: 'USD' | 'EUR'
  onMenuClick?: () => void
}

export function Topbar({ initialRate, initialCurrency = 'USD', onMenuClick }: Props) {
  const [rate, setRate] = useState(initialRate)
  const [currency] = useState<'USD' | 'EUR'>(initialCurrency)
  const today = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const todayShort = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
  })

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/bcv?currency=${currency}`).then((r) => r.json())
        if (r?.rate) setRate(r.rate)
      } catch {}
    }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [currency])

  return (
    <header className="h-14 border-b border-border bg-surface/40 backdrop-blur sticky top-0 z-30 flex items-center px-4 md:px-8 gap-3 md:gap-6">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden text-text-secondary hover:text-text-primary p-1.5 -ml-1.5 rounded-md hover:bg-surface-2"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
      )}
      <div className="flex items-center gap-2 text-sm text-text-secondary min-w-0">
        <Calendar size={14} className="shrink-0" />
        <span className="capitalize hidden sm:inline">{today}</span>
        <span className="capitalize sm:hidden">{todayShort}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 bg-accent-subtle border border-accent-border rounded-md">
          <span className="text-[11px] uppercase tracking-wider text-accent font-medium">BCV</span>
          <span className="font-mono text-xs md:text-sm text-text-primary whitespace-nowrap">
            Bs {rate.toFixed(2)}
            <span className="text-text-muted text-xs hidden sm:inline"> / {currency}</span>
          </span>
        </div>
        <button className="text-text-secondary hover:text-text-primary p-1.5 rounded-md hover:bg-surface-2 hidden sm:inline-flex">
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
