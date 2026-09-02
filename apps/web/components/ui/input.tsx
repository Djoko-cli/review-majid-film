'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  /** 'onGlass': for a field sitting directly inside a glass-panel card (the
   *  auth screen) — a lighter translucent-white tint instead of the default
   *  opaque flat fill, so it reads as part of the same glass surface
   *  instead of a flat opaque box floating inside translucent chrome.
   *  Pixel-matched to Transfer's own scoped glassFormTheme, which applies
   *  this only inside its glass cards — every other form in this app keeps
   *  the default, deliberately opaque treatment (see DESIGN.md's
   *  Inputs/Fields rule); don't reach for this variant outside a
   *  glass-panel context. */
  variant?: 'default' | 'onGlass'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, type, variant = 'default', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === 'password'
    const onGlass = variant === 'onGlass'

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium',
              onGlass ? 'text-[color:var(--input-glass-label)]' : 'text-text-secondary',
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-tertiary">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            className={cn(
              'flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-all duration-150 focus:outline-none focus:ring-2',
              onGlass
                ? 'bg-[color:var(--input-glass-bg)] border-[color:var(--input-glass-border)] text-[color:var(--input-glass-text)] placeholder:text-[color:var(--input-glass-placeholder)] focus:bg-[color:var(--input-glass-bg-focus)] focus:border-[color:var(--input-glass-border-focus)] focus:ring-[color:var(--input-glass-border-focus)]/20'
                : 'bg-bg-secondary border-border text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-accent/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-9',
              isPassword && 'pr-9',
              error && 'border-status-error focus:border-status-error focus:ring-status-error/20',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2.5 flex items-center text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs text-status-error">{error}</p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
