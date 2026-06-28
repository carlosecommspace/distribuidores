import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ToastViewport } from '@/components/ui/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.settings.findUnique({ where: { userId } }),
  ])

  if (!user) redirect('/login')

  const primaryCurrency = (settings?.primaryCurrency === 'EUR' ? 'EUR' : 'USD') as 'USD' | 'EUR'
  const initialRate = primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0

  return (
    <>
      <DashboardShell user={user} initialRate={initialRate} initialCurrency={primaryCurrency}>
        {children}
      </DashboardShell>
      <ToastViewport />
    </>
  )
}
