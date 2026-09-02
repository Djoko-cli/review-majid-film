import { getAccessToken, refreshAccessToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  detail: string
  /** Present once a router migrates to AppHTTPException (apps/api/core/errors.py)
   *  — a stable machine-readable identifier for translateApiError (lib/api-error.ts)
   *  to look up in the errors.json message catalog. null for anything not yet
   *  migrated (still a plain-string detail, or a FastAPI validation array),
   *  which translateApiError falls back to showing `detail` verbatim for. */
  code: string | null
  /** Interpolation values for the looked-up message template, e.g.
   *  {mime_type: "..."} for an "unsupported_file_type" code. */
  params: Record<string, unknown>

  constructor(status: number, detail: string, code: string | null = null, params: Record<string, unknown> = {}) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.code = code
    this.params = params
  }
}

/** Parses a FastAPI error response body's `detail` into the plain-string
 *  `detail` (always) plus `code`/`params` (only once the raising router has
 *  migrated to AppHTTPException) that ApiError's constructor wants — shared
 *  between request() and uploadRequest() below so the two shapes (plain
 *  string, FastAPI validation array, or {code, message, params}) are only
 *  ever parsed in one place. */
function parseErrorDetail(errorBody: unknown, fallback: string): { detail: string; code: string | null; params: Record<string, unknown> } {
  const raw = (errorBody as { detail?: unknown } | undefined)?.detail
  if (raw === undefined || raw === null) return { detail: fallback, code: null, params: {} }
  if (typeof raw === 'string') return { detail: raw, code: null, params: {} }
  if (Array.isArray(raw)) {
    // FastAPI validation errors: [{loc: [...], msg: "...", type: "..."}]
    const detail = raw.map((e: { msg?: string }) => e.msg || 'Validation error').join('; ')
    return { detail, code: null, params: {} }
  }
  if (typeof raw === 'object' && 'code' in raw && 'message' in raw) {
    const shaped = raw as { code: string; message: string; params?: Record<string, unknown> }
    return { detail: shaped.message, code: shaped.code, params: shaped.params ?? {} }
  }
  return { detail: JSON.stringify(raw), code: null, params: {} }
}

interface RequestOptions {
  headers?: Record<string, string>
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  const execute = async (token: string | null): Promise<Response> => {
    return fetch(`${API_URL}${path}`, {
      method,
      headers: buildHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let token = getAccessToken()
  let response = await execute(token)

  // On 401, attempt a token refresh and retry once
  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      response = await execute(newToken)
    }
  }

  if (!response.ok) {
    let parsed = { detail: response.statusText, code: null as string | null, params: {} }
    try {
      parsed = parseErrorDetail(await response.json(), response.statusText)
    } catch {
      // ignore parse errors; use statusText as fallback
    }
    throw new ApiError(response.status, parsed.detail, parsed.code, parsed.params)
  }

  // Handle empty responses (e.g. 204 No Content, or empty body)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T
  }

  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    return undefined as unknown as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as unknown as T
  }

  return JSON.parse(text) as T
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  const execute = async (token: string | null): Promise<Response> => {
    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: formData,
    })
  }

  let token = getAccessToken()
  let response = await execute(token)

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) response = await execute(newToken)
  }

  if (!response.ok) {
    let parsed = { detail: response.statusText, code: null as string | null, params: {} }
    try {
      parsed = parseErrorDetail(await response.json(), response.statusText)
    } catch {}
    throw new ApiError(response.status, parsed.detail, parsed.code, parsed.params)
  }

  if (response.status === 204) return undefined as unknown as T
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T)
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),

  upload: <T>(path: string, formData: FormData) =>
    uploadRequest<T>(path, formData),
}

export type { ApiError as ApiErrorType }
