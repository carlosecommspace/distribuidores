import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-6 md:mb-8">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-text-primary break-words">{title}</h1>
        {subtitle && <div className="text-sm text-text-secondary mt-1">{subtitle}</div>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}
