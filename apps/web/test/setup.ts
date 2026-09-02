import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'

// Every existing test asserts on rendered English text (e.g.
// screen.getByText(/sign in/i)) written before i18n existed. Rather than
// touch all of them or wrap every render() call in a provider, stub
// next-intl globally so useTranslations()/useLocale()/useFormatter() resolve
// against the English message catalog without needing NextIntlClientProvider
// in the tree at all. Namespaces not yet translated (empty {} in
// messages/en/*.json — see the i18n rollout plan) fall back to the key
// itself, same as next-intl's own missing-message behavior.
vi.mock('next-intl', async () => {
  const namespaces = [
    'dashboard', 'projects', 'review', 'share', 'layout',
    'auth', 'settings', 'shared', 'ui', 'upload', 'errors',
  ] as const
  const catalogs: Record<string, unknown> = {}
  for (const ns of namespaces) {
    catalogs[ns] = (await import(`../messages/en/${ns}.json`)).default
  }

  function resolveMessage(namespace: string | undefined, key: string): string | undefined {
    const full = namespace ? `${namespace}.${key}` : key
    const parts = full.split('.')
    let node: unknown = catalogs
    for (const part of parts) {
      if (typeof node !== 'object' || node === null) return undefined
      node = (node as Record<string, unknown>)[part]
    }
    return typeof node === 'string' ? node : undefined
  }

  function interpolate(template: string, values: Record<string, unknown> = {}): string {
    return template.replace(/\{(\w+)\}/g, (_match, name) =>
      name in values ? String(values[name]) : `{${name}}`,
    )
  }

  /** Handles at most one level of <tag>...</tag> markup — the only shape
   *  t.rich() is used for in this codebase today. */
  function richInterpolate(template: string, values: Record<string, unknown>): React.ReactNode {
    const tagRegex = /<(\w+)>(.*?)<\/\1>/g
    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let key = 0
    while ((match = tagRegex.exec(template))) {
      if (match.index > lastIndex) nodes.push(interpolate(template.slice(lastIndex, match.index), values))
      const [, tagName, inner] = match
      const renderFn = values[tagName]
      const innerText = interpolate(inner, values)
      nodes.push(
        typeof renderFn === 'function'
          ? React.createElement(React.Fragment, { key: key++ }, renderFn(innerText))
          : innerText,
      )
      lastIndex = tagRegex.lastIndex
    }
    nodes.push(interpolate(template.slice(lastIndex), values))
    return nodes
  }

  function useTranslations(namespace?: string) {
    const t = (key: string, values?: Record<string, unknown>) => {
      const message = resolveMessage(namespace, key)
      return message === undefined ? key : interpolate(message, values)
    }
    t.rich = (key: string, values: Record<string, unknown>) => {
      const message = resolveMessage(namespace, key)
      return message === undefined ? key : richInterpolate(message, values)
    }
    return t
  }

  function useLocale() {
    return 'en'
  }

  function useFormatter() {
    return {
      dateTime: (value: Date | number, _opts?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en').format(value),
      number: (value: number, _opts?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat('en').format(value),
      relativeTime: (_value: Date | number) => new Intl.RelativeTimeFormat('en').format(0, 'second'),
    }
  }

  return {
    useTranslations,
    useLocale,
    useFormatter,
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

type ChangeListener = (event: { matches: boolean; media: string }) => void

interface Registration {
  listeners: Set<ChangeListener>
  lastMatches: boolean
}

let currentWidth = 1024
const registrations = new Map<string, Registration>()

// Evaluates the query types actually used in this repo (min-width / max-width,
// and prefers-color-scheme). prefers-color-scheme is handled explicitly here —
// it has nothing to do with viewport width, and must never fall through to the
// width comparison below (that previously made every color-scheme query answer
// based on the current test's viewport width, e.g. theme-store.ts:19,
// theme-initializer.tsx:28, folder-share-viewer.tsx:1099). Tests that need a
// specific color scheme should stub matchMedia themselves — this property stays
// configurable so `vi.stubGlobal('matchMedia', ...)` can still override it.
function evaluateQuery(query: string): boolean {
  const minWidth = query.match(/\(\s*min-width:\s*(\d+)px\s*\)/)
  if (minWidth) return currentWidth >= parseInt(minWidth[1], 10)

  const maxWidth = query.match(/\(\s*max-width:\s*(\d+)px\s*\)/)
  if (maxWidth) return currentWidth <= parseInt(maxWidth[1], 10)

  if (query.includes('prefers-color-scheme')) return false

  return false
}

function getRegistration(query: string): Registration {
  let reg = registrations.get(query)
  if (!reg) {
    reg = { listeners: new Set(), lastMatches: evaluateQuery(query) }
    registrations.set(query, reg)
  }
  return reg
}

function makeMediaQueryList(query: string) {
  const mql = {
    media: query,
    onchange: null as ChangeListener | null,
    get matches() {
      return evaluateQuery(query)
    },
    addEventListener(_type: string, cb: ChangeListener) {
      getRegistration(query).listeners.add(cb)
    },
    removeEventListener(_type: string, cb: ChangeListener) {
      getRegistration(query).listeners.delete(cb)
    },
    // Legacy MediaQueryList surface — theme-initializer.tsx and any other
    // pre-addEventListener caller would throw without these.
    addListener(cb: ChangeListener) {
      mql.addEventListener('change', cb)
    },
    removeListener(cb: ChangeListener) {
      mql.removeEventListener('change', cb)
    },
    dispatchEvent() {
      return false
    },
  }
  return mql
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => makeMediaQueryList(query),
})

/** Sets the viewport width every matchMedia min-width/max-width query is evaluated
 * against, and fires 'change' on any query whose match state actually flips —
 * mirrors a real MediaQueryList, so components that subscribe via
 * addEventListener/addListener see a live update, not just a new value on the
 * next matchMedia() call. */
export function setViewportWidth(width: number) {
  currentWidth = width
  registrations.forEach((reg, query) => {
    const matches = evaluateQuery(query)
    if (matches !== reg.lastMatches) {
      reg.lastMatches = matches
      const event = { matches, media: query }
      reg.listeners.forEach((cb) => cb(event))
    }
  })
}

setViewportWidth(1024)
