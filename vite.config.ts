import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { BACKEND_URL } from './src/constants/config.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Same-origin API in dev: avoids CORS and lets the refresh cookie flow.
      // The backend is picked in src/constants/config.ts.
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
})
