import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createApiApp } from './03-程序区/后端服务/createApiApp'

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
      "@": path.resolve(__dirname, "./03-程序区/前端代码"),
    },
  },
})
