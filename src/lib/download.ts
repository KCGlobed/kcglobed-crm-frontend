import { useEffect, useState } from 'react'
import { store } from '../app/store'
import { API_BASE_URL } from '../constants/config'
import { setCredentials } from '../features/auth/authSlice'
import { mutex } from '../services/api'
import type { User } from '../types/models'
import { downloadBlob } from './utils'

const urlOf = (path: string) => (path.startsWith('/api/') ? path.replace(/^\/api\/v1/, API_BASE_URL) : `${API_BASE_URL}${path}`)

/** One token refresh, under the same lock as the API's base query (a second refresh would end the session). */
async function refreshToken(): Promise<void> {
  if (mutex.isLocked()) return mutex.waitForUnlock()
  const release = await mutex.acquire()
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    const data = (await res.json().catch(() => null))?.data as { user: User; access_token: string } | undefined
    if (res.ok && data?.access_token) store.dispatch(setCredentials({ user: data.user, accessToken: data.access_token }))
  } finally {
    release()
  }
}

/**
 * GET a protected file with the in-memory access token; on a 401 the token is refreshed once and the request
 * retried, like every other API call. `path` is relative to the API base (`/leads/…`) or a full `/api/v1/…` path.
 */
export async function fetchProtected(path: string): Promise<Response> {
  const attempt = () => {
    const token = store.getState().auth.accessToken
    return fetch(urlOf(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
  }
  await mutex.waitForUnlock()
  let res = await attempt()
  if (res.status === 401) {
    await refreshToken()
    res = await attempt()
  }
  return res
}

/** Downloads a protected file (export, error file, document) under its server-given name. */
export async function authorizedDownload(path: string, filename: string): Promise<void> {
  const res = await fetchProtected(path)
  if (!res.ok) throw { data: await res.json().catch(() => ({ message: `Download failed (${res.status})` })) }
  const disposition = res.headers.get('content-disposition') ?? ''
  const named = /filename="?([^";]+)"?/.exec(disposition)?.[1]
  downloadBlob(await res.blob(), named || filename)
}

/**
 * A protected file as an object URL for <img>, <iframe> or <audio> (previews), loaded while `path` is set and
 * released when it changes or the component goes away.
 */
export function useAuthorizedObjectUrl(path: string | null) {
  const [state, setState] = useState<{ path: string | null; url?: string; contentType?: string; error?: string }>({ path: null })

  useEffect(() => {
    if (!path) return
    let live = true
    let objectUrl: string | undefined
    fetchProtected(path)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load the file (${res.status})`)
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (live) setState({ path, url: objectUrl, contentType: blob.type })
        else URL.revokeObjectURL(objectUrl)
      })
      .catch((err: Error) => live && setState({ path, error: err.message }))
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  const current = state.path === path ? state : { path, url: undefined, contentType: undefined, error: undefined }
  return { url: current.url, contentType: current.contentType, error: current.error, loading: !!path && !current.url && !current.error }
}
