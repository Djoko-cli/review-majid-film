'use client'

import * as React from 'react'
import { Upload, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth-store'
import { HARDCODED_DEFAULTS, useBrandingStore } from '@/stores/branding-store'
import { api, ApiError } from '@/lib/api'
import { translateApiError } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BrandingLogoUpload } from '@/components/settings/branding-logo-upload'

type BrandingSlot = 'logo-light' | 'logo-dark' | 'favicon' | 'apple-icon' | 'login-logo'

interface BrandingUrls {
  logo_light_url?: string | null
  logo_dark_url?: string | null
  favicon_url?: string | null
  apple_icon_url?: string | null
  login_logo_url?: string | null
}

// The update response carries a URL for every slot that's set, not just the one that
// changed — each slot has to read back its own field or it reports another slot's image.
const SLOT_FIELDS: Record<BrandingSlot, { keyField: string; urlField: keyof BrandingUrls }> = {
  'logo-light': { keyField: 'logo_light_key', urlField: 'logo_light_url' },
  'logo-dark': { keyField: 'logo_dark_key', urlField: 'logo_dark_url' },
  favicon: { keyField: 'favicon_key', urlField: 'favicon_url' },
  'apple-icon': { keyField: 'apple_icon_key', urlField: 'apple_icon_url' },
  'login-logo': { keyField: 'login_logo_key', urlField: 'login_logo_url' },
}

