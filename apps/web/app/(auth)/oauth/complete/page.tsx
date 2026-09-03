'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api, ApiError } from '@/lib/api'
import { translateApiError } from '@/lib/api-error'
import { setTokens } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { AuthTokens } from '@/types'

/** The OIDC callback's redirect target: trades the one-time exchange code
 *  in the URL for real tokens via POST /oauth/exchange (never the tokens
 *  themselves in the URL — see apps/api/routers/oauth.py's own comment on
 *  why), then continues exactly like any other successful sign-in. */
function OAuthCompleteInner() {
  const t = useTranslations('auth.oauthComplete')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login?oauth_error=failed')
      return
    }

    api
      .post<AuthTokens>('/oauth/exchange', { code }, { skipAuthRetry: true })
      .then(async (res) => {
        setTokens(res.access_token, res.refresh_token)
        await useAuthStore.getState().fetchUser()
        router.replace('/projects')
      })
      .catch((err) => {
        setError(err instanceof ApiError ? translateApiError(err, tErrors) : t('genericError'))
        setTimeout(() => router.replace('/login?oauth_error=failed'), 1500)
      })
    // Runs once on mount; the exchange code is single-use and re-running
    // this on a searchParams identity change would burn it a second time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="animate-fade-in text-center">
      <h1 className="text-xl font-semibold text-text-primary mb-1">
        {error ? t('title') : t('signingYouIn')}
      </h1>
      <p className="text-sm text-text-secondary">{error || t('oneMoment')}</p>
    </div>
  )
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteInner />
    </Suspense>
  )
}
