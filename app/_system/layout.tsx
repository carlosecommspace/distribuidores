import { ToastViewport } from '@/components/ui/Toast'

/**
 * Layout raiz del portal del superadmin. Sin auth guard aca — el guard esta
 * en app/_system/(authed)/layout.tsx que envuelve el dashboard y todas las
 * paginas post-login. app/_system/login/ vive fuera del guard.
 */
export default function SystemRootLayout({ children }: { children: React.ReactNode }) {
  // Si el path oculto no esta configurado, este layout tampoco deberia
  // renderizarse porque el middleware no reescribe. Pero por si acaso:
  if (!process.env.SUPERADMIN_URL_PATH) {
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
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {children}
      <ToastViewport />
    </div>
  )
}
