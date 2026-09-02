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
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  if (!error.code) return error.detail
  try {
    return t(error.code, error.params)
  } catch {
    return error.detail
  }
}
