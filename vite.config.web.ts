import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/workspace': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/v1/, '/v1'),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    assetsInlineLimit: 2048,
  },
});