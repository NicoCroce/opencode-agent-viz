import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * El server V2 de OpenCode exige HTTP Basic (usuario `opencode`). La password
 * la genera `scripts/start.sh` y llega por `OPENCODE_PASSWORD`; el proxy la
 * inyecta para que el browser no tenga que autenticarse.
 */
const opencodePassword = process.env.OPENCODE_PASSWORD;
const opencodeAuthHeader = opencodePassword
  ? `Basic ${Buffer.from(`opencode:${opencodePassword}`).toString('base64')}`
  : undefined;

if (!opencodeAuthHeader) {
  console.warn(
    '[vite] OPENCODE_PASSWORD no está definida: las llamadas a /oc responderán 401. ' +
      'Arrancá con `pnpm start` en lugar de `pnpm dev`.',
  );
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@app',
        replacement: resolve(__dirname, 'src'),
      },
      {
        find: '@',
        replacement: resolve(__dirname, './src'),
      },
    ],
  },
  server: {
    proxy: {
      '/oc': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oc/, ''),
        configure: (proxy) => {
          if (!opencodeAuthHeader) return;
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('authorization', opencodeAuthHeader);
          });
        },
      },
    },
  },
});
