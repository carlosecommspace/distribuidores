import { ToastViewport } from '@/components/ui/Toast'

/**
 * Layout raiz del portal del superadmin. Solo wrapper visual — la auth se
 * verifica en cada page.tsx (server component) para evitar conflictos con el
 * rewrite del middleware desde el path externo.
 */
export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {children}
      <ToastViewport />
    </div>
  )
}
