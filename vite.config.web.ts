// Vite config for pure web (non-Electron) development
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
      },
    },
    build: {
      assetsInlineLimit: 2048,
    },
  };
});