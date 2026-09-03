import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ConfigField as ConfigFieldType } from '@/types'

const h = vi.hoisted(() => {
  const DEFAULT: ConfigFieldType[] = [
    { category: 'auth', name: 'magic_link_enabled', key: 'auth.magic_link_enabled', type: 'boolean', value: true, is_overridden: false, obscured: false, locked: false, choices: null },
    { category: 'oidc', name: 'client_secret', key: 'oidc.client_secret', type: 'string', value: '', is_overridden: false, obscured: true, locked: false, choices: null },
    { category: 'email', name: 'provider', key: 'email.provider', type: 'enum', value: 'ses', is_overridden: false, obscured: false, locked: false, choices: ['ses', 'smtp'] },
    { category: 'uploads_retention', name: 'max_upload_bytes', key: 'uploads_retention.max_upload_bytes', type: 'filesize', value: 0, is_overridden: false, obscured: false, locked: false, choices: null },
  ]
  // Controllable, STABLE `data` reference (mirrors real SWR's cache — a fresh array each
  // render would re-fire effects and clobber in-progress edits, same reasoning as the
  // instance-settings-tab test this mirrors).
  return { DEFAULT, data: DEFAULT as ConfigFieldType[] | undefined }
})
vi.mock('swr', () => ({
  default: () => ({ data: h.data, isLoading: false }),
  mutate: vi.fn(),
}))
const patch = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: (...a: unknown[]) => patch(...a) },
  ApiError: class ApiError extends Error {},
}))

import { InstanceConfigTab } from '../instance-config-tab'

describe('InstanceConfigTab', () => {
  beforeEach(() => {
    patch.mockClear()
    h.data = h.DEFAULT
  })

  it('Save is disabled until a field is edited', () => {
    render(<InstanceConfigTab />)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('sends only the edited keys on save (batched, not the whole catalog)', async () => {
    render(<InstanceConfigTab />)
    fireEvent.click(screen.getByLabelText(/magic-code login/i))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/instance/config', {
        items: [{ key: 'auth.magic_link_enabled', value: false }],
      }),
    )
  })

  it('converts a filesize field between GB in the UI and bytes on the wire', async () => {
    render(<InstanceConfigTab />)
    fireEvent.change(screen.getByLabelText(/max file size/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/instance/config', {
        items: [{ key: 'uploads_retention.max_upload_bytes', value: 5 * 1024 ** 3 }],
      }),
    )
  })

  it('queues null (clear override) when Reset is clicked on an overridden field', async () => {
    h.data = [{ ...h.DEFAULT[0], is_overridden: true, value: false }, ...h.DEFAULT.slice(1)]
    render(<InstanceConfigTab />)
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/instance/config', {
        items: [{ key: 'auth.magic_link_enabled', value: null }],
      }),
    )
  })
})
