import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ToastProvider } from "@/components/shared/toast";
import { BrandingHead } from "@/components/shared/branding-head";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
  preload: true,
});

export const metadata: Metadata = {
  title: "Review",
  description: "Self-hosted collaborative media review and approval",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <BrandingHead />
      </head>
      <body className={`${rubik.variable} font-sans antialiased`}>
        {/*
          THESIS: Review reads as glass floating over the work being judged —
          never a UI competing with the footage for attention; refuses the
          flat dark-dashboard-plus-blue-accent default every review tool ships.
          OWN-WORLD: near-black (#050505) ground, one warm accent (#ff7a00)
          carried through every interactive surface via --accent, Rubik at
          weights 300-600 (900 synthetic), translucent frosted panels (blur
          18-22px, saturate 160%, rgba(10,10,10) gradient, 1px rgba(255,255,255,.22)
          hairline, layered shadow) for floating chrome — cards, bars, menus,
          dialogs — never for form controls or the media itself.
          STORY: a reviewer opens a link, signs in through a glass card, and
          everything that isn't the video/image itself recedes into
          translucent chrome so the work stays the subject.
          FIRST VIEWPORT: the sign-in/setup screen — a centered glass card
          (28px radius, 22px blur) on near-black, brand mark above it.
          FORM: brief-pinned — Transfer's own liquid-glass system
          (transfer-majid-film), reused per "the brief wins"; concept-seed.mjs's
          direction roll skipped by design, not by drift.
          FINISH: unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, DESIGN.md, and every shipping
          raster carrying its provenance.
        */}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
