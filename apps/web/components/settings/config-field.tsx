'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { bytesToGb, gbToBytes } from '@/lib/utils'
import type { ConfigField as ConfigFieldType } from '@/types'

interface ConfigFieldProps {
  id: string
  field: ConfigFieldType
  value: string | number | boolean | null
  onChange: (value: string | number | boolean | null) => void
  /** Human label for one enum choice token (e.g. "ses" -> "Amazon SES") — only used when field.type === "enum". */
  choiceLabel: (choice: string) => string
}

export function ConfigField({ id, field, value, onChange, choiceLabel }: ConfigFieldProps) {
  if (field.type === 'boolean') {
    return <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
  }

  if (field.type === 'enum') {
    return (
      <div className="relative w-56">
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-md border border-border bg-bg-secondary py-2 pl-3 pr-8 text-sm text-text-primary outline-none transition-colors hover:border-border-focus focus:border-accent focus:ring-2 focus:ring-accent/20"
        >
          {(field.choices ?? []).map((c) => (
            <option key={c} value={c}>{choiceLabel(c)}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
      </div>
    )
  }

  if (field.type === 'filesize') {
    // Stored/sent in bytes, entered in GB — same "0 = unlimited" convention
    // as instance-settings-tab.tsx's storage_limit_bytes field.
    const gb = value === null || value === undefined || Number(value) === 0 ? '' : String(bytesToGb(Number(value)))
    return (
      <Input
        id={id}
        type="number"
        min={0}
        className="w-40"
        value={gb}
        onChange={(e) => onChange(e.target.value.trim() === '' ? 0 : gbToBytes(Number(e.target.value)))}
      />
    )
  }

  if (field.type === 'number') {
    return (
      <Input
        id={id}
        type="number"
        min={0}
        className="w-40"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    )
  }

  return (
    <Input
      id={id}
      type={field.obscured ? 'password' : 'text'}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
