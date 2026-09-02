'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/** Wraps the auth card's content in a JS-measured, explicitly-animated
 *  height. CSS can't transition to/from `height: auto` on its own, and the
 *  card's content genuinely changes height whenever it changes — most
 *  visibly across a language switch (French copy runs longer than
 *  English), but also between the login form's own steps
 *  (classic/password/code/magic-code). ResizeObserver picks up either
 *  case the same way, so both get the same smooth resize for free. */
export function AnimatedHeightCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number>()

  React.useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      setHeight(el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={cn('overflow-hidden transition-[height] duration-300 ease-spring', className)}
      style={{ height }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}
