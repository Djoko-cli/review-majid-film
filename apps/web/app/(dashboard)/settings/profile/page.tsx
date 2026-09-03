'use client'

import * as React from 'react'
import { User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/shared/avatar'
import { setTokens } from '@/lib/auth'

export default function ProfilePage() {
  const t = useTranslations('settings.profile')
  const { user, fetchUser } = useAuthStore()

  const [name, setName] = React.useState(user?.name ?? '')
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)
  const [profileError, setProfileError] = React.useState('')
  const [profileSuccess, setProfileSuccess] = React.useState(false)

  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [isSavingPassword, setIsSavingPassword] = React.useState(false)
  const [passwordError, setPasswordError] = React.useState('')
  const [passwordSuccess, setPasswordSuccess] = React.useState(false)

  // Sync name when user loads
  React.useEffect(() => {
    if (user?.name) setName(user.name)
  }, [user?.name])

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    if (!name.trim()) {
      setProfileError(t('nameRequired'))
      return
    }
    setIsSavingProfile(true)
    try {
      await api.patch(`/users/${user?.id}`, { name: name.trim() })
      await fetchUser()
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('saveProfileError')
      setProfileError(message)
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('allFieldsRequired'))
      return
    }
    if (newPassword.length < 8) {
      setPasswordError(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'))
      return
    }

    setIsSavingPassword(true)
    try {
      const response = await api.patch('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      }) as { access_token: string, refresh_token:string}

      if (response.access_token && response.refresh_token) {
        setTokens(response.access_token, response.refresh_token)
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('changePasswordError')
      setPasswordError(message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted">
          <User className="h-5 w-5 text-text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{t('heading')}</h1>
          <p className="text-sm text-text-secondary">
            {t('subheading')}
          </p>
        </div>
      </div>

      {/* Profile section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          {t('sectionProfile')}
        </h2>

        <div className="flex items-center gap-4">
          <Avatar src={user?.avatar_url} name={user?.name} size="lg" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {user?.name ?? t('loadingName')}
            </p>
            <p className="text-xs text-text-tertiary">{user?.email ?? ''}</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-medium text-text-secondary">
              {t('fullNameLabel')}
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-text-secondary">
              {t('emailLabel')}
            </label>
            <Input
              id="email"
              value={user?.email ?? ''}
              disabled
              className="opacity-60 cursor-not-allowed"
            />
            <p className="text-2xs text-text-tertiary">
              {t('emailHint')}
            </p>
          </div>

          {profileError && (
            <p className="text-xs text-status-error">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-xs text-status-success">{t('saveProfileSuccess')}</p>
          )}

          <Button type="submit" variant="primary" size="sm" loading={isSavingProfile}>
            {t('saveProfile')}
          </Button>
        </form>
      </section>

      {/* Password section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          {t('changePassword')}
        </h2>

        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="currentPassword" className="text-xs font-medium text-text-secondary">
              {t('currentPasswordLabel')}
            </label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('currentPasswordPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-xs font-medium text-text-secondary">
              {t('newPasswordLabel')}
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('newPasswordPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-text-secondary">
              {t('confirmPasswordLabel')}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
            />
          </div>

          {passwordError && (
            <p className="text-xs text-status-error">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-xs text-status-success">{t('changePasswordSuccess')}</p>
          )}

          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={isSavingPassword}
          >
            {t('changePassword')}
          </Button>
        </form>
      </section>
    </div>
  )
}
