'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { api } from '@/lib/api'

const SLIDE_DURATION_MS = 10000
const TRANSITION_MS = 900
const LIVING_DURATION_MS = SLIDE_DURATION_MS - TRANSITION_MS

interface BrandStill {
  still: number
  avif_url: string
  webp_url: string
}
interface BrandProject {
  slug: string
  title: string
  year: string
  stills: BrandStill[]
}
interface DisabledSlide {
  slug: string
  still: number
}

type Slide = { slug: string; title: string; year: string; still: BrandStill }

/** Fisher-Yates — client-side only (called from the mount effect below) so
 *  the server and the first client render agree; Math.random() at render
 *  time would desync them into a hydration mismatch. */
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Random order with two guarantees a plain shuffle() doesn't give: no two
 * slides from the same project back to back, and every project gets an
 * early turn rather than just whichever has the most stills. Ported
 * verbatim from Transfer's BrandPanel.tsx (shuffleFairRotation) — ranking
 * each project by its OWN remaining fraction (not a raw count) is what
 * makes both guarantees hold at once; see that file's own comment for the
 * two simpler approaches this replaced and exactly how each one broke.
 */
function shuffleFairRotation(slides: Slide[]): Slide[] {
  if (slides.length < 3) return shuffle(slides)

  const bySlug = new Map<string, Slide[]>()
  for (const slide of slides) {
    const group = bySlug.get(slide.slug)
    if (group) group.push(slide)
    else bySlug.set(slide.slug, [slide])
  }
  const groups: Slide[][] = Array.from(bySlug.values()).map((group) => shuffle(group))
  const originalSize = new Map<Slide[], number>(groups.map((group) => [group, group.length]))

  const result: Slide[] = []
  let lastSlug: string | null = null
  while (result.length < slides.length) {
    let pick: Slide[] | null = null
    let pickFraction = -1
    for (const group of shuffle(groups)) {
      if (group.length === 0 || group[group.length - 1].slug === lastSlug) continue
      const fraction = group.length / (originalSize.get(group) ?? 1)
      if (fraction > pickFraction) {
        pick = group
        pickFraction = fraction
      }
    }
    pick ??= groups.find((group) => group.length > 0) ?? null
    if (!pick) break
    const slide = pick.pop() as Slide
    result.push(slide)
    lastSlug = slide.slug
  }

  // The carousel loops, so the seam between the last slide and the first is
  // a real adjacency too — resolved by searching backward from the end so a
  // fix never disturbs the fair ordering established near the start.
  const n = result.length
  if (n > 1 && result[0].slug === result[n - 1].slug) {
    for (let i = n - 2; i >= 1; i--) {
      ;[result[i], result[n - 1]] = [result[n - 1], result[i]]
      const resolved =
        result[i - 1].slug !== result[i].slug &&
        result[i].slug !== result[i + 1].slug &&
        result[n - 2].slug !== result[n - 1].slug &&
        result[n - 1].slug !== result[0].slug
      if (resolved) break
      ;[result[i], result[n - 1]] = [result[n - 1], result[i]] // undo
    }
  }

  return result
}

/** Shortest signed distance between two indices on a circular track — going
 *  from the last slide to the first is a +1 step, not a jump backward. */
function cyclicDelta(from: number, to: number, length: number): number {
  let delta = to - from
  if (delta > length / 2) delta -= length
  if (delta < -length / 2) delta += length
  return delta
}

