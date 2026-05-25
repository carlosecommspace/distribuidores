'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Store,
  MessageCircle,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventario', icon: Package },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/sales', label: 'Ventas', icon: ShoppingCart },
  { href: '/mercadolibre', label: 'MercadoLibre', icon: Store },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

export function Sidebar({ user }: { user: { name?: string | null; email: string } }) {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-[240px] bg-surface border-r border-border h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-border">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-display font-bold text-xl text-text-primary">Distrib</span>
          <span className="font-display font-bold text-xl text-accent">OS</span>
        </Link>
        <div className="text-[11px] text-text-muted mt-1 uppercase tracking-wider">Sistema operativo</div>
      </div>
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-accent-subtle text-accent border border-accent-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2 border border-transparent',
              )}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-accent text-black flex items-center justify-center font-display font-semibold text-sm">
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text-primary truncate">{user.name || user.email}</div>
            <div className="text-[11px] text-text-muted truncate">{user.email}</div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-text-muted hover:text-danger p-1" title="Cerrar sesión">
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
