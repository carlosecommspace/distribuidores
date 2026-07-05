'use client'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  size?: number
  className?: string
  callbackUrl?: string
  title?: string
}

export function SignOutButton({ size = 14, className, callbackUrl = '/login', title = 'Cerrar sesión' }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={cn('text-text-muted hover:text-danger p-1 transition-colors', className)}
      title={title}
      aria-label={title}
    >
      <LogOut size={size} />
    </button>
  )
}
