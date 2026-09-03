/** One name → one color, everywhere an avatar renders. Previously each of
 *  comment-panel, folder-share-viewer, share-link-activity, and progress-bar
 *  carried its own copy of this hash + its own palette, so the same person
 *  showed up a different color depending on which screen you were on (and
 *  the shared Avatar component didn't hash at all — every user got the same
 *  fixed accent tint). Centralized here instead.
 *
 *  Two accessors because the same palette gets applied two different ways:
 *  `getAvatarColorClass` for a Tailwind `className` (DOM avatars), and
 *  `getAvatarColorHex` for an inline `style.backgroundColor` (progress-bar's
 *  canvas-adjacent timeline markers, which can't take a utility class). The
 *  hex values are the literal Tailwind default-palette 500-shades so both
 *  forms of the same index render identically. */
const AVATAR_PALETTE = [
  { class: 'bg-orange-500', hex: '#f97316' },
  { class: 'bg-blue-500', hex: '#3b82f6' },
  { class: 'bg-emerald-500', hex: '#10b981' },
  { class: 'bg-purple-500', hex: '#a855f7' },
  { class: 'bg-rose-500', hex: '#f43f5e' },
  { class: 'bg-amber-500', hex: '#f59e0b' },
  { class: 'bg-cyan-500', hex: '#06b6d4' },
  { class: 'bg-pink-500', hex: '#ec4899' },
] as const

function paletteIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % AVATAR_PALETTE.length
}

export function getAvatarColorClass(name: string): string {
  return AVATAR_PALETTE[paletteIndex(name)].class
}

export function getAvatarColorHex(name: string): string {
  return AVATAR_PALETTE[paletteIndex(name)].hex
}
