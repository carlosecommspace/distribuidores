import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SystemHeader } from '@/components/system/SystemHeader'
import { MerchantsDashboard } from '@/components/system/MerchantsDashboard'

/**
 * Home del portal del superadmin. Server component: verifica auth, y si pasa
 * renderiza el header (client) + el dashboard client.
 * Reachable via el path externo SUPERADMIN_URL_PATH (middleware reescribe).
 */
export default async function SystemHome() {
  const path = process.env.SUPERADMIN_URL_PATH
  if (!path) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-secondary">
        <div className="text-center max-w-md p-8">
          <div className="text-lg font-display mb-2">Portal del sistema apagado</div>
          <div className="text-sm">
            Configura <code className="font-mono text-accent">SUPERADMIN_URL_PATH</code> en el entorno.
          </div>
        </div>
      </div>
    )
  }

  const session = await auth()
  const su = session?.user as { email?: string; role?: string } | undefined
  if (!su || su.role !== 'superadmin') {
    redirect(`/${path}/login`)
  }

  return (
    <>
      <SystemHeader basePath={`/${path}`} email={su.email || ''} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <MerchantsDashboard basePath={`/${path}`} />
      </main>
    </>
  )
}
