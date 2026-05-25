import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  hint?: ReactNode
  delta?: { value: number; positive?: boolean }
  icon?: ReactNode
  accent?: boolean
  className?: string
}

export function Stat({ label, value, hint, delta, icon, accent, className }: Props) {
  return (
    <div className={cn('bg-surface border border-border rounded-lg p-5', accent && 'border-accent-border bg-accent-subtle', className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-text-secondary font-medium">{label}</span>
        {icon && <span className={cn('text-text-muted', accent && 'text-accent')}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-3">
        <span className={cn('font-mono text-2xl font-medium', accent ? 'text-accent' : 'text-text-primary')}>{value}</span>
        {delta && (
          <span
            className={cn(
              'text-xs font-mono px-1.5 py-0.5 rounded',
              delta.positive ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle',
            )}
          >
            {delta.positive ? '+' : ''}
            {delta.value}%
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-text-muted">{hint}</div>}
    </div>
  )
}
