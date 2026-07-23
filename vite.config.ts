import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 58230,
    strictPort: true,
    open: true,
    proxy: {
      '/sessions': 'http://localhost:58231',
    },
  },
})