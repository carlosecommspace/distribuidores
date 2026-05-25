import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-surface-2 rounded-md animate-pulse', className)} />
}
