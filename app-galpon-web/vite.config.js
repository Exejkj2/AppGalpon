import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  workbox: {
    runtimeCaching: [
      {
        // Ignorar el caché para cualquier llamada a la API de Supabase
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'supabase-api-bypass',
        }
      }
    ]
  }
})
