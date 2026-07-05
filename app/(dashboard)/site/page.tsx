'use client'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { Globe, Sparkles, Upload, X, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

type Template = 'modern' | 'warm' | 'minimal'

interface Site {
  slug: string
  isPublished: boolean
  template: Template
  colorPrimary: string
  colorAccent: string
  colorNeutral: string
  businessName: string
  tagline: string
  mission: string
  vision: string
  description: string
  contactEmail: string
  contactPhone: string
  contactAddress: string
  logoFileId: string | null
  imageFileIds: string[]
}

const DEFAULT_SITE: Site = {
  slug: '',
  isPublished: false,
  template: 'modern',
  colorPrimary: '#F5A623',
  colorAccent: '#0F0F0F',
  colorNeutral: '#F4F1EA',
  businessName: '',
  tagline: '',
  mission: '',
  vision: '',
  description: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  logoFileId: null,
  imageFileIds: [],
}

export default function SitePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHint, setAiHint] = useState('')
  const [site, setSite] = useState<Site>(DEFAULT_SITE)
  const [rootDomain, setRootDomain] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/site').then((r) => r.json()).then((d) => {
      if (d.site) {
        setSite({
          slug: d.site.slug || '',
          isPublished: !!d.site.isPublished,
          template: (d.site.template as Template) || 'modern',
          colorPrimary: d.site.colorPrimary || '#F5A623',
          colorAccent: d.site.colorAccent || '#0F0F0F',
          colorNeutral: d.site.colorNeutral || '#F4F1EA',
          businessName: d.site.businessName || '',
          tagline: d.site.tagline || '',
          mission: d.site.mission || '',
          vision: d.site.vision || '',
          description: d.site.description || '',
          contactEmail: d.site.contactEmail || '',
          contactPhone: d.site.contactPhone || '',
          contactAddress: d.site.contactAddress || '',
          logoFileId: d.site.logoFileId || null,
          imageFileIds: d.site.imageFileIds || [],
        })
      }
      setRootDomain(d.rootDomain || null)
      setLoading(false)
    })
  }, [])

  const setField = <K extends keyof Site>(k: K, v: Site[K]) => setSite((s) => ({ ...s, [k]: v }))

  const save = async () => {
    if (!site.businessName.trim()) {
      toast.error('Falta el nombre del negocio')
      return
    }
    if (!site.slug.trim()) {
      toast.error('Falta el subdominio')
      return
    }
    setSaving(true)
    const r = await fetch('/api/site', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(site),
    })
    setSaving(false)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = typeof data.error === 'string' ? data.error : 'No se pudo guardar'
      toast.error(err)
      return
    }
    toast.success('Sitio guardado')
  }

  const generateAI = async () => {
    if (!site.businessName.trim()) {
      toast.error('Escribe primero el nombre del negocio')
      return
    }
    setAiLoading(true)
    const r = await fetch('/api/site/ai-generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ businessName: site.businessName, hint: aiHint }),
    })
    setAiLoading(false)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(typeof d.error === 'string' ? d.error : 'La IA no respondió')
      return
    }
    setSite((s) => ({
      ...s,
      mission: d.mission || s.mission,
      vision: d.vision || s.vision,
      description: d.description || s.description,
    }))
    toast.success('Contenido generado — puedes editarlo antes de guardar')
  }

  const upload = async (file: File, purpose: 'site_logo' | 'site_image'): Promise<string | null> => {
    const form = new FormData()
    form.set('file', file)
    form.set('purpose', purpose)
    const r = await fetch('/api/uploads', { method: 'POST', body: form })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(typeof d.error === 'string' ? d.error : 'Error subiendo archivo')
      return null
    }
    return d.id as string
  }

  const onLogo = async (file: File) => {
    const id = await upload(file, 'site_logo')
    if (id) setField('logoFileId', id)
  }

  const onAddImage = async (file: File) => {
    if (site.imageFileIds.length >= 7) {
      toast.error('Máximo 7 imágenes')
      return
    }
    const id = await upload(file, 'site_image')
    if (id) setField('imageFileIds', [...site.imageFileIds, id])
  }

  const removeImage = (idx: number) => {
    setField('imageFileIds', site.imageFileIds.filter((_, i) => i !== idx))
  }

  const publicUrl = useMemo(() => {
    if (!site.slug) return ''
    if (rootDomain) return `https://${site.slug}.${rootDomain}`
    return `/sites/${site.slug}`
  }, [site.slug, rootDomain])

  if (loading) {
    return (
      <div>
        <PageHeader title="Sitio web" subtitle="Cargando…" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const hasEnoughImages = site.imageFileIds.length >= 4

  return (
    <div>
      <PageHeader
        title="Sitio web"
        subtitle="Publica una página con subdominio propio que muestre tu catálogo y capture leads."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {site.slug && site.isPublished && (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                <ExternalLink size={14} /> Ver sitio
              </a>
            )}
            <Button loading={saving} onClick={save}>Guardar cambios</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna 1-2: contenido */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Publicación */}
          <Card>
            <CardHeader>
              <CardTitle><Globe size={16} className="inline mr-1.5 -mt-0.5" /> Publicación</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Subdominio</label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      value={site.slug}
                      onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="minegocio"
                      maxLength={32}
                      className="input-base font-mono flex-1"
                    />
                    <span className="text-sm text-text-muted whitespace-nowrap">.{rootDomain || 'distribos.com'}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">Letras minúsculas, números y guiones. 3–32 caracteres.</div>
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Publicar</label>
                  <Switch checked={site.isPublished} onCheckedChange={(v) => setField('isPublished', v)} label={site.isPublished ? 'Sitio en vivo' : 'Borrador'} />
                  <span className="text-xs text-text-muted">Solo se ve al público cuando está publicado.</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Identidad */}
          <Card>
            <CardHeader><CardTitle>Identidad</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Input
                label="Nombre del negocio"
                value={site.businessName}
                onChange={(e) => setField('businessName', e.target.value)}
                maxLength={120}
              />
              <Input
                label="Tagline (opcional)"
                value={site.tagline}
                onChange={(e) => setField('tagline', e.target.value)}
                placeholder="Una frase que describa tu negocio en pocas palabras"
                maxLength={200}
              />
            </CardBody>
          </Card>

          {/* Textos con IA */}
          <Card>
            <CardHeader>
              <CardTitle>Textos institucionales</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="bg-accent-subtle border border-accent-border rounded-md p-3">
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles size={16} className="text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-text-primary font-medium">Generar con IA</div>
                </div>
                <div className="text-xs text-text-secondary mb-2">
                  Escribe un par de detalles sobre tu negocio (rubro, años, ubicación, lo que te distingue). La IA propone misión, visión y descripción — luego los editas.
                </div>
                <Textarea
                  value={aiHint}
                  onChange={(e) => setAiHint(e.target.value)}
                  placeholder="Ej: Somos una distribuidora de electrodomésticos en Caracas con 8 años de operación, vendemos al detal y al mayor con envío a todo el país."
                  maxLength={1000}
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" loading={aiLoading} onClick={generateAI}><Sparkles size={13} /> Generar</Button>
                </div>
              </div>

              <Textarea
                label="Misión"
                value={site.mission}
                onChange={(e) => setField('mission', e.target.value)}
                maxLength={2000}
              />
              <Textarea
                label="Visión"
                value={site.vision}
                onChange={(e) => setField('vision', e.target.value)}
                maxLength={2000}
              />
              <Textarea
                label="Descripción breve"
                value={site.description}
                onChange={(e) => setField('description', e.target.value)}
                maxLength={4000}
              />
            </CardBody>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader><CardTitle>Datos de contacto (opcionales)</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Correo"
                type="email"
                value={site.contactEmail}
                onChange={(e) => setField('contactEmail', e.target.value)}
                maxLength={200}
              />
              <Input
                label="Teléfono"
                value={site.contactPhone}
                onChange={(e) => setField('contactPhone', e.target.value)}
                maxLength={40}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Dirección"
                  value={site.contactAddress}
                  onChange={(e) => setField('contactAddress', e.target.value)}
                  maxLength={300}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Columna 3: branding + assets + template */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Colores</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-3">
              <ColorField label="Principal" hint="Botones y acentos" value={site.colorPrimary} onChange={(v) => setField('colorPrimary', v)} />
              <ColorField label="Oscuro" hint="Texto y contraste" value={site.colorAccent} onChange={(v) => setField('colorAccent', v)} />
              <ColorField label="Fondo" hint="Fondo del sitio" value={site.colorNeutral} onChange={(v) => setField('colorNeutral', v)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
            <CardBody>
              <LogoUploader
                fileId={site.logoFileId}
                onUpload={onLogo}
                onClear={() => setField('logoFileId', null)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Imágenes del negocio ({site.imageFileIds.length}/7)</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <div className={cn('text-xs', hasEnoughImages ? 'text-text-muted' : 'text-warning')}>
                {hasEnoughImages ? 'Se usan en el hero y la galería del sitio.' : `Sube al menos 4 imágenes (llevas ${site.imageFileIds.length}).`}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {site.imageFileIds.map((id, i) => (
                  <div key={id} className="relative aspect-[4/3] rounded-md overflow-hidden bg-surface-2 border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${id}`} alt={`imagen ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded p-1">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {site.imageFileIds.length < 7 && (
                  <label className="aspect-[4/3] flex items-center justify-center gap-1.5 border border-dashed border-border rounded-md text-xs text-text-secondary hover:bg-surface-2 cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onAddImage(f)
                        e.target.value = ''
                      }}
                    />
                    <Upload size={13} /> Añadir
                  </label>
                )}
              </div>
              <div className="text-xs text-text-muted">JPG, PNG o WEBP. Hasta 1 MB por imagen.</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Template</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-2">
              <TemplateOption value="modern" current={site.template} onChange={(v) => setField('template', v)} title="Moderno" desc="Tipografía serif, hero grande." />
              <TemplateOption value="warm" current={site.template} onChange={(v) => setField('template', v)} title="Cálido" desc="Tonos tierra, cards con sombra." />
              <TemplateOption value="minimal" current={site.template} onChange={(v) => setField('template', v)} title="Minimal" desc="Sans-serif, mucho aire, esquinas rectas." />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2 mt-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-base font-mono flex-1 uppercase"
          maxLength={7}
        />
      </div>
      <div className="text-xs text-text-muted mt-1">{hint}</div>
    </div>
  )
}

function LogoUploader({ fileId, onUpload, onClear }: { fileId: string | null; onUpload: (f: File) => void; onClear: () => void }) {
  if (fileId) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded bg-surface-2 border border-border flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/uploads/${fileId}`} alt="logo" className="h-full w-full object-contain" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-text-primary">Logo cargado</div>
          <button onClick={onClear} className="text-xs text-danger hover:underline">Quitar</button>
        </div>
      </div>
    )
  }
  return (
    <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-md py-6 text-sm text-text-secondary hover:bg-surface-2 cursor-pointer">
      <input
        type="file"
        accept="image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
      <ImageIcon size={14} /> Subir logo (PNG, WEBP o SVG · máx. 500 KB)
    </label>
  )
}

function TemplateOption({ value, current, onChange, title, desc }: {
  value: Template
  current: Template
  onChange: (v: Template) => void
  title: string
  desc: string
}) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'text-left rounded-md border px-3 py-2.5 transition-colors',
        active ? 'border-accent bg-accent-subtle' : 'border-border hover:bg-surface-2',
      )}
    >
      <div className="text-sm font-medium text-text-primary">{title}</div>
      <div className="text-xs text-text-muted mt-0.5">{desc}</div>
    </button>
  )
}
