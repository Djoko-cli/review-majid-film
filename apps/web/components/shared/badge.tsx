import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { AssetStatus } from '@/types'

interface BadgeProps {
  status: AssetStatus
  className?: string
}

const statusConfig: Record<AssetStatus, { dot: string; bg: string; text: string }> = {
  draft: {
    dot: 'bg-text-tertiary',
    bg: 'bg-bg-tertiary',
    text: 'text-text-secondary',
  },
  in_review: {
    dot: 'bg-status-warning',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  approved: {
    dot: 'bg-status-success',
    bg: 'bg-status-success/10',
    text: 'text-status-success',
  },
  rejected: {
    dot: 'bg-status-error',
    bg: 'bg-status-error/10',
    text: 'text-status-error',
  },
  archived: {
    dot: 'bg-text-tertiary',
    bg: 'bg-bg-secondary',
    text: 'text-text-tertiary',
  },
}

export function Badge({ status, className }: BadgeProps) {
  const t = useTranslations('shared.badge')
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium',
        config.bg,
        config.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {t(status)}
    </span>
  )
}
