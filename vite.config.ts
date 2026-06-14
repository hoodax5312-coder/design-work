import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import express from 'express'
import { createProviderRouter } from './server/providerGateway'
import { createStorageRouter } from './server/storageGateway'
import { createWorkspaceRouter } from './server/workspaceGateway'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mboard-provider-api',
      configureServer(server) {
        const app = express()
        app.use(express.json({ limit: '20mb' }))
        app.use('/api/provider', createProviderRouter())
        app.use('/api/storage', createStorageRouter(__dirname))
        app.use('/api/workspace', createWorkspaceRouter(__dirname))
        server.middlewares.use(app)
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