function SlideView({
  slide,
  delta,
  isActive,
  prefersReducedMotion,
  isPaused,
}: {
  slide: Slide
  delta: number
  isActive: boolean
  prefersReducedMotion: boolean
  isPaused: boolean
}) {
  // Bumped only when this slide transitions from inactive to active — used
  // purely as a remount key so the zoom wrapper starts every activation from
  // a clean scale(1); see brand-panel's own comment history in Transfer for
  // why this can't just toggle a class instead (removing the animation
  // class mid-flight snaps the scale back with nothing to ease the change).
  const [activation, setActivation] = React.useState(0)
  React.useLayoutEffect(() => {
    if (isActive) setActivation((a) => a + 1)
  }, [isActive])

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        transform: `translateX(${delta * 100}%)`,
        transition: prefersReducedMotion ? 'none' : `transform ${TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      <div
        key={activation}
        className="absolute -inset-[4%]"
        style={
          activation > 0 && !prefersReducedMotion
            ? {
                animation: `gentleZoom ${LIVING_DURATION_MS}ms linear ${TRANSITION_MS}ms forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
              }
            : undefined
        }
      >
        <picture>
          <source type="image/avif" srcSet={slide.still.avif_url} />
          <img
            className="absolute inset-0 h-full w-full object-cover object-center"
            src={slide.still.webp_url}
            alt=""
            loading={isActive || delta === 1 ? 'eager' : 'lazy'}
            decoding="async"
          />
        </picture>
      </div>
    </div>
  )
}

/** The full-bleed rotating photo backdrop behind the auth card — the same
 *  real production photography transfer.majid.film's BrandPanel shows,
 *  synced from majid.film itself (see apps/api/services/brand_sync_service.py).
 *  Renders nothing when sync isn't configured or hasn't found anything yet —
 *  never a placeholder image, matching PRODUCT.md's "don't fabricate
 *  content" principle. */
export function BrandPanel({ showCaption = true }: { showCaption?: boolean }) {
  const [order, setOrder] = React.useState<Slide[]>([])
  const [current, setCurrent] = React.useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const [isPaused, setIsPaused] = React.useState(false)
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    Promise.all([
      api.get<BrandProject[]>('/brand/catalog').catch(() => [] as BrandProject[]),
      api.get<DisabledSlide[]>('/brand/disabled').catch(() => [] as DisabledSlide[]),
    ]).then(([catalog, disabled]) => {
      if (cancelled) return
      const disabledKeys = new Set(disabled.map((d) => `${d.slug}-s${d.still}`))
      const slides: Slide[] = catalog.flatMap((project) =>
        project.stills
          .filter((still) => !disabledKeys.has(`${project.slug}-s${still.still}`))
          .map((still) => ({ slug: project.slug, title: project.title, year: project.year, still })),
      )
      setOrder(shuffleFairRotation(slides))
      setIsReady(true)
    })

    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    return () => {
      cancelled = true
    }
  }, [])

  const remainingMs = React.useRef(SLIDE_DURATION_MS)
  React.useEffect(() => {
    remainingMs.current = SLIDE_DURATION_MS
  }, [current])

  React.useEffect(() => {
    if (order.length <= 1 || prefersReducedMotion || isPaused) return
    const startedAt = Date.now()
    let advanced = false
    const timeout = setTimeout(() => {
      advanced = true
      setCurrent((index) => (index + 1) % order.length)
    }, remainingMs.current)
    return () => {
      clearTimeout(timeout)
      if (!advanced) {
        remainingMs.current = Math.max(0, remainingMs.current - (Date.now() - startedAt))
      }
    }
  }, [order.length, prefersReducedMotion, isPaused, current])

  if (!isReady || order.length === 0) return null

  const activeSlide = order[current]

  return (
    <>
      <div className="absolute inset-0 overflow-hidden bg-bg-primary">
        <div style={{ animation: prefersReducedMotion ? undefined : 'brandPanelFadeIn 500ms ease' }}>
          {order.map((slide, index) => (
            <SlideView
              key={`${slide.slug}-s${slide.still.still}`}
              slide={slide}
              delta={cyclicDelta(current, index, order.length)}
              isActive={index === current}
              prefersReducedMotion={prefersReducedMotion}
              isPaused={isPaused}
            />
          ))}
        </div>
      </div>
      {showCaption && activeSlide && (
        <div className="absolute bottom-4 right-4 z-[3] flex items-center gap-1.5 pointer-events-none">
          {order.length > 1 && (
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? 'Play' : 'Pause'}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.6))]"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          )}
          <span className="text-halo text-sm text-white/80">
            <a
              href={`https://majid.film/projects/${activeSlide.slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto font-semibold text-accent"
            >
              {activeSlide.title}
            </a>
            {' '}{activeSlide.year}
          </span>
        </div>
      )}
    </>
  )
}
