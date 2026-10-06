import { store } from '../app/store'
import { API_BASE_URL } from '../constants/config'
import { downloadBlob } from './utils'

/**
 * Downloads a protected file (export, error file, document) with the
 * in-memory access token. `path` is relative to the API base (`/leads/…`)
 * or a full `/api/v1/…` path from a notification.
 */
export async function authorizedDownload(path: string, filename: string): Promise<void> {
  const token = store.getState().auth.accessToken
  const url = path.startsWith('/api/') ? path.replace(/^\/api\/v1/, API_BASE_URL) : `${API_BASE_URL}${path}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
  if (!res.ok) throw { data: await res.json().catch(() => ({ message: `Download failed (${res.status})` })) }
  const disposition = res.headers.get('content-disposition') ?? ''
  const named = /filename="?([^";]+)"?/.exec(disposition)?.[1]
  downloadBlob(await res.blob(), named || filename)
}
