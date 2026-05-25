'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function PortalNavLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const pathname = usePathname()
  const active = href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
        active
          ? 'bg-accent-subtle text-accent border border-accent-border'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2 border border-transparent',
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
