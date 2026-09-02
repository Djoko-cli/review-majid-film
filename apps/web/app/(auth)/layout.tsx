import type { Metadata } from "next"
import { AuthBrandingHeader } from "@/components/auth/auth-branding-header"
import { BrandPanel } from "@/components/auth/brand-panel"
import { GlintBorder } from "@/components/auth/glint-border"
import { LanguageSwitcher } from "@/components/shared/language-switcher"

export const metadata: Metadata = {
  title: "Review — Sign in",
}

const CARD_RADIUS = 28

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
      <LanguageSwitcher className="absolute right-4 top-4 z-10" />

      {/* Radial glow standing in as the backdrop until brand slide sync is
          configured — BrandPanel renders nothing when there's no synced
          photography yet (never a placeholder image), so this stays the
          honest fallback rather than a permanent decoration underneath it. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[720px] w-[720px] rounded-full bg-accent/[0.07] blur-[140px]" />
      </div>
      <BrandPanel />

      {/* Branding header — shown on every auth screen (login, setup, invite) */}
      <AuthBrandingHeader />

      {/* Card — the liquid-glass recipe shared with Transfer: 28px radius,
          22px blur, diagonal near-black gradient, translucent hairline —
          plus the scintillating glint sweeping its outline. */}
      <div className="relative w-full max-w-[440px]" style={{ borderRadius: CARD_RADIUS }}>
        <GlintBorder radius={CARD_RADIUS} />
        <div className="glass-panel relative rounded-glass p-8 animate-fade-in">
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="relative mt-8 text-2xs text-text-tertiary">
        Self-hosted media review &amp; approval
      </p>
    </div>
  )
}
