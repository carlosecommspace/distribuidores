'use client'
import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Array<{ value: string; label: string }>
  error?: string
}

const CHEVRON = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, options, error, className, id, ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          'input-base appearance-none pr-10 cursor-pointer',
          error && 'border-danger',
          className,
        )}
        style={{
          backgroundImage: CHEVRON,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '14px 14px',
        }}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  ),
)
Select.displayName = 'Select'
