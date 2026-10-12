const ACCESS_KEY = 'procurement.access'
const REFRESH_KEY = 'procurement.refresh'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(describeError(data) || `Request failed (HTTP ${status})`)
    this.status = status
    this.data = data
  }
}

/** Turns DRF error bodies ({detail}, {field: [msgs]}, ...) into one readable sentence. */
export function describeError(data: unknown): string {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(describeError).filter(Boolean).join(' ')
  if (typeof data === 'object') {
    const record = data as Record<string, unknown>
    if ('detail' in record) return describeError(record.detail)
    return Object.entries(record)
      .map(([field, value]) => {
        const text = describeError(value)
        return field === 'non_field_errors' ? text : `${field}: ${text}`
      })
      .join(' ')
  }
  return String(data)
}

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

/** Called when the session can't be refreshed; the auth provider uses it to log out. */
let onSessionExpired: () => void = () => {}
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

let refreshing: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  // Several requests may fail at once; they all wait for the same refresh call.
  refreshing ??= fetch('/api/auth/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (resp) => {
      if (!resp.ok) return false
      const data = (await resp.json()) as { access: string; refresh?: string }
      tokens.save(data.access, data.refresh)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function parseBody(resp: Response): Promise<unknown> {
  if (resp.status === 204) return null
  const text = await resp.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`)

  const resp = await fetch(`/api${path}`, { ...options, headers })

  if (resp.status === 401 && retry && tokens.refresh) {
    if (await refreshAccessToken()) return api<T>(path, options, false)
    tokens.clear()
    onSessionExpired()
  }

  const data = await parseBody(resp)
  if (!resp.ok) throw new ApiError(resp.status, data)
  return data as T
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
