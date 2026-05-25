'use client'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface Props {
  user: { name?: string | null; email: string }
  initialRate: number
  children: React.ReactNode
}

export function DashboardShell({ user, initialRate, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex sticky top-0 self-start h-screen">
        <Sidebar user={user} />
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden data-[state=open]:animate-in data-[state=open]:fade-in" />
          <Dialog.Content
            className="fixed left-0 top-0 bottom-0 z-50 md:hidden focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Navegación</Dialog.Title>
            <Sidebar user={user} onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar initialRate={initialRate} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full">{children}</main>
      </div>
    </div>
  )
}
