import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createApiApp } from './server/createApiApp'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'design-work-provider-api',
      configureServer(server) {
        server.middlewares.use(createApiApp(__dirname))
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
