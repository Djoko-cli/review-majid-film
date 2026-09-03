import type { useTranslations } from 'next-intl'
import type { ApiError } from './api'

/** Translates an ApiError for display. Uses the `errors` message catalog
 *  when the raising router has migrated to AppHTTPException
 *  (apps/api/core/errors.py) *and* this specific code has a translated
 *  entry yet — falls back to `error.detail` (the backend's own English
 *  message) for anything not yet migrated, or a code without a catalog
 *  entry (most of them, until the Phase 3 rollout batch reaches that
 *  router) — never a raw i18n key or a crash either way.
 *
 *  `t` must already be scoped to the 'errors' namespace:
 *    const t = useTranslations('errors')
 *    translateApiError(error, t)
 */
export function translateApiError(
  error: ApiError,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!error.code) return error.detail
  try {
    // ApiError.params comes straight off the JSON response — every value is a
    // string or number by construction (see AppHTTPException on the backend),
    // never the Date next-intl's type also allows, so the cast is safe.
    return t(error.code, error.params as Record<string, string | number>)
  } catch {
    return error.detail
  }
}
