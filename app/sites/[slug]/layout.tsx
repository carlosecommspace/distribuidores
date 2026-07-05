import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import './site.css'

interface Props {
  children: React.ReactNode
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await prisma.merchantSite.findUnique({
    where: { slug: params.slug },
    select: { businessName: true, tagline: true, isPublished: true },
  })
  if (!site) return { title: 'Sitio no encontrado' }
  return {
    title: site.businessName,
    description: site.tagline || undefined,
  }
}

export default async function SiteLayout({ children, params }: Props) {
  const site = await prisma.merchantSite.findUnique({ where: { slug: params.slug } })
  if (!site || !site.isPublished) notFound()

  // Inyectamos los colores del merchant como variables CSS y aplicamos la clase
  // del template. El body global del app tiene otro tema (dark) — aca lo
  // sobreescribimos para el subarbol.
  const style: React.CSSProperties = {
    // @ts-expect-error - CSS custom props
    '--ms-primary': site.colorPrimary,
    '--ms-accent': site.colorAccent,
    '--ms-neutral': site.colorNeutral,
  }

  return (
    <div className={`ms-root ms-tpl-${site.template}`} style={style}>
      {children}
    </div>
  )
}
