import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withBasePath } from './lib/base-path'
import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale, SUPPORTED_LOCALES, isSupportedLocale } from './lib/locale'

const PUBLIC_ROUTES = ['/login', '/setup', '/oauth/complete']
const PUBLIC_PREFIXES = ['/invite/', '/share/']

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return false
}

/** First supported tag in an Accept-Language header, e.g. "fr-FR,fr;q=0.9,en;q=0.8"
 *  → "fr". No instance-default lookup here (would need a DB round-trip this
 *  Edge middleware deliberately avoids, same reasoning as the ff_setup_done
 *  cache below) — that step lands once /setup/status exposes a default_locale
 *  field to cache the same way. */
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
 *  Accept-Language resolution) is never overwritten by this. */
function attachLocale(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value
  if (isSupportedLocale(existing)) return response

  const locale = localeFromAcceptLanguage(request.headers.get('accept-language')) ?? DEFAULT_LOCALE
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
          return attachLocale(request, NextResponse.redirect(new URL(withBasePath('/setup'), request.url)))
        }
        // Setup is done — set cookie so we don't check again
        const response = NextResponse.next()
        response.cookies.set('ff_setup_done', '1', { path: '/', maxAge: 60 * 60 * 24 }) // 24 hours
        return attachLocale(request, response)
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
