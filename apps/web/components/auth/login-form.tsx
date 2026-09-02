'use client'

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api, ApiError } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { VerifyCodeResponse, AuthTokens } from '@/types'

interface OAuthProvider {
  provider: string
  label: string
}

/** "Sign in with <provider>" — fetches which OIDC providers (if any) this
 *  instance has configured (see GET /oauth/providers) and renders nothing
 *  when none are. A full browser redirect to the backend, same as
 *  Transfer's own OAuth pattern: the backend owns the whole code exchange,
 *  the frontend only needs to know where /oauth/complete hands off tokens. */
function OAuthProviders() {
  const t = useTranslations('auth.loginForm')
  const [providers, setProviders] = useState<OAuthProvider[]>([])

  useEffect(() => {
    api.get<OAuthProvider[]>('/oauth/providers').then(setProviders).catch(() => {})
  }, [])

  if (providers.length === 0) return null

  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-2xs text-text-tertiary">{t('oauth.divider')}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <Button
            key={p.provider}
            type="button"
            variant="tinted"
            size="lg"
            className="w-full"
            onClick={() => {
              const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
              window.location.href = `${API_URL}/oauth/auth/${p.provider}`
            }}
          >
            {t('oauth.signInWith', { provider: p.label })}
          </Button>
        ))}
      </div>
    </>
  )
}

type Step = 'email' | 'code' | 'password' | 'classic'

/** oauth_error query-param reasons (set by /oauth/complete) → translation
 *  key. Kept as a plain lookup table, not a t()-call map, since the message
 *  catalog isn't available at module scope — resolved against `t` inside
 *  the component instead. */
