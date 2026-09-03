'use client'

import * as React from 'react'
import useSWR, { mutate } from 'swr'
import { useTranslations } from 'next-intl'
import { api, ApiError } from '@/lib/api'
import { translateApiError } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { ConfigField } from './config-field'
import type { ConfigField as ConfigFieldType } from '@/types'

type EditedValue = string | number | boolean | null

export function InstanceConfigTab() {
  const t = useTranslations('settings.instanceConfigTab')
  const tErrors = useTranslations('errors')
  const { data } = useSWR<ConfigFieldType[]>('/instance/config', () => api.get<ConfigFieldType[]>('/instance/config'))

  const [edited, setEdited] = React.useState<Record<string, EditedValue>>({})
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleChange = (key: string, value: EditedValue) => {
    setEdited((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  // Boolean/enum/number controls have no "blank" state of their own, so
  // resetting to the env default (once a field has been touched, or was
  // already overridden from a previous save) needs an explicit action —
  // queues `null`, which the backend's blank-clears-override convention
  // (config_service.py's _validate_and_serialize) treats as "delete the row".
  const handleReset = (key: string) => handleChange(key, null)

  const dirtyCount = Object.keys(edited).length

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const items = Object.entries(edited).map(([key, value]) => ({ key, value }))
      await api.patch('/instance/config', { items })
      await mutate('/instance/config')
      setEdited({})
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? translateApiError(err, tErrors) : t('failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  // Grouped in the order the backend's own catalog returns them (one static
  // list, apps/api/core/config_catalog.py's CATEGORIES) — not duplicated
  // into a second hardcoded list here.
  const categories = React.useMemo(() => {
    const order: string[] = []
    const byCategory = new Map<string, ConfigFieldType[]>()
    for (const f of data ?? []) {
      if (!byCategory.has(f.category)) {
        order.push(f.category)
        byCategory.set(f.category, [])
      }
      byCategory.get(f.category)!.push(f)
    }
    return order.map((category) => ({ category, fields: byCategory.get(category)! }))
  }, [data])

  return (
    <div className="max-w-2xl space-y-8 pb-20">
      {categories.map(({ category, fields }) => (
        <section key={category} className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">
            {t(`categories.${category}.title`)}
          </h2>
          <div className="space-y-4 rounded-lg border border-border bg-bg-secondary p-4">
            {fields.map((f) => {
              const isEdited = f.key in edited
              const isOverridden = isEdited ? edited[f.key] !== null : f.is_overridden
              const hint = t(`categories.${category}.fields.${f.name}.hint`)
              const fieldId = `config-${f.key}`
              return (
                <div key={f.key} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={fieldId} className="text-sm font-medium text-text-secondary">
                        {t(`categories.${category}.fields.${f.name}.label`)}
                      </label>
                      {isOverridden && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                          title={t('overriddenTitle')}
                        />
                      )}
                    </div>
                    {hint && <p className="mt-0.5 text-xs text-text-tertiary">{hint}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ConfigField
                      id={fieldId}
                      field={f}
                      value={isEdited ? edited[f.key] : f.value}
                      onChange={(v) => handleChange(f.key, v)}
                      choiceLabel={(c) => t(`categories.${category}.fields.${f.name}.choices.${c}`)}
                    />
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => handleReset(f.key)}
                        className="text-xs text-text-tertiary underline decoration-dotted hover:text-text-secondary"
                      >
                        {t('reset')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {error && <p className="text-xs text-status-error">{error}</p>}
      {saved && <p className="text-xs text-status-success">{t('saved')}</p>}

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 bg-bg-primary/80 px-1 py-3 backdrop-blur-sm">
        <Button size="sm" onClick={handleSave} loading={saving} disabled={dirtyCount === 0}>
          {t('saveChanges')}
        </Button>
        {dirtyCount > 0 && (
          <span className="text-xs text-text-tertiary">{t('unsavedCount', { count: dirtyCount })}</span>
        )}
      </div>
    </div>
  )
}
