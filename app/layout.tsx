import './globals.css'
import type { Metadata } from 'next'
import { SessionProvider } from '@/components/SessionProvider'

export const metadata: Metadata = {
  title: 'DistribOS — Sistema operativo para distribuidoras',
  description: 'Gestión de inventario, ventas, MercadoLibre y WhatsApp para distribuidoras venezolanas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
