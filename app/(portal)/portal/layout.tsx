import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { LogOut, ShoppingBag, Home, History } from 'lucide-react'
import { ToastViewport } from '@/components/ui/Toast'
import { PortalNavLink } from '@/components/portal/PortalNavLink'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const su = session.user as { id?: string; role?: string; clientId?: string }
  if (su.role !== 'client' || !su.clientId) redirect('/')

  const client = await prisma.client.findUnique({
    where: { id: su.clientId },
    select: { id: true, name: true, company: true, priceList: { select: { name: true } } },
  })
  if (!client) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/portal" className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-lg text-text-primary">Distrib</span>
            <span className="font-display font-bold text-lg text-accent">OS</span>
          </Link>
          <nav className="flex items-center gap-1 ml-2 sm:ml-6 overflow-x-auto">
            <PortalNavLink href="/portal" icon={<Home size={14} />} label="Inicio" />
            <PortalNavLink href="/portal/catalog" icon={<ShoppingBag size={14} />} label="Catálogo" />
            <PortalNavLink href="/portal/requests" icon={<History size={14} />} label="Mis pedidos" />
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm text-text-primary truncate max-w-[180px]">{client.company || client.name}</div>
              {client.priceList && (
                <div className="text-[11px] text-text-muted">Lista: {client.priceList.name}</div>
              )}
            </div>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-text-muted hover:text-danger p-1.5 rounded-md hover:bg-surface-2" title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">{children}</main>
      <ToastViewport />
    </div>
  )
}
