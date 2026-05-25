'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw]',
            'bg-surface border border-border rounded-lg shadow-lg',
            'max-h-[90vh] flex flex-col',
            sizes[size],
          )}
        >
          <div className="flex items-start justify-between px-6 py-4 border-b border-border">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-text-primary">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-text-secondary mt-0.5">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="text-text-muted hover:text-text-primary p-1">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
