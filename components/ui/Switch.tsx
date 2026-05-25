'use client'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface Props {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label?: string
  hint?: string
  disabled?: boolean
}

export function Switch({ checked, onCheckedChange, label, hint, disabled }: Props) {
  return (
    <label className="flex items-center justify-between gap-4">
      {(label || hint) && (
        <div className="flex flex-col">
          {label && <span className="text-sm text-text-primary">{label}</span>}
          {hint && <span className="text-xs text-text-muted">{hint}</span>}
        </div>
      )}
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'w-10 h-6 rounded-full relative transition-colors flex-shrink-0',
          'border border-border bg-surface-2 data-[state=checked]:bg-accent data-[state=checked]:border-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block w-4 h-4 bg-text-primary rounded-full transition-transform translate-x-1',
            'data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-black',
          )}
        />
      </RadixSwitch.Root>
    </label>
  )
}
