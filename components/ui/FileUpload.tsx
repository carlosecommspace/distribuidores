'use client'
import { useState, useRef } from 'react'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from './Toast'

interface UploadedFile {
  id: string
  url: string
  filename: string
  mimeType: string
  size: number
}

interface Props {
  value?: string | null           // URL persistida
  onChange: (url: string | null, meta?: UploadedFile) => void
  purpose?: string
  label?: string
  hint?: string
  accept?: string
  className?: string
}

export function FileUpload({
  value,
  onChange,
  purpose = 'payment_proof',
  label,
  hint,
  accept = 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  className,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [meta, setMeta] = useState<{ filename: string; mimeType: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onPick = () => inputRef.current?.click()

  const onFile = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.set('file', file)
    form.set('purpose', purpose)
    try {
      const r = await fetch('/api/uploads', { method: 'POST', body: form })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        toast.error(typeof e.error === 'string' ? e.error : 'Error subiendo archivo')
        return
      }
      const data: UploadedFile = await r.json()
      setMeta({ filename: data.filename, mimeType: data.mimeType })
      onChange(data.url, data)
      toast.success('Comprobante cargado')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = () => {
    setMeta(null)
    onChange(null)
  }

  const isImage = meta?.mimeType?.startsWith('image/') || (value && /\.(jpe?g|png|webp|gif)$/i.test(value))

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-md p-2.5">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Comprobante" className="h-12 w-12 rounded object-cover flex-shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded bg-surface-3 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text-primary truncate">
              {meta?.filename || 'Comprobante cargado'}
            </div>
            <a href={value} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
              Ver archivo
            </a>
          </div>
          <button type="button" onClick={clear} className="text-text-muted hover:text-danger p-1 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="flex items-center justify-center gap-2 bg-surface-2 border border-dashed border-border rounded-md py-4 text-sm text-text-secondary hover:bg-surface-3 hover:border-border-light transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Subiendo…
            </>
          ) : (
            <>
              <Upload size={14} /> Subir imagen o PDF (máx. 5 MB)
            </>
          )}
        </button>
      )}
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  )
}
