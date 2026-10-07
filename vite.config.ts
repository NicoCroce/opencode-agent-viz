import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Proxy al background service de OpenCode (el mismo que usa el TUI), no a un
 * `opencode serve` propio: sólo ese proceso emite los eventos SSE en vivo de
 * tus sesiones. `scripts/start.sh` descubre la URL con `opencode service status`
 * y la exporta por `OPENCODE_URL` (fallback 4096 para `pnpm dev` manual).
 *
 * El server V2 exige HTTP Basic (usuario `opencode`). La password llega por
 * `OPENCODE_PASSWORD`; el proxy la inyecta para que el browser no se autentique.
 */
const opencodeUrl = process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096';
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
        target: opencodeUrl,
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
