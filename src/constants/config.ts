/**
 * Backend URLs — one row per environment. Nothing in this file is edited to switch
 * environments: the Vite *mode* picks the row, and the deploy workflow passes the
 * mode for the branch it builds (.github/workflows/deploy.yml):
 *
 *   branch main -> `vite build --mode production` -> PRODUCTION backend
 *   branch dev  -> `vite build --mode staging`    -> STAGING backend
 *   npm run dev        (mode "development")       -> STAGING, through the Vite proxy
 *   npm run dev:local  (mode "localhost")         -> http://localhost:4000, through the proxy
 *
 * To point any mode somewhere else for one run, set VITE_BACKEND_URL in the shell or
 * in a git-ignored .env.local, e.g. `VITE_BACKEND_URL=http://192.168.1.5:4000 npm run dev`.
 */
export const BACKEND_URLS = {
  production: 'https://crm-backend.gccschool.com',
  staging: 'https://crm-stage-backend.gccschool.com',
  localhost: 'http://localhost:4000',
} as const

/**
 * Backend origin for a Vite mode (`vite --mode …` / import.meta.env.MODE), without a
 * trailing slash. Unknown modes fall back to staging for the dev server and to
 * production for a build. `override` wins when set (VITE_BACKEND_URL).
 */
export function backendUrlFor(mode: string | undefined, override?: string): string {
  const url =
    override?.trim() ||
    BACKEND_URLS[mode as keyof typeof BACKEND_URLS] ||
    (mode === 'development' ? BACKEND_URLS.staging : BACKEND_URLS.production)
  return url.replace(/\/+$/, '')
}

// `import.meta.env` is undefined when vite.config.ts imports this file under Node; the
// Vite config calls backendUrlFor(mode) itself for the dev proxy.
const env = import.meta.env ?? ({} as Partial<ImportMetaEnv>)

/** Backend origin in use, without a trailing slash. */
export const BACKEND_URL = backendUrlFor(env.MODE, env.VITE_BACKEND_URL)

/**
 * API base. The dev server calls same-origin `/api/v1` and the Vite proxy forwards it to
 * BACKEND_URL, so the refresh cookie stays same-site; a build calls BACKEND_URL directly.
 */
export const API_BASE_URL = env.DEV ? '/api/v1' : `${BACKEND_URL}/api/v1`