function QuickUpload({
  onSlotUpload,
}: {
  onSlotUpload: (slot: BrandingSlot, url: string) => void
}) {
  const t = useTranslations('settings.brandingTab.quickUpload')
  const tErrors = useTranslations('errors')
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)

    if (file.size > 2 * 1024 * 1024) {
      setError(t('fileTooLarge'))
      return
    }

    setUploading(true)
    // The signature covers the content type, so the same value has to go on the PUT.
    const contentType = file.type || 'image/png'
    try {
      for (const slot of Object.keys(SLOT_FIELDS) as BrandingSlot[]) {
        const { keyField, urlField } = SLOT_FIELDS[slot]
        const presignData = await api.post<{ upload_url: string; key: string }>(
          `/instance/branding/${slot}-upload?content_type=${encodeURIComponent(contentType)}`
        )
        const { upload_url: presignedUrl, key: s3Key } = presignData

        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        })
        if (!uploadRes.ok) throw new Error(t('failedToUploadFor', { slot }))

        const data = await api.put<BrandingUrls>('/instance/branding', { [keyField]: s3Key })
        const url = data[urlField]
        // Apply each slot as it lands, so a later failure doesn't discard the ones
        // the server already accepted.
        if (url) onSlotUpload(slot, url)
      }
    } catch (err) {
      setError(err instanceof ApiError ? translateApiError(err, tErrors) : t('uploadFailedGeneric'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="secondary"
        size="lg"
        loading={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="w-full max-w-xs"
      >
        <Upload className="h-4 w-4" />
        {uploading ? t('uploading') : t('uploadYourLogo')}
      </Button>
      <p className="text-xs text-text-tertiary text-center">
        {t('helperFormats')}
        <br />
        {t('helperApplyAll')}
      </p>
    </div>
  )
}

export function BrandingTab() {
  const t = useTranslations('settings.brandingTab')
  const tErrors = useTranslations('errors')
  const { user } = useAuthStore()
  const {
    orgName,
    orgLogoDark,
    orgLogoLight,
    faviconUrl,
    appleIconUrl,
    loginLogoUrl,
    poweredByFreeframe,
    primaryColor,
    setOrgLogoDark,
    setOrgLogoLight,
    setFaviconUrl,
    setAppleIconUrl,
    setLoginLogoUrl,
    fetchBranding,
    loaded,
  } = useBrandingStore()

  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [resetError, setResetError] = React.useState<string | null>(null)

  const isAdmin = user?.is_superadmin

  React.useEffect(() => {
    if (!loaded) fetchBranding()
  }, [loaded, fetchBranding])

  // Name, accent color, the live preview, and the "Powered by FreeFrame"
  // toggle used to live here too. This instance's identity is fixed now
  // (Review's own logo, hardcoded as the default everywhere it renders —
  // sidebar, login, favicon, share pages), so only the logo slots stay
  // editable, in case a real replacement is ever needed. Reset still zeroes
  // out name/color/attribution along with the logos, so it remains a true
  // full reset even though nothing here edits those three directly.
  async function handleResetAll() {
    setResetting(true)
    setResetError(null)
    try {
      const data = await api.put('/instance/branding', {
        org_name: HARDCODED_DEFAULTS.orgName,
        logo_light_key: null,
        logo_dark_key: null,
        favicon_key: null,
        apple_icon_key: null,
        login_logo_key: null,
        primary_color: null,
        powered_by_freeframe: HARDCODED_DEFAULTS.poweredByFreeframe,
      })
      const { syncBranding } = useBrandingStore.getState()
      syncBranding(data as never)
      setResetOpen(false)
    } catch (err) {
      // Rethrow so ConfirmDialog leaves itself open instead of closing as if the
      // reset had worked — the message below tells the admin what went wrong.
      setResetError(err instanceof ApiError ? translateApiError(err, tErrors) : t('resetFailed'))
      throw err
    } finally {
      setResetting(false)
    }
  }

  const hasCustomBranding =
    orgName !== HARDCODED_DEFAULTS.orgName ||
    orgLogoDark !== null ||
    orgLogoLight !== null ||
    faviconUrl !== null ||
    appleIconUrl !== null ||
    loginLogoUrl !== null ||
    primaryColor !== HARDCODED_DEFAULTS.primaryColor ||
    poweredByFreeframe !== HARDCODED_DEFAULTS.poweredByFreeframe

  const slotProps = {
    disabled: !isAdmin,
  }

  return (
    // No heading of its own: this renders under the Admin Dashboard header as a sub-tab.
    <div className="max-w-5xl space-y-10">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">{t('logosIcons.title')}</h2>
        <p className="-mt-1 text-sm text-text-secondary">
          {t('logosIcons.subtitle')}
        </p>

        {isAdmin && (
          <div className="rounded-lg border-2 border-dashed border-border bg-bg-secondary p-4 transition-colors hover:border-accent/50">
            <QuickUpload
              onSlotUpload={(slot, url) => {
                const setters: Record<BrandingSlot, (url: string) => void> = {
                  'logo-light': setOrgLogoLight,
                  'logo-dark': setOrgLogoDark,
                  favicon: setFaviconUrl,
                  'apple-icon': setAppleIconUrl,
                  'login-logo': setLoginLogoUrl,
                }
                setters[slot](url)
              }}
            />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <BrandingLogoUpload
            slotKey="logo_light"
            label={t('slots.logoLight.label')}
            description={t('slots.logoLight.description')}
            acceptedFormats={['PNG', 'SVG', 'WebP']}
            minResolution="256px+"
            currentUrl={orgLogoLight}
            defaultUrl="/logo-icon-dark.png"
            previewBg="bg-white"
            {...slotProps}
            onUpload={(url) => setOrgLogoLight(url)}
            onRemove={() => setOrgLogoLight(null)}
          />

          <BrandingLogoUpload
            slotKey="logo_dark"
            label={t('slots.logoDark.label')}
            description={t('slots.logoDark.description')}
            acceptedFormats={['PNG', 'SVG', 'WebP']}
            minResolution="256px+"
            currentUrl={orgLogoDark}
            defaultUrl="/logo-icon.png"
            previewBg="bg-zinc-900"
            {...slotProps}
            onUpload={(url) => setOrgLogoDark(url)}
            onRemove={() => setOrgLogoDark(null)}
          />

          <BrandingLogoUpload
            slotKey="favicon"
            label={t('slots.favicon.label')}
            description={t('slots.favicon.description')}
            acceptedFormats={['ICO', 'PNG']}
            minResolution="32px+"
            currentUrl={faviconUrl}
            previewBg="bg-zinc-900"
            {...slotProps}
            onUpload={(url) => setFaviconUrl(url)}
            onRemove={() => setFaviconUrl(null)}
          />

          <BrandingLogoUpload
            slotKey="apple_icon"
            label={t('slots.appleIcon.label')}
            description={t('slots.appleIcon.description')}
            acceptedFormats={['PNG']}
            minResolution="180px+"
            currentUrl={appleIconUrl}
            defaultUrl="/apple-icon.png"
            previewBg="bg-zinc-900"
            {...slotProps}
            onUpload={(url) => setAppleIconUrl(url)}
            onRemove={() => setAppleIconUrl(null)}
          />

          <BrandingLogoUpload
            slotKey="login_logo"
            label={t('slots.loginLogo.label')}
            description={t('slots.loginLogo.description')}
            acceptedFormats={['PNG', 'SVG', 'WebP']}
            minResolution="512px+"
            currentUrl={loginLogoUrl}
            previewBg="bg-zinc-900"
            {...slotProps}
            onUpload={(url) => setLoginLogoUrl(url)}
            onRemove={() => setLoginLogoUrl(null)}
          />
        </div>
      </section>

      {/* ── Section: Reset ── */}
      {isAdmin && hasCustomBranding && (
        <section className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-status-error hover:text-status-error hover:bg-status-error/10 gap-1.5"
            onClick={() => {
              setResetError(null)
              setResetOpen(true)
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('resetAllBranding')}
          </Button>
          {resetError && (
            <p className="mt-2 text-xs text-status-error">{resetError}</p>
          )}
        </section>
      )}

      {!isAdmin && (
        <p className="text-xs text-text-tertiary">
          {t('adminOnlyNotice')}
        </p>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('resetDialog.title')}
        description={t('resetDialog.description')}
        confirmLabel={t('resetDialog.confirm')}
        variant="danger"
        loading={resetting}
        error={resetError}
        onConfirm={handleResetAll}
      />
    </div>
  )
}
