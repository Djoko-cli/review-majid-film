'use client'

import * as React from 'react'
import { useBrandingStore } from '@/stores/branding-store'
import { useResolvedTheme } from '@/hooks/use-resolved-theme'

/** Brand mark shown above the card on every auth screen (login, setup, invite). */
export function AuthBrandingHeader() {
  const { orgName, loginLogoUrl, orgLogoLight, orgLogoDark, fetchBranding, loaded } =
    useBrandingStore()
  const theme = useResolvedTheme()

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
        // No custom mark configured yet: the org name alone carries the
        // identity rather than falling back to freeframe's own logo, which
        // would misrepresent this instance's brand.
        <div className="mb-3 h-2 w-2 mx-auto rounded-full bg-accent" />
      )}
      <h1 className="text-xl font-semibold text-text-primary">{orgName}</h1>
    </div>
  )
}
