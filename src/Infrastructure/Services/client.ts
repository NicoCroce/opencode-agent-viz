import { OpenCode } from '@opencode/client';

/**
 * El cliente V2 resuelve cada ruta con `new URL(path, baseUrl)`, así que
 * `baseUrl` debe ser ABSOLUTA: un pathname relativo revienta con
 * `TypeError: Invalid URL`. En el browser apuntamos al proxy `/oc` de Vite,
 * que reescribe `/oc/api/...` hacia el background service de OpenCode
 * (configurable por `OPENCODE_URL`); el fallback 4096 aplica a SSR/tests.
 */
export const resolveBaseUrl = (): string => {
  const base =
    typeof window === 'undefined'
      ? 'http://127.0.0.1:4096'
      : `${window.location.origin}/oc`;
  return new URL(base).href;
};

export const opencodeClient = OpenCode.make({ baseUrl: resolveBaseUrl() });
