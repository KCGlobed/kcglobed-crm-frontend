import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // BACKEND_URL comes from .env (no VITE_ prefix: only the dev server needs it, not the browser bundle).
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        // Same-origin API in dev: avoids CORS and lets the refresh cookie flow.
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
