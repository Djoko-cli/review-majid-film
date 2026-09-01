---
name: Review
description: Self-hosted media review — glass chrome around the work being judged
colors:
  ember-signal: "#ff7a00"
  ember-signal-hover: "rgb(255 143 41)"
  screening-black: "#050505"
  panel: "#141414"
  panel-raised: "#1f1f1f"
  panel-elevated: "#2e2e2e"
  soft-white: "#c1c2c5"
  soft-white-dim: "#a6a7ab"
  soft-white-muted: "#909296"
  status-success: "#34d399"
  status-warning: "#fbbf24"
  status-error: "#f87171"
  status-info: "#60a5fa"
typography:
  body:
    fontFamily: "Rubik, system-ui, -apple-system, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Rubik, system-ui, -apple-system, sans-serif"
    fontWeight: 500
  display:
    fontFamily: "Rubik, system-ui, -apple-system, sans-serif"
    fontWeight: 900
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, ui-monospace, monospace"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  glass: "28px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ember-signal}"
    textColor: "#1a1005"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ember-signal-hover}"
  glass-card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.glass}"
    padding: "32px"
---

# Design System: Review

## Overview

**Creative North Star: "The Frosted Screening Room"**

Review's whole surface reads as a dim screening room: a near-black space where the only warm light is a single tally-signal orange, and every piece of interface chrome — the sidebar rail, the top bar, dropdown menus, modal dialogs, the sign-in card — is a pane of frosted glass floating a few inches off the wall behind it. The metaphor is deliberate: in a real screening room nothing calls attention to itself except the screen and the one glowing indicator that says something is live. The app chrome should feel the same way — present, legible, clearly *there* — but visually receding, so the media actually being reviewed stays the subject.

