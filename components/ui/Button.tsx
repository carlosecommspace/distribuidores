'use client'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-black hover:bg-accent-hover shadow-accent',
  secondary: 'bg-surface-2 border border-border text-text-primary hover:bg-surface-3',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
  danger: 'bg-danger-subtle border border-danger/40 text-danger hover:bg-danger/20',
  outline: 'border border-border-light text-text-primary hover:bg-surface-2',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
