import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  withWordmark?: boolean
  className?: string
  wordmarkClassName?: string
  variant?: 'dark' | 'light'
}

export function Logo({
  size = 32,
  withWordmark = false,
  className,
  wordmarkClassName,
  variant = 'dark',
}: LogoProps) {
  const bg = variant === 'dark' ? '#0F0F0F' : '#F5F3EF'
  const stroke = variant === 'dark' ? '#F5F3EF' : '#0F0F0F'
  const accent = '#F5A623'
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="DistribOS"
        style={{ flexShrink: 0, alignSelf: 'center' }}
      >
        <rect width="100" height="100" rx="18" fill={bg} />
        <polyline
          points="34,36 54,50 34,64"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="60" y="38" width="11" height="24" rx="1.5" fill={accent} />
      </svg>
      {withWordmark && (
        <span
          className={cn(
            'font-display font-bold leading-none',
            wordmarkClassName,
          )}
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          <span className="text-text-primary">Distrib</span>
          <span className="text-accent">OS</span>
        </span>
      )}
    </span>
  )
}
