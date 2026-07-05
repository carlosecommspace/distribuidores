import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Home, Users, Inbox, User, AlertCircle } from 'lucide-react'
import { ToastViewport } from '@/components/ui/Toast'
import { PortalNavLink } from '@/components/portal/PortalNavLink'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const su = session.user as { id?: string; role?: string; sellerId?: string }

  // Rol distinto de seller: fuera del portal. Middleware ya redirige, pero
  // por si acaso lo empujamos al home del admin (o /login si no tiene id).
  if (su.role !== 'seller' || !su.id) redirect('/')

  // Resolver el perfil de vendedor. Preferimos sellerId de la sesion, pero
  // caemos al lookup por userId si el JWT viejo/incompleto no lo trae
  // (evita loop de redireccion si la sesion se emitio antes del feature).
  const seller = su.sellerId
    ? await prisma.seller.findUnique({
        where: { id: su.sellerId },
        select: { id: true, name: true, isActive: true, owner: { select: { name: true, company: true } } },
      })
    : await prisma.seller.findFirst({
        where: { userId: su.id },
        select: { id: true, name: true, isActive: true, owner: { select: { name: true, company: true } } },
      })

  // Edge case: role=seller sin sellerProfile en DB. Renderizamos una pagina de
  // error con boton de logout — NO redirect, para no entrar en loop con el
  // middleware que empuja a los seller a /seller.
  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-danger-subtle text-danger mb-4">
            <AlertCircle size={22} />
          </div>
          <h1 className="text-xl font-display font-semibold mb-2">Perfil de vendedor no encontrado</h1>
          <p className="text-sm text-text-secondary mb-6">
            Tu cuenta tiene rol de vendedor pero no encontramos su perfil. Contacta a tu administrador o inicia sesión de nuevo.
          </p>
          <SignOutButton size={14} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-2 text-sm text-text-primary" />
        </div>
        <ToastViewport />
      </div>
    )
  }

  // Suspendido: pagina bloqueo con logout (NO redirect a /login por loop).
  if (!seller.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-warning-subtle text-warning mb-4">
            <AlertCircle size={22} />
          </div>
          <h1 className="text-xl font-display font-semibold mb-2">Tu cuenta está suspendida</h1>
          <p className="text-sm text-text-secondary mb-6">
            Tu administrador ha suspendido temporalmente el acceso al portal. Contactalo para reactivarla.
          </p>
          <SignOutButton size={14} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-2 text-sm text-text-primary" />
        </div>
        <ToastViewport />
      </div>
    )
  }

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
