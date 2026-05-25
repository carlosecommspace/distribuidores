import { ToastViewport } from '@/components/ui/Toast'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      {children}
      <ToastViewport />
    </div>
  )
}