This is not an invented aesthetic. It's a direct, brief-pinned reuse of the "liquid glass" system already shipped on Review's sibling tool, Transfer (transfer.majid.film) — same accent hex, same near-black palette, same glass recipe, same font. The two apps are meant to read as one family, not two products that happen to share a designer. Where this build diverges from Transfer at all (a 3-shade accent derivation instead of Transfer's full 10-shade Mantine scale; a placeholder accent-dot mark instead of a real logo) it's because Review's own architecture doesn't need the extra shades yet, or because a real asset doesn't exist yet — never a stylistic choice.

**Key Characteristics:**
- Near-black ground (#050505) with one warm accent, never a second competing hue
- Floating chrome is glass (blurred, translucent, bordered); form controls are not
- Dark is the only mode — no light/dark toggle in the internal app
- 28px radius is reserved for true "card" surfaces; bars and menus stay on the standard scale
- Rubik at 300–600, with headline weight 900 riding on browser-synthesized bold by design (Transfer's own convention, reused deliberately)

## Colors

The palette is almost entirely achromatic — a five-step near-black ramp — with exactly one saturated color carrying every interactive and brand signal. This is a Restrained strategy: neutrals plus one accent, never diluted by a second hue.

### Primary
- **Ember Signal** (#ff7a00): the one brand color. Every primary button, active nav state, focus ring, link, and accent-muted chip resolves through this single value via `--accent`/`--accent-hover`/`--accent-muted`. Hover shade (`rgb(255 143 41)`) is a luminance-based lighten, computed the same way whether the color comes from this stylesheet default or an admin's own configured instance branding.

### Neutral
- **Screening Black** (#050505): the page ground. Everything else sits on top of this.
- **Panel** (#141414): the first step up — flat (non-glass) surfaces like the settings sidebar and non-floating containers.
- **Panel Raised** (#1f1f1f) / **Panel Elevated** (#2e2e2e): further steps for nested or nominally-elevated flat surfaces (borders, dividers, disabled fills).
- **Soft White** (#c1c2c5): primary text.
- **Soft White — Dim** (#a6a7ab): secondary text.
- **Soft White — Muted** (#909296): tertiary text and placeholders. Chosen specifically to clear 4.5:1 contrast against Panel (#141414) — an earlier, darker candidate (#5c5f66) measured ~2.9:1 and was rejected during the finish review, not shipped.

### Named Rules
**The One Signal Rule.** Ember Signal is the only saturated color anywhere in the interface. Status colors (success/warning/error/info) exist but are used exclusively for their literal semantic meaning — never as a second decorative accent.

**The Text-Inverse Rule.** Text on an Ember Signal surface is near-black (#1a1005), never white. White-on-orange measures roughly 2.5:1; near-black-on-orange measures roughly 8:1. Contrast wins over the reflex to put light text on a colored button.

## Typography

**Display / Body / Label Font:** Rubik (weights 300–400–500–600, self-hosted via next/font/google)
**Mono Font:** JetBrains Mono / Fira Code (code and tabular data only — never a costume for "technical" elsewhere)

**Character:** A geometric, slightly rounded grotesque — confident but not loud. Weight 900 is never a real font file; it's the browser's synthetic bold, used deliberately for the very largest headline moments, reproducing Transfer's own convention rather than sourcing a heavier Rubik cut.

### Hierarchy
- **Headline** (600, text-xl–2xl): screen titles, the auth card's "Welcome to Review."
- **Title** (600, text-lg): section headers, dialog titles.
- **Body** (400, text-sm): the default UI voice.
- **Label** (500, text-sm–xs): form labels, nav items, buttons.
- **Micro** (400, text-2xs): timestamps, badges, the footer tagline.

### Named Rules
**The No-Serif Rule.** Rubik is the only typeface anywhere in the product UI outside of code/data contexts. No system-font fallback ever stands in as the display voice — the self-hosted webfont is the only acceptable rendition.

## Layout

Single persistent left rail (52px collapsed / 220px expanded, animated width transition) plus a sticky 44px top bar per content area. Auth/setup flows use a centered single-column layout, capped at 440px, on a full-viewport dark ground. No responsive collapse-to-drawer pattern exists yet for the dashboard rail at mobile widths — a known, disclosed gap, not a decision.

## Elevation & Depth

Hybrid, by design: **flat base, floating glass**. The page ground and simple non-floating containers are flat, opaque near-black — no shadow, no blur. Anything that visually floats above the content plane — the sidebar rail, the top bar, dropdown/context menus, modal dialogs, the auth card — is liquid glass: a translucent near-black gradient, a bright hairline border, backdrop blur, and a soft offset shadow. Nothing in between; a surface is either flat-at-rest or fully glass, never a partial blur applied as decoration.

### Shadow Vocabulary
- **Glass shadow** (`box-shadow: 0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)`): every glass surface, no exceptions. The inset highlight is what reads as "glass edge" rather than "dark card with a shadow."

### Named Rules
**The Chrome-Not-Content Rule.** Glass is reserved for app chrome — navigation, floating bars, menus, dialogs, and the auth card. It is never applied to buttons, badges, or arbitrary content containers; doing so would make it decoration instead of a structural signal for "this floats above the page."

## Shapes

Two radius scales, used for different things. The standard scale (4/6/8/12px, named `sm`/`md`/`lg`/`xl`) covers buttons, inputs, dropdown menus, and dialogs. A separate, larger **28px `glass` radius** is reserved exclusively for true cards — right now, only the auth/setup card. Bars (sidebar, top header) carry no radius at all; they're flush with the viewport edge.

### Named Rules
**The Card-Only 28px Rule.** 28px radius means "this is a card," full stop. A menu or dialog that also happened to round its corners to 28px would read as a card and confuse the hierarchy Shapes is supposed to communicate.

## Components

### Buttons
- **Shape:** 6px radius (`md`), 8px (`sm`) for compact contexts — never glass, never blurred.
- **Primary:** Ember Signal fill, near-black text (#1a1005), soft accent-tinted shadow (`shadow-accent/20`).
- **Hover / Focus:** background shifts to the lightened hover shade; focus-visible gets a 2px accent ring at 50% opacity with a 1px offset.
- **Secondary / Ghost / Destructive:** flat panel fill with a border / transparent with hover fill / status-error fill — none of them glass.

### Cards / Containers
- **Corner Style:** 28px (`glass`), reserved for true cards only.
- **Background:** the glass gradient (`linear-gradient(160deg, rgba(10,10,10,.5) 0%, rgba(10,10,10,.6) 55%, rgba(10,10,10,.54) 100%)`).
- **Shadow Strategy:** the Glass shadow, see Elevation & Depth.
- **Border:** 1px, `rgba(255,255,255,0.22)`.
- **Internal Padding:** 32px (`lg`) on the auth card.

### Inputs / Fields
- **Style:** flat panel background, 1px standard border, 6px radius — deliberately not glass; legibility for the thing being typed into outranks the ambient chrome effect.
- **Focus:** border shifts to Ember Signal, plus a 20%-opacity accent ring.
- **Error:** border and ring shift to status-error.

### Navigation
- **Sidebar:** glass bar, 18px blur, flush right border (no radius). Active item gets a flat hover-tint fill (`rgba(255,255,255,0.08)`), never its own glass treatment — nested glass-on-glass was deliberately avoided.
- **Top bar:** same glass-bar treatment, 18px blur, flush bottom border.
- **Dropdown / context menus:** glass panel, 22px blur, standard `lg` (8px) radius — matching Transfer's own menu convention of the standard radius rather than the 28px card radius.

### Dialogs
- Overlay: `rgba(0,0,0,0.6)` with a light blur — a dim scrim, not glass itself.
- Content: glass panel, 22px blur, `xl` (12px) radius.

### Glint Ring (signature component)
A specular highlight that sweeps the auth card's rounded outline once every 6.5s — a rotating conic-gradient (transparent → white → Ember Signal → transparent) masked down to a thin ring via `mask: xor`, driven by a typed `@property --glint-angle` so it interpolates smoothly instead of snapping. Reused verbatim from Transfer's own GlintBorder — the one moment of motion that makes the glass read as a physical material rather than a static translucent panel. Card only; never on bars, menus, or dialogs.

### Brand Panel (signature component)
The auth/setup screen's full-bleed rotating photo backdrop — real production stills synced from majid.film (see PRODUCT.md's Evidence on Hand), never a stock or fabricated image. A fair-rotation shuffle guarantees no two consecutive slides share a project; each slide holds a slow 1→1.07 zoom (`gentleZoom`, ~9.1s) and crosses to the next via a 900ms slide transform. Renders nothing — not a placeholder image — until sync is configured and has found real photography; the radial accent glow underneath is the only fallback backdrop.

## Do's and Don'ts

### Do:
- **Do** keep Ember Signal (#ff7a00) as the only saturated color anywhere in the product.
- **Do** reserve the 28px `glass` radius for actual cards; use the standard scale for bars, menus, and dialogs.
- **Do** keep buttons, inputs, and switches flat and crisp — glass is for chrome that floats, not for controls someone is actively operating.
- **Do** use near-black (#1a1005), not white, as text on any Ember Signal-filled surface.
- **Do** treat dark as the only mode inside the app; a share link may still offer its own light/dark choice for external viewers, independent of this system.

### Don't:
- **Don't** show freeframe's own logo mark as Review's default identity — an unconfigured instance shows the org name alone (plus a minimal accent-dot placeholder) rather than someone else's brand.
- **Don't** apply the glass recipe to a button, chip, or badge — that's decoration, not the structural "this floats" signal it's meant to be.
- **Don't** add a second saturated color anywhere without revisiting the One Signal Rule first.
- **Don't** reintroduce a user-facing light/dark toggle inside the app's own chrome without a deliberate product decision to reverse the dark-only call.
