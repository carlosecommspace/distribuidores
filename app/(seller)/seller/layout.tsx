import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Home, Users, Inbox, User } from 'lucide-react'
import { ToastViewport } from '@/components/ui/Toast'
import { PortalNavLink } from '@/components/portal/PortalNavLink'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const su = session.user as { id?: string; role?: string; sellerId?: string }
  if (su.role !== 'seller' || !su.sellerId) redirect('/')

  const seller = await prisma.seller.findUnique({
    where: { id: su.sellerId },
    select: { id: true, name: true, isActive: true, owner: { select: { name: true, company: true } } },
  })
  if (!seller) redirect('/login')

  // Doble check: si el admin lo suspendio despues del login, deslogueamos
  if (!seller.isActive) redirect('/login?suspended=1')

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/seller" className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-lg text-text-primary">Distrib</span>
            <span className="font-display font-bold text-lg text-accent">OS</span>
          </Link>
          <nav className="flex items-center gap-1 ml-2 sm:ml-6 overflow-x-auto">
            <PortalNavLink href="/seller" icon={<Home size={14} />} label="Inicio" />
            <PortalNavLink href="/seller/clientes" icon={<Users size={14} />} label="Mis clientes" />
            <PortalNavLink href="/seller/pedidos" icon={<Inbox size={14} />} label="Mis pedidos" />
            <PortalNavLink href="/seller/perfil" icon={<User size={14} />} label="Mi perfil" />
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs text-text-muted">Vendedor</div>
              <div className="text-sm text-text-primary truncate max-w-[180px]">{seller.name}</div>
            </div>
            <SignOutButton size={16} className="p-1.5 rounded-md hover:bg-surface-2" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">{children}</main>
      <ToastViewport />
    </div>
  )
}
