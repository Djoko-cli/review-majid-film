'use client'

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUPPORTED_LOCALES, setLocaleCookie, type Locale } from '@/lib/locale'

const LOCALE_LABELS: Record<Locale, string> = { fr: 'FR', en: 'EN' }

/** A small flat pill, not glass — per DESIGN.md's Chrome-Not-Content rule,
 *  glass is reserved for floating chrome (bars, menus, dialogs), never for
 *  an inline control like this one. Persists the choice via a cookie
 *  (lib/locale.ts) read by middleware.ts and i18n/request.ts on the next
 *  request, then refreshes the current page's Server Components so the
 *  change is visible immediately without a full reload. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSelect(next: Locale) {
    if (next === locale || isPending) return
    setLocaleCookie(next)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-bg-secondary/60 py-0.5 pl-1.5 pr-0.5',
        className,
      )}
    >
      <Globe className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={isPending}
          onClick={() => handleSelect(l)}
          aria-pressed={l === locale}
          className={cn(
            'rounded-full px-2 py-1 text-2xs font-medium transition-colors disabled:opacity-60',
            l === locale
              ? 'bg-accent text-text-inverse'
              : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
