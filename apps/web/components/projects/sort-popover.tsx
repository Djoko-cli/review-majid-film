'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ArrowUpDown, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useViewStore, type SortKey } from '@/stores/view-store'

const SORT_KEYS: SortKey[] = ['custom', 'date', 'name', 'status', 'type']

export function SortPopover() {
  const t = useTranslations('shared.sortPopover')
  const { sortKey, setSortKey, sortDirection, toggleSortDirection } = useViewStore()
  const activeLabel = t(`options.${SORT_KEYS.find((k) => k === sortKey) ?? 'custom'}`)

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors">
          <ArrowUpDown className="h-4 w-4" />
          <span>{t('sortedBy')}</span>
          <span className="text-text-primary font-medium">{activeLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="glass-panel z-50 w-48 rounded-lg py-1.5
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {SORT_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => {
                if (sortKey === key) {
                  toggleSortDirection()
                } else {
                  setSortKey(key)
                }
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                sortKey === key
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5',
              )}
            >
              <span className="w-4 shrink-0">
                {sortKey === key && <Check className="h-3.5 w-3.5" />}
              </span>
              {t(`options.${key}`)}
              {sortKey === key && (
                <span className="ml-auto text-xs text-text-tertiary">
                  {sortDirection === 'asc' ? t('ascending') : t('descending')}
                </span>
              )}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
