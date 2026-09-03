'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api, ApiError } from '@/lib/api'
import { translateApiError } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBrandingStore } from '@/stores/branding-store'

interface FormState {
  email: string
  name: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  email?: string
  name?: string
  password?: string
  confirmPassword?: string
  general?: string
}

function validate(form: FormState, t: (key: string) => string): FormErrors {
  const errors: FormErrors = {}
  if (!form.email) {
    errors.email = t('validation.emailRequired')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = t('validation.emailInvalid')
  }
  if (!form.name.trim()) {
    errors.name = t('validation.nameRequired')
  }
  if (!form.password) {
    errors.password = t('validation.passwordRequired')
  } else if (form.password.length < 8) {
    errors.password = t('validation.passwordTooShort')
  }
  if (!form.confirmPassword) {
    errors.confirmPassword = t('validation.confirmPasswordRequired')
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = t('validation.passwordMismatch')
  }
  return errors
}

export function SetupWizard() {
  const t = useTranslations('auth.setupWizard')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const orgName = useBrandingStore((s) => s.orgName)
  const [form, setForm] = useState<FormState>({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      // Clear field error on change
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validate(form, t)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setLoading(true)
    setErrors({})
    try {
      await api.post('/setup/create-superadmin', {
        email: form.email,
        name: form.name,
        password: form.password,
      }, { skipAuthRetry: true })
      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 1800)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ general: translateApiError(err, tErrors) })
      } else {
        setErrors({ general: t('genericError') })
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-success/15">
          <svg className="h-6 w-6 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">{t('success.title')}</h2>
        <p className="text-sm text-text-secondary">{t('success.redirecting')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-auth-title font-black text-text-primary mb-1">{t('welcome', { orgName })}</h1>
        <p className="text-sm text-text-secondary">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errors.general && (
          <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
            {errors.general}
          </div>
        )}

        <Input
          variant="onGlass"
          label={t('fullNameLabel')}
          type="text"
          placeholder={t('fullNamePlaceholder')}
          autoComplete="name"
          value={form.name}
          onChange={handleChange('name')}
          error={errors.name}
        />

        <Input
          variant="onGlass"
          label={t('emailLabel')}
          type="email"
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          value={form.email}
          onChange={handleChange('email')}
          error={errors.email}
        />

        <Input
          variant="onGlass"
          label={t('passwordLabel')}
          type="password"
          placeholder={t('passwordPlaceholder')}
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange('password')}
          error={errors.password}
        />

        <Input
          variant="onGlass"
          label={t('confirmPasswordLabel')}
          type="password"
          placeholder={t('confirmPasswordPlaceholder')}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange('confirmPassword')}
          error={errors.confirmPassword}
        />

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="mt-2 w-full"
        >
          {t('submit')}
        </Button>
      </form>
    </div>
  )
}
