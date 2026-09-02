import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withBasePath } from './lib/base-path'
import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale, SUPPORTED_LOCALES, isSupportedLocale } from './lib/locale'

const PUBLIC_ROUTES = ['/login', '/setup', '/oauth/complete']
const PUBLIC_PREFIXES = ['/invite/', '/share/']

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
// Caches InstanceBranding.default_locale, fetched alongside ff_setup_done
// below (same /setup/status call, no extra round trip) — same 24h TTL, same
// reasoning: this Edge middleware never queries the DB directly.
const INSTANCE_LOCALE_COOKIE = 'ff_instance_locale'

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return false
}

/** First supported tag in an Accept-Language header, e.g. "fr-FR,fr;q=0.9,en;q=0.8"
 *  → "fr". */
function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  for (const tag of header.split(',')) {
    const lang = tag.trim().split(';')[0].split('-')[0].toLowerCase()
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) return lang as Locale
  }
  return null
}

/** Sets ff_locale on `response` only if the incoming request didn't already
 *  have one — an explicit prior choice (switcher, or a previous visit's
 *  Accept-Language resolution) is never overwritten by this. Resolution
 *  order: Accept-Language → the cached instance default (ff_instance_locale,
 *  or `freshInstanceDefault` when this same request just fetched it — see
 *  the /setup/status block below, which would otherwise only benefit the
 *  *next* request, not this one, since a cookie set on the outgoing
 *  response isn't visible on request.cookies until the browser sends it
 *  back) → the hardcoded 'fr' floor. */
function attachLocale(
  request: NextRequest,
  response: NextResponse,
  freshInstanceDefault?: string | null,
): NextResponse {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value
  if (isSupportedLocale(existing)) return response

  const instanceDefault = freshInstanceDefault ?? request.cookies.get(INSTANCE_LOCALE_COOKIE)?.value
  const locale =
    localeFromAcceptLanguage(request.headers.get('accept-language')) ??
    (isSupportedLocale(instanceDefault) ? instanceDefault : null) ??
    DEFAULT_LOCALE
  response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public routes
  if (isPublicRoute(pathname)) {
    return attachLocale(request, NextResponse.next())
  }

  // Check if setup is needed — redirect to /setup if no superadmin exists
  // Uses a cookie cache to avoid calling the API on every request
  const setupDone = request.cookies.get('ff_setup_done')?.value
  if (!setupDone) {
    try {
      const res = await fetch(`${API_URL}/setup/status`, {
        next: { revalidate: 60 }, // Cache for 60 seconds
      })
      if (res.ok) {
        const data = await res.json()
        if (data.needs_setup) {
          const response = NextResponse.redirect(new URL(withBasePath('/setup'), request.url))
          if (isSupportedLocale(data.default_locale)) {
            response.cookies.set(INSTANCE_LOCALE_COOKIE, data.default_locale, { path: '/', maxAge: 60 * 60 * 24 })
          }
          return attachLocale(request, response, data.default_locale)
        }
        // Setup is done — set cookies so we don't check again
        const response = NextResponse.next()
        response.cookies.set('ff_setup_done', '1', { path: '/', maxAge: 60 * 60 * 24 }) // 24 hours
        if (isSupportedLocale(data.default_locale)) {
          response.cookies.set(INSTANCE_LOCALE_COOKIE, data.default_locale, { path: '/', maxAge: 60 * 60 * 24 })
        }
        return attachLocale(request, response, data.default_locale)
      }
    } catch {
      // API unreachable — let the request through, the page will show errors
    }
  }

  // Check for auth tokens
  const accessToken = request.cookies.get('ff_access_token')?.value
  const refreshToken = request.cookies.get('ff_refresh_token')?.value

  if (!accessToken && !refreshToken) {
    const loginUrl = new URL(withBasePath('/login'), request.url)
    loginUrl.searchParams.set('from', pathname)
    return attachLocale(request, NextResponse.redirect(loginUrl))
  }

  return attachLocale(request, NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes
     * - public assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)).*)',
  ],
}
