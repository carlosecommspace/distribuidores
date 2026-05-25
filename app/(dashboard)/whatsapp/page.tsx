import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CopyLinkButton } from '@/components/whatsapp/CopyLink'
import { QuickReplyManager } from '@/components/whatsapp/QuickReplyManager'
import { Phone, Link as LinkIcon, MessageCircle } from 'lucide-react'

export default async function WhatsappPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const userId = (session.user as { id: string }).id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const settings = await prisma.settings.findUnique({ where: { userId } })
  const replies = await prisma.quickReply.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })

  // Si el usuario no tiene slug, generar uno simple basado en id
  const slug = user?.slug || user?.id.slice(0, 8) || 'usuario'
  const catalogUrl = `/catalogo/${slug}`

  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="Gestiona tu catálogo y respuestas rápidas" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone size={16} /> Configuración</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-text-secondary mb-1">Número de negocio</div>
              <div className="text-sm font-mono">{settings?.waPhoneNumber || 'No configurado'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-text-secondary mb-1">Estado de conexión</div>
              <Badge tone="warning">Próximamente: WhatsApp Business API</Badge>
              <p className="text-xs text-text-muted mt-2">
                Mientras tanto puedes compartir tu catálogo público y usar respuestas rápidas.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LinkIcon size={16} /> Catálogo público</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Comparte este link con tus clientes por WhatsApp. Verán todos tus productos con precios en USD.
            </p>
            <div className="bg-surface-2 border border-border rounded-md p-3 font-mono text-sm flex items-center justify-between gap-3">
              <span className="truncate text-accent">distribos.app{catalogUrl}</span>
            </div>
            <CopyLinkButton url={catalogUrl} />
            <a
              href={catalogUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-text-secondary hover:text-accent"
            >
              Ver vista previa del catálogo →
            </a>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageCircle size={16} /> Respuestas rápidas</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-secondary mb-4">
            Define plantillas para responder rápidamente preguntas frecuentes de tus clientes.
          </p>
          <QuickReplyManager initial={replies.map((r) => ({ id: r.id, trigger: r.trigger, reply: r.reply }))} />
        </CardBody>
      </Card>
    </div>
  )
}
