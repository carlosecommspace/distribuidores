'use client'
import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: string; type: ToastType; message: string }

interface ToastStore {
  toasts: ToastItem[]
  push: (type: ToastType, message: string) => void
  remove: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (m: string) => useToast.getState().push('success', m),
  error: (m: string) => useToast.getState().push('error', m),
  info: (m: string) => useToast.getState().push('info', m),
}

export function ToastViewport() {
  const { toasts, remove } = useToast()
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItemView key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}

function ToastItemView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {}, [])
  const tones = {
    success: 'border-success/40 bg-success-subtle text-success',
    error: 'border-danger/40 bg-danger-subtle text-danger',
    info: 'border-info/40 bg-info-subtle text-info',
  }
  const Icon = item.type === 'success' ? CheckCircle2 : item.type === 'error' ? AlertCircle : Info
  return (
    <div className={cn('flex items-start gap-2.5 p-3 pr-2 border rounded-md backdrop-blur bg-surface/95 shadow-md', tones[item.type])}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div className="text-sm text-text-primary flex-1">{item.message}</div>
      <button onClick={onClose} className="text-text-muted hover:text-text-primary p-0.5">
        <X size={14} />
      </button>
    </div>
  )
}
