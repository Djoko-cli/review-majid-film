'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { Keyboard, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShortcutItem {
  keys: string[]
  id: string
}

interface ShortcutGroup {
  id: string
  items: ShortcutItem[]
}

// ─── Shortcut definitions ─────────────────────────────────────────────────────
// `id`s key into the layout.keyboardShortcuts.groups.<id>.{title,items.<id>}
// translation catalog — the group/item text itself is looked up at render time.

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'navigation',
    items: [
      { keys: ['⌘', 'K'], id: 'commandPalette' },
      { keys: ['?'], id: 'showShortcuts' },
      { keys: ['⌘', '/'], id: 'toggleSidebar' },
    ],
  },
  {
    id: 'review',
    items: [
      { keys: ['Space'], id: 'playPause' },
      { keys: ['←'], id: 'seekBack' },
      { keys: ['→'], id: 'seekForward' },
      { keys: ['J'], id: 'jumpBack' },
      { keys: ['K'], id: 'playPauseAlt' },
      { keys: ['L'], id: 'jumpForward' },
      { keys: ['M'], id: 'muteToggle' },
      { keys: ['F'], id: 'fullscreenToggle' },
    ],
  },
  {
    id: 'actions',
    items: [
      { keys: ['N', 'P'], id: 'newProject' },
      { keys: ['N', 'A'], id: 'uploadAsset' },
      { keys: ['G', 'H'], id: 'goHome' },
      { keys: ['G', 'P'], id: 'goProjects' },
      { keys: ['G', 'A'], id: 'goAssets' },
    ],
  },
  {
    id: 'comments',
    items: [
      { keys: ['C'], id: 'focusCommentInput' },
      { keys: ['Esc'], id: 'cancelComment' },
    ],
  },
]

// ─── Key badge component ──────────────────────────────────────────────────────

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-bg-hover px-1.5 py-0.5 font-mono text-xs text-text-secondary">
      {children}
    </kbd>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface KeyboardShortcutsProps {
  /** Controlled open state — pass from parent if needed */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** When true the component manages its own open state via `?` keypress */
  standalone?: boolean
}

export function KeyboardShortcuts({
  open: controlledOpen,
  onOpenChange,
  standalone = false,
}: KeyboardShortcutsProps) {
  const t = useTranslations('layout.keyboardShortcuts')
  const [internalOpen, setInternalOpen] = React.useState(false)

  const isOpen = standalone ? internalOpen : (controlledOpen ?? false)
  const setOpen = standalone
    ? setInternalOpen
    : (onOpenChange ?? (() => {}))

  // Register `?` key only when in standalone mode
  React.useEffect(() => {
    if (!standalone) return

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (isEditable) return

      if (e.key === '?') {
        e.preventDefault()
        setInternalOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [standalone])

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'glass-panel fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2',
            'rounded-xl',
            'data-[state=open]:animate-slide-down',
            'max-h-[80vh] flex flex-col',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-text-tertiary" />
              <Dialog.Title className="text-base font-semibold text-text-primary">
                {t('title')}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary">
                <X className="h-4 w-4" />
                <span className="sr-only">{t('close')}</span>
              </button>
            </Dialog.Close>
          </div>

          {/* Shortcut groups */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.id} className="space-y-3">
                  <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                    {t(`groups.${group.id}.title`)}
                  </h3>
                  <div className="space-y-2">
                    {group.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-text-secondary">
                          {t(`groups.${group.id}.items.${item.id}`)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {item.keys.map((key, ki) => (
                            <KeyBadge key={ki}>{key}</KeyBadge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer hint */}
          <div className="border-t border-border px-6 py-3">
            <p className="text-2xs text-text-tertiary">
              {t('footerHintBefore')}{' '}
              <kbd className="rounded border border-border px-1 py-0.5 font-mono text-2xs">
                ?
              </kbd>{' '}
              {t('footerHintAfter')}
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
