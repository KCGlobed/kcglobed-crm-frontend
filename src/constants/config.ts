/**
 * Backend URLs — the only place to point the app at a backend.
 *
 * Comment out PROD_URL to use BASE_URL, or comment out BASE_URL to use PROD_URL
 * (with both left in, PROD_URL wins). Restart `npm run dev` after a change: the
 * dev proxy reads this file at start-up.
 */
const BACKEND: { PROD_URL?: string; BASE_URL?: string } = {
  PROD_URL: 'https://crm-backend.kcglobed.com',
  // BASE_URL: 'http://192.168.1.5:8002',
}

/** Backend origin in use, without a trailing slash. */
export const BACKEND_URL = (BACKEND.PROD_URL || BACKEND.BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')

/**
 * API base. `npm run dev` calls same-origin `/api/v1` and the Vite proxy forwards it to
 * BACKEND_URL, so the refresh cookie stays same-site; a build calls BACKEND_URL directly.
 * `env?.` because vite.config.ts imports this file too, where import.meta.env is unset.
 */
export const API_BASE_URL = import.meta.env?.DEV ? '/api/v1' : `${BACKEND_URL}/api/v1`