const OAUTH_ERROR_KEYS: Record<string, string> = {
  not_configured: 'oauthErrors.notConfigured',
  failed: 'oauthErrors.failed',
  no_email: 'oauthErrors.noEmail',
  deactivated: 'oauthErrors.deactivated',
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('auth.loginForm')
  const [step, setStep] = useState<Step>('classic')
  const [oauthError, setOauthError] = useState(() => {
    const reason = searchParams.get('oauth_error')
    if (!reason) return ''
    return t(OAUTH_ERROR_KEYS[reason] ?? 'oauthErrors.failed')
  })
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [codeError, setCodeError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)

  // Classic login fields
  const [classicEmail, setClassicEmail] = useState('')
  const [classicPassword, setClassicPassword] = useState('')
  const [classicError, setClassicError] = useState('')

  // Starts hidden: showing the link only once the backend has confirmed
  // magic-link sign-in is actually on avoids offering a dead end.
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(false)

  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    api
      .get<{ magic_link_enabled: boolean }>('/auth/config')
      .then((cfg) => setMagicLinkEnabled(cfg.magic_link_enabled))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (step === 'code') {
      codeRefs.current[0]?.focus()
    }
  }, [step])

  // ─── Step 1: Send magic code ──────────────────────────────────────────────

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    setGeneralError('')

    if (!email) {
      setEmailError(t('validation.emailRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('validation.emailInvalid'))
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/send-magic-code', { email })
      setStep('code')
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.detail)
      } else {
        setGeneralError(t('validation.sendCodeFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 2: Verify code ─────────────────────────────────────────────────

  function handleCodeChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    setCodeError('')

    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits filled
    if (digit && index === 5) {
      const fullCode = [...newCode].join('')
      if (fullCode.length === 6) {
        submitCode(fullCode)
      }
    }
  }

  function handleCodeKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  function handleCodePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const newCode = Array.from({ length: 6 }, (_, i) => pasted[i] || '')
      setCode(newCode)
      codeRefs.current[Math.min(pasted.length, 5)]?.focus()
      if (pasted.length === 6) {
        submitCode(pasted)
      }
    }
  }

  async function submitCode(codeStr: string) {
    setCodeError('')
    setGeneralError('')
    setLoading(true)
    try {
      const res = await api.post<VerifyCodeResponse>('/auth/verify-magic-code', {
        email,
        code: codeStr,
      })

      if (res.needs_password) {
        // Persist the tokens issued by verify-magic-code before moving on:
        // /auth/set-password requires an authenticated user (get_current_user),
        // so without these the set-password call 401s and bounces the user out.
        setTokens(res.access_token, res.refresh_token)
        setStep('password')
      } else {
        setTokens(res.access_token, res.refresh_token)
        await useAuthStore.getState().fetchUser()
        const user = useAuthStore.getState().user
        router.replace('/projects')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setCodeError(err.detail)
      } else {
        setCodeError(t('validation.codeInvalid'))
      }
      setCode(['', '', '', '', '', ''])
      codeRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    const codeStr = code.join('')
    if (codeStr.length < 6) {
      setCodeError(t('validation.codeIncomplete'))
      return
    }
    await submitCode(codeStr)
  }

  // ─── Step 3: Set password ────────────────────────────────────────────────

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setGeneralError('')

    if (!password) {
      setPasswordError(t('validation.passwordRequired'))
      return
    }
    if (password.length < 8) {
      setPasswordError(t('validation.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setPasswordError(t('validation.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await api.post<AuthTokens>('/auth/set-password', {
        email,
        code: code.join(''),
        password,
      })
      setTokens(res.access_token, res.refresh_token)
      await useAuthStore.getState().fetchUser()
      const u = useAuthStore.getState().user
      router.replace('/projects')
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.detail)
      } else {
        setGeneralError(t('validation.setPasswordFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Classic login ───────────────────────────────────────────────────────

  async function handleClassicLogin(e: React.FormEvent) {
    e.preventDefault()
    setClassicError('')

    if (!classicEmail || !classicPassword) {
      setClassicError(t('validation.classicRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(classicEmail)) {
      setClassicError(t('validation.emailInvalid'))
      return
    }

    setLoading(true)
    try {
      const res = await api.post<AuthTokens>('/auth/login', {
        email: classicEmail,
        password: classicPassword,
      })
      setTokens(res.access_token, res.refresh_token)
      await useAuthStore.getState().fetchUser()
      const u = useAuthStore.getState().user
      router.replace('/projects')
    } catch (err) {
      if (err instanceof ApiError) {
        setClassicError(err.detail)
      } else {
        setClassicError(t('validation.classicInvalid'))
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (step === 'classic') {
    return (
      <div className="animate-slide-up">
        <div className="mb-8">
          <h1 className="text-auth-title font-black text-text-primary mb-1">{t('classic.title')}</h1>
          <p className="text-sm text-text-secondary">{t('classic.subtitle')}</p>
        </div>

        <form onSubmit={handleClassicLogin} className="flex flex-col gap-4">
          {(classicError || oauthError) && (
            <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
              {classicError || oauthError}
            </div>
          )}

          <Input
            variant="onGlass"
            label={t('common.emailLabel')}
            type="email"
            placeholder={t('common.emailPlaceholder')}
            autoComplete="email"
            value={classicEmail}
            onChange={(e) => setClassicEmail(e.target.value)}
          />

          <Input
            variant="onGlass"
            label={t('common.passwordLabel')}
            type="password"
            placeholder={t('classic.passwordPlaceholder')}
            autoComplete="current-password"
            value={classicPassword}
            onChange={(e) => setClassicPassword(e.target.value)}
          />

          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
            {t('classic.submit')}
          </Button>
        </form>

        <OAuthProviders />

        {magicLinkEnabled && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setStep('email'); setClassicError(''); setOauthError('') }}
              className="text-base text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {t('classic.useMagicCode')}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (step === 'password') {
    return (
      <div className="animate-slide-up">
        <div className="mb-8">
          <h1 className="text-auth-title font-black text-text-primary mb-1">{t('setPassword.title')}</h1>
          <p className="text-sm text-text-secondary">
            {t('setPassword.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
          {generalError && (
            <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
              {generalError}
            </div>
          )}

          <Input
            variant="onGlass"
            label={t('common.passwordLabel')}
            type="password"
            placeholder={t('setPassword.passwordPlaceholder')}
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError('') }}
            error={passwordError}
          />

          <Input
            variant="onGlass"
            label={t('setPassword.confirmLabel')}
            type="password"
            placeholder={t('setPassword.confirmPlaceholder')}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
            {t('setPassword.submit')}
          </Button>
        </form>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className="animate-slide-up">
        <div className="mb-8">
          <h1 className="text-auth-title font-black text-text-primary mb-1">{t('code.title')}</h1>
          {/* The API answers identically whether or not the address has an
              account, deliberately, so that this endpoint cannot be used to
              enumerate registered emails. Claiming "we sent a code" asserts
              something it never told us, and for an unknown address it is
              simply untrue: the person then waits for mail that cannot
              arrive. Say only what the server guarantees. (#248) */}
          <p className="text-sm text-text-secondary">
            {t.rich('code.description', {
              email,
              styled: (chunks) => <span className="text-text-primary font-medium">{chunks}</span>,
            })}
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="flex flex-col gap-6">
          {/* 6-digit code inputs */}
          <div className="flex gap-2 justify-between">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { codeRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                onPaste={handleCodePaste}
                className={cn(
                  'h-12 w-full max-w-[48px] rounded-md border bg-[color:var(--input-glass-bg)] text-center text-lg font-semibold text-[color:var(--input-glass-text)]',
                  'transition-colors focus:outline-none focus:border-[color:var(--input-glass-border-focus)] focus:ring-1 focus:ring-[color:var(--input-glass-border-focus)]',
                  codeError ? 'border-status-error' : 'border-[color:var(--input-glass-border)]',
                )}
              />
            ))}
          </div>

          {codeError ? (
            <p className="text-sm text-status-error -mt-3">{codeError}</p>
          ) : (
            // A mistyped address is the common case behind "no code arrived",
            // and it is the one thing the person can check without us telling
            // them whether the account exists.
            <p className="text-sm text-text-tertiary -mt-3">
              {t('code.noCodeHint')}
            </p>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {t('code.submit')}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); setCodeError('') }}
            className="block w-full rounded-md border border-border bg-bg-secondary px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-focus hover:text-text-primary"
          >
            {t('code.useDifferentEmail')}
          </button>
        </div>
      </div>
    )
  }

  // Step: Email (magic code entry)
  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h1 className="text-auth-title font-black text-text-primary mb-1">{t('magicCode.title')}</h1>
        <p className="text-sm text-text-secondary">
          {t('magicCode.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSendCode} className="flex flex-col gap-4">
        {generalError && (
          <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
            {generalError}
          </div>
        )}

        <Input
          variant="onGlass"
          label={t('common.emailLabel')}
          type="email"
          placeholder={t('common.emailPlaceholder')}
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
          error={emailError}
        />

        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
          {t('magicCode.submit')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => { setStep('classic'); setGeneralError('') }}
          className="text-base text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {t('magicCode.backToPassword')}
        </button>
      </div>
    </div>
  )
}
