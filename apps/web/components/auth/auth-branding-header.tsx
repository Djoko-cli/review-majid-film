'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useBrandingStore } from '@/stores/branding-store'
import { useResolvedTheme } from '@/hooks/use-resolved-theme'

/** Brand mark shown above the card on every auth screen (login, setup, invite). */
export function AuthBrandingHeader() {
  const { orgName, loginLogoUrl, orgLogoLight, orgLogoDark, fetchBranding, loaded } =
    useBrandingStore()
  const theme = useResolvedTheme()
  const t = useTranslations('auth')

  React.useEffect(() => {
    if (!loaded) fetchBranding()
  }, [loaded, fetchBranding])

  const displayLogo =
    loginLogoUrl ||
    (theme === 'dark' ? (orgLogoDark ?? orgLogoLight) : (orgLogoLight ?? orgLogoDark)) ||
    undefined

  return (
    <div className="relative mb-8 text-center">
      {displayLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayLogo}
          alt={orgName}
          className="h-12 mx-auto mb-3 object-contain"
        />
      ) : (
        // Shown when an admin hasn't set a custom mark — Review's own logo,
        // not freeframe's, which would misrepresent this instance's brand
        // (matches sidebar.tsx's same default-icon convention).
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt={orgName} className="logo-dark mx-auto mb-3 h-12 w-12 object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon-dark.png" alt={orgName} className="logo-light mx-auto mb-3 h-12 w-12 object-contain" />
        </>
      )}
      <h1 className="text-halo text-xl font-semibold text-text-primary">{orgName}</h1>
      <p className="text-halo mt-1.5 text-sm text-text-secondary">{t('tagline')}</p>
    </div>
  )
}
