'use client'

import * as React from 'react'
import { Filter, Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { Collection } from '@/types'

interface CollectionCardProps {
  collection: Collection
  assetCount?: number
  onClick?: () => void
  className?: string
}

export function CollectionCard({
  collection,
  assetCount = 0,
  onClick,
  className,
}: CollectionCardProps) {
  const t = useTranslations('projects.collections.card')

  function summarizeFilterRules(rules: Record<string, unknown> | null): string {
    const count = rules ? Object.keys(rules).length : 0
    return t('filterRules', { count })
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-4 text-left w-full',
        'hover:border-border-focus hover:bg-bg-tertiary transition-colors',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-muted text-text-primary">
          <Filter className="h-4 w-4" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-medium text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
            {collection.name}
          </p>
          {collection.description && (
            <p className="text-xs text-text-secondary line-clamp-2">
              {collection.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <Filter className="h-3 w-3" />
          {summarizeFilterRules(collection.filter_rules)}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {t('assetCount', { count: assetCount })}
        </span>
      </div>
    </button>
  )
}
