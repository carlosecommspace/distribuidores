import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8">
      {icon && <div className="text-text-muted mb-4">{icon}</div>}
      <h3 className="font-display text-lg text-text-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  )
}
