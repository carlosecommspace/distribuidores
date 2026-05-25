'use client'
import { useState } from 'react'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Plus, Trash2 } from 'lucide-react'

interface QR { id?: string; trigger: string; reply: string }

export function QuickReplyManager({ initial }: { initial: QR[] }) {
  const [items, setItems] = useState<QR[]>(initial.length ? initial : [{ trigger: '', reply: '' }])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/whatsapp/replies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ replies: items.filter((x) => x.trigger && x.reply) }),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error('Error al guardar')
      return
    }
    toast.success('Respuestas guardadas')
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-border rounded-md p-4 bg-surface-2">
          <Input
            label="Trigger"
            placeholder="¿Cuál es el precio de X?"
            value={it.trigger}
            onChange={(e) => {
              const c = [...items]; c[i] = { ...c[i], trigger: e.target.value }; setItems(c)
            }}
          />
          <Textarea
            label="Respuesta"
            placeholder="Hola, el precio actual es $X. Disponible para entrega."
            value={it.reply}
            onChange={(e) => {
              const c = [...items]; c[i] = { ...c[i], reply: e.target.value }; setItems(c)
            }}
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              className="text-xs text-danger hover:underline inline-flex items-center gap-1"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        </div>
      ))}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setItems([...items, { trigger: '', reply: '' }])}>
          <Plus size={14} /> Añadir respuesta
        </Button>
        <Button loading={saving} onClick={save}>Guardar</Button>
      </div>
    </div>
  )
}
