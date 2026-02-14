import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Tüm API istekleri finans-api'ye (3002)
      '/api/crypto': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/bist': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/us': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/news': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/markets': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/yahoo': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/ai': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/auth': { target: 'http://localhost:3002', changeOrigin: true },
    },
  },
})
