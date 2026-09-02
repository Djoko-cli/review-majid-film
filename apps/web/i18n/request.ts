import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale, isSupportedLocale } from '@/lib/locale'

/** One JSON file per feature area — keeps translation batches (see the i18n
 *  rollout plan) from colliding on the same file, and keeps each file small
 *  enough to review. Every namespace ships an empty `{}` for a locale until
 *  its batch is translated; next-intl treats a missing key as "no
 *  translation," not an error, so partially-translated locales don't crash. */
const NAMESPACES = [
  'dashboard',
  'projects',
  'review',
  'share',
  'layout',
  'auth',
  'settings',
  'shared',
  'ui',
  'upload',
  'errors',
] as const

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const locale: Locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  const messages: Record<string, unknown> = {}
  for (const ns of NAMESPACES) {
    messages[ns] = (await import(`../messages/${locale}/${ns}.json`)).default
  }

  return { locale, messages }
})
