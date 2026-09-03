import { useTranslations } from 'next-intl'
import { cn, formatBytes, formatBytesShort, storageMeterState } from '@/lib/utils'

const FILL: Record<'ok' | 'warn' | 'critical', string> = {
  ok: 'bg-accent',
  warn: 'bg-amber-400',
  critical: 'bg-status-error',
}

const RING_TEXT: Record<'ok' | 'warn' | 'critical', string> = {
  ok: 'text-accent',
  warn: 'text-amber-400',
  critical: 'text-status-error',
}

function usageTitle(used: number, limit: number, unlimited: boolean, t: (key: string, values?: Record<string, string>) => string): string {
  return unlimited
    ? t('titleUnlimited', { used: formatBytes(used) })
    : t('titleLimited', { used: formatBytes(used), limit: formatBytes(limit) })
}

/** Full "used / limit" row + meter bar — for expanded surfaces (sidebar / admin panel). */
export function StorageUsage({
  used,
  limit,
  variant = 'panel',
}: {
  used: number
  limit: number
  variant?: 'sidebar' | 'panel'
}) {
  const t = useTranslations('shared.storageUsage')
  const { unlimited, pct, level } = storageMeterState(used, limit)
  const labelCls = variant === 'sidebar' ? 'text-[11px]' : 'text-sm'
  const valueCls = variant === 'sidebar' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={cn(labelCls, 'font-medium text-text-secondary')}>
          {unlimited ? t('usedLabel') : t('label')}
        </span>
        <span className={cn(valueCls, 'tabular-nums text-text-tertiary')}>
          {unlimited ? formatBytes(used) : `${formatBytes(used)} / ${formatBytes(limit)}`}
        </span>
      </div>
      {!unlimited && (
        <div
          data-testid="storage-meter"
          className="h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden"
        >
          <div
            className={cn('h-full rounded-full transition-all duration-300', FILL[level])}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/** Compact circular gauge — for the collapsed sidebar rail. Ring colored by usage level
 *  when a cap is set; a plain muted track (no fill — there is no denominator to plot)
 *  with the actual amount used centered inside when unlimited, so this never reduces
 *  to a static icon that conveys nothing at a glance. Hover title shows the full
 *  used/limit figure either way. */
export function StorageRing({ used, limit }: { used: number; limit: number }) {
  const t = useTranslations('shared.storageUsage')
  const { unlimited, pct, level } = storageMeterState(used, limit)
  const title = usageTitle(used, limit, unlimited, t)

  const r = 12
  const c = 2 * Math.PI * r
  return (
    <div
      title={title}
      className={cn('relative flex items-center justify-center', unlimited ? 'text-text-tertiary' : RING_TEXT[level])}
      data-testid={unlimited ? 'storage-ring-unlimited' : 'storage-ring'}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" strokeWidth="2.5" className="stroke-bg-tertiary" />
        {!unlimited && (
          <circle
            cx="16"
            cy="16"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(pct, 0) / 100)}
            className="transition-all duration-300"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold tabular-nums text-text-secondary">
        {unlimited ? formatBytesShort(used) : Math.round(pct)}
      </span>
    </div>
  )
}
