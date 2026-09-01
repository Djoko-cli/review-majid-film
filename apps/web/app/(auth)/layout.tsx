import type { Metadata } from "next"
import { AuthBrandingHeader } from "@/components/auth/auth-branding-header"

export const metadata: Metadata = {
  title: "Review — Sign in",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
      {/* Radial glow standing in for a photo backdrop — Review has no stock
          imagery yet; this is the honest placeholder until it does. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[720px] w-[720px] rounded-full bg-accent/[0.07] blur-[140px]" />
      </div>

      {/* Branding header — shown on every auth screen (login, setup, invite) */}
      <AuthBrandingHeader />

      {/* Card — the liquid-glass recipe shared with Transfer: 28px radius,
          22px blur, diagonal near-black gradient, translucent hairline. */}
      <div className="glass-panel relative w-full max-w-[440px] rounded-glass p-8 animate-fade-in">
        {children}
      </div>

      {/* Footer */}
      <p className="relative mt-8 text-2xs text-text-tertiary">
        Self-hosted media review &amp; approval
      </p>
    </div>
  )
}
