import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// No local API gateway here: this service only serves the private admin UI.
export default defineConfig({
  root: path.resolve(__dirname, 'admin'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: '127.0.0.1', port: 5180, strictPort: true, fs: { allow: [__dirname] },
    proxy: {
      '/api/auth': { target: 'http://127.0.0.1:5173', changeOrigin: false },
      '/api/admin': { target: 'http://127.0.0.1:5173', changeOrigin: false },
    },
  },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true },
  build: { outDir: path.resolve(__dirname, 'dist-admin'), emptyOutDir: true },
});
