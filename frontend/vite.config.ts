import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = 'http://localhost:8102'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5192,
    strictPort: true,
    proxy: {
      '/api': API,
      '/salud': API,
      '/.well-known': API,
      '/admin/': API,
      '/static': API,
    },
  },
})
