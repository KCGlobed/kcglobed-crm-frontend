// TEMPORARY — test-only Vite config that forces the dev proxy at the local backend
// without touching src/constants/config.ts. Safe to delete.
import { mergeConfig } from 'vite'
import base from './vite.config.ts'

export default mergeConfig(base, {
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
