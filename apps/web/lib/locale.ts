/** Locale constants shared between middleware.ts (Edge runtime), i18n/request.ts
 *  (server), and client code (login flow, language switcher) — kept import-safe
 *  for all three by avoiding any 'next/headers' or DOM-only API here. */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'fr'
export const LOCALE_COOKIE = 'ff_locale'

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Client-only: persist the chosen locale so the next request (middleware,
 *  then i18n/request.ts) picks it up. Call `router.refresh()` afterwards to
 *  re-render the current page's Server Components with it — setting the
 *  cookie alone doesn't retroactively change an already-rendered tree. */
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}
