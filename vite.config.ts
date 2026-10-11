import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import { isAllowedProxyRequest } from './src/Infrastructure/Services/lib/proxy.guard';

/**
 * Proxy al background service de OpenCode (el mismo que usa el TUI), no a un
 * `opencode serve` propio: sólo ese proceso emite los eventos SSE en vivo de
 * tus sesiones. `scripts/start.sh` descubre la URL con `opencode service status`
 * y la exporta por `OPENCODE_URL` (fallback 4096 para `pnpm dev` manual).
 *
 * El server V2 exige HTTP Basic (usuario `opencode`). La password llega por
 * `OPENCODE_PASSWORD`; el proxy la inyecta para que el browser no se autentique.
 * La password NUNCA viaja al bundle: sólo vive en este archivo server-side.
 *
 * Endurecimiento (FR-018): la app pasó a tener escritura, así que "acceder al
 * dev server" equivale a "ejecutar en la máquina". Por eso (a) el server bindea
 * sólo loopback y (b) el proxy `/oc` rechaza peticiones cuyo socket remoto no
 * sea loopback o cuyo `Origin`/`Referer` no provenga del propio dev server.
 * Esto evita exponer la escritura a la LAN y mitiga CSRF desde una web
 * maliciosa abierta en el mismo navegador.
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

const rejectProxyRequest = (
  proxyReq: ClientRequest,
  res: ServerResponse,
): void => {
  // Responder ANTES de destruir: así `res.headersSent` queda en true y el
  // manejador de error de http-proxy no intenta sobreescribir con un 500.
  if (!res.headersSent && !res.writableEnded) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: el proxy /oc sólo acepta peticiones de loopback.\n');
  }
  // Destruir el request saliente evita que llegue a OpenCode (nada de escritura).
  proxyReq.destroy();
};

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
    // Bind loopback: no exponer el dev server (con escritura) a la LAN.
    host: '127.0.0.1',
    proxy: {
      '/oc': {
        target: opencodeUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oc/, ''),
        configure: (proxy) => {
          proxy.on(
            'proxyReq',
            (
              proxyReq: ClientRequest,
              req: IncomingMessage,
              res: ServerResponse,
            ) => {
              const origin =
                typeof req.headers.origin === 'string'
                  ? req.headers.origin
                  : undefined;
              const referer =
                typeof req.headers.referer === 'string'
                  ? req.headers.referer
                  : undefined;

              if (
                !isAllowedProxyRequest({
                  remoteAddress: req.socket.remoteAddress,
                  origin,
                  referer,
                })
              ) {
                rejectProxyRequest(proxyReq, res);
                return;
              }

              if (!opencodeAuthHeader) return;
              proxyReq.setHeader('authorization', opencodeAuthHeader);
            },
          );
        },
      },
    },
  },
});
