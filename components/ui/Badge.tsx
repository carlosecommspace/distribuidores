import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-secondary border-border',
  accent: 'bg-accent-subtle text-accent border-accent-border',
  success: 'bg-success-subtle text-success border-success/30',
  warning: 'bg-warning-subtle text-warning border-warning/30',
  danger: 'bg-danger-subtle text-danger border-danger/30',
  info: 'bg-info-subtle text-info border-info/30',
}

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  dot?: boolean
}

export function Badge({ tone = 'neutral', dot, className, children, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', `bg-current`)} />}
      {children}
    </span>
  )
}
