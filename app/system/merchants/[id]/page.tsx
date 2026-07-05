import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SystemHeader } from '@/components/system/SystemHeader'
import { MerchantDetail } from '@/components/system/MerchantDetail'

export default async function SystemMerchantDetailPage({ params }: { params: { id: string } }) {
  const path = process.env.SUPERADMIN_URL_PATH
  if (!path) redirect('/')

  const session = await auth()
  const su = session?.user as { email?: string; role?: string } | undefined
  if (!su || su.role !== 'superadmin') {
    redirect(`/${path}/login`)
  }

  return (
    <>
      <SystemHeader basePath={`/${path}`} email={su.email || ''} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <MerchantDetail merchantId={params.id} basePath={`/${path}`} />
      </main>
    </>
  )
}
