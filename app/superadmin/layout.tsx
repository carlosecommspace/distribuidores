import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { ToastViewport } from '@/components/ui/Toast'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Logo } from '@/components/brand/Logo'

/**
 * Layout del portal del superadmin. Requiere role=superadmin en todas las
 * rutas bajo /superadmin/*. Si no cumple, redirige al login del superadmin.
 */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const su = session?.user as { id?: string; email?: string; role?: string } | undefined
  if (!su || su.role !== 'superadmin') {
    redirect('/superadminloginpage')
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/superadmin" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-display font-bold text-lg leading-none">
              <span className="text-text-primary">Distrib</span>
              <span className="text-accent">OS</span>
            </span>
            <span className="font-mono text-[10px] text-text-muted ml-2 uppercase tracking-widest">System Console</span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            <Link
              href="/superadmin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2"
            >
              <LayoutDashboard size={14} /> Merchants
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-text-muted uppercase tracking-widest">Superadmin</div>
              <div className="text-sm text-text-primary truncate max-w-[220px]">{su.email}</div>
            </div>
            <SignOutButton size={16} className="p-1.5 rounded-md hover:bg-surface-2" callbackUrl="/superadminloginpage" />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">{children}</main>
      <ToastViewport />
    </div>
  )
}
