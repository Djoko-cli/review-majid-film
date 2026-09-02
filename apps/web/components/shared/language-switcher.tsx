'use client'

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUPPORTED_LOCALES, setLocaleCookie, type Locale } from '@/lib/locale'

const LOCALE_LABELS: Record<Locale, string> = { fr: 'FR', en: 'EN' }

// Each option is a fixed 2rem (32px) wide — the sliding indicator below
// reuses this exact value so its translateX always lands flush on whichever
// option is active, regardless of label length.
const OPTION_WIDTH_PX = 32

/** Frosted (glass-panel), not flat: this floats over the auth screen's photo
 *  backdrop, and a flat pill was hard to read against a busy image — glass
 *  chrome reads clearly over anything behind it by design (see globals.css's
 *  glass recipe). The active option is a pill that slides between FR/EN via
 *  a transform transition, rather than the highlight jumping instantly.
 *  Persists the choice via a cookie (lib/locale.ts) read by middleware.ts
 *  and i18n/request.ts on the next request, then refreshes the current
 *  page's Server Components so the change is visible immediately without a
 *  full reload. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const activeIndex = SUPPORTED_LOCALES.indexOf(locale)

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
        'glass-panel inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-0.5',
        className,
      )}
    >
      <Globe className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
      <div className="relative inline-flex">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-8 rounded-full bg-accent transition-transform duration-200 ease-spring"
          style={{ transform: `translateX(${activeIndex * OPTION_WIDTH_PX}px)` }}
        />
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            disabled={isPending}
            onClick={() => handleSelect(l)}
            aria-pressed={l === locale}
            className={cn(
              'relative z-10 w-8 rounded-full py-1 text-2xs font-medium transition-colors disabled:opacity-60',
              l === locale ? 'text-white' : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  )
}
