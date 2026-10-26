import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { backendUrlFor } from './src/constants/config.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Same-origin API in dev: avoids CORS and lets the refresh cookie flow.
      // The backend follows the mode (src/constants/config.ts):
      // `npm run dev` -> staging, `npm run dev:local` -> http://localhost:4000.
      '/api': {
        target: backendUrlFor(mode, loadEnv(mode, process.cwd(), 'VITE_').VITE_BACKEND_URL),
        changeOrigin: true,
      },
    },
  },
}))
