'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { RefreshQuestionsButton } from '@/components/ml/MLActions'
import { formatRelative } from '@/lib/utils'
import { Sparkles, MessageSquare, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  questionText: string
  buyerNickname?: string | null
  status: string
  answerText?: string | null
  answeredBy?: string | null
  aiSuggestion?: string | null
  createdAt: string
  product?: { id: string; name: string; sku: string; images: string[]; priceUSD: number; stock: number } | null
}

export default function QuestionsPage() {
  const [tab, setTab] = useState<'unanswered' | 'answered' | 'all'>('unanswered')
  const [items, setItems] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Question | null>(null)
  const [answer, setAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/ml/questions?status=${tab}`)
    const data = await r.json()
    setItems(data)
    setLoading(false)
    if (data.length > 0 && (!selected || !data.find((q: Question) => q.id === selected.id))) {
      setSelected(data[0])
      setAnswer(data[0].answerText || '')
    }
  }

  useEffect(() => { load() }, [tab])

  const onSelect = (q: Question) => {
    setSelected(q)
    setAnswer(q.answerText || '')
  }

  const onSuggest = async () => {
    if (!selected) return
    setAiLoading(true)
    const r = await fetch('/api/ml/questions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: selected.id, action: 'suggest' }),
    })
    setAiLoading(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      toast.error(e.error || 'No se pudo generar sugerencia')
      return
    }
    const d = await r.json()
    if (d.suggestion) {
      setAnswer(d.suggestion)
      toast.success('Sugerencia generada')
    } else {
      toast.error('La IA no devolvió texto (¿API key configurada?)')
    }
  }

  const onAnswer = async () => {
    if (!selected || !answer.trim()) return
    setSending(true)
    const r = await fetch('/api/ml/questions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: selected.id, action: 'answer', answerText: answer }),
    })
    setSending(false)
    if (!r.ok) {
      toast.error('Error publicando respuesta')
      return
    }
    toast.success('Respuesta publicada')
    setAnswer('')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Preguntas de MercadoLibre"
        subtitle="Responde rápido y mejora tu reputación de vendedor"
        actions={<RefreshQuestionsButton onDone={load} />}
      />

      <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md w-fit mb-4">
        {[
          { v: 'unanswered', l: 'Sin responder' },
          { v: 'answered', l: 'Respondidas' },
          { v: 'all', l: 'Todas' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as typeof tab)}
            className={cn('px-3 py-1.5 text-xs rounded', tab === t.v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary')}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[480px]">
        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-4 flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={<MessageSquare size={28} />} title="No hay preguntas" description="Cuando tus compradores hagan preguntas aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-border overflow-y-auto max-h-[640px]">
              {items.map((q) => (
                <li
                  key={q.id}
                  onClick={() => onSelect(q)}
                  className={cn(
                    'px-4 py-3 cursor-pointer hover:bg-surface-2',
                    selected?.id === q.id && 'bg-accent-subtle border-l-2 border-l-accent',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">{q.buyerNickname || 'comprador'}</span>
                    {q.status === 'unanswered' && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </div>
                  <div className="text-sm text-text-primary line-clamp-2">{q.questionText}</div>
                  {q.product && <div className="text-xs text-accent mt-1 line-clamp-1">{q.product.name}</div>}
                  <div className="text-xs text-text-muted mt-1">{formatRelative(q.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          {!selected ? (
            <EmptyState icon={<MessageSquare size={28} />} title="Selecciona una pregunta" description="Elige una pregunta del panel izquierdo para responderla." />
          ) : (
            <div className="p-6 flex flex-col gap-5">
              {selected.product && (
                <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-md p-3">
                  {selected.product.images?.[0] && (
                    <img src={selected.product.images[0]} alt="" className="h-14 w-14 rounded-md object-cover" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm">{selected.product.name}</div>
                    <div className="text-xs text-text-muted font-mono">{selected.product.sku} · stock {selected.product.stock}</div>
                  </div>
                  <div className="font-mono text-accent">${selected.product.priceUSD}</div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">
                  Pregunta de {selected.buyerNickname || 'comprador'}
                </div>
                <p className="text-sm bg-surface-2 border border-border rounded-md p-4 whitespace-pre-wrap">{selected.questionText}</p>
              </div>

              {selected.status === 'answered' ? (
                <div>
                  <div className="text-xs uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-2">
                    Respuesta enviada
                    {selected.answeredBy && <Badge tone="info">{selected.answeredBy === 'ai' ? 'IA' : 'manual'}</Badge>}
                  </div>
                  <p className="text-sm bg-success-subtle border border-success/30 rounded-md p-4 whitespace-pre-wrap">{selected.answerText}</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-text-secondary">Tu respuesta</span>
                    <Button variant="secondary" size="sm" loading={aiLoading} onClick={onSuggest}>
                      <Sparkles size={14} /> Sugerir con IA
                    </Button>
                  </div>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    className="min-h-[140px]"
                  />
                  <div className="flex justify-end mt-3">
                    <Button loading={sending} onClick={onAnswer} disabled={!answer.trim()}>
                      <Send size={14} /> Publicar respuesta
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
