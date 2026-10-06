/** API base — same-origin `/api/v1` by default (Vite proxies it in dev). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
