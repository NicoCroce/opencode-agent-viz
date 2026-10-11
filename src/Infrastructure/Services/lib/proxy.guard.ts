/**
 * Guard del proxy `/oc` (FR-018 · H2/H3 · `contracts/dev-server-hardening-contract.md`).
 *
 * Regla única: sólo pasan peticiones que llegan desde un socket loopback y cuyo
 * `Origin` o `Referer` es del propio dev server (loopback). Un origen ausente no
 * es loopback → se rechaza. Se extrae a una función pura y sin dependencias de
 * Node/HTTP para poder testearse en aislamiento; `vite.config.ts` la consume.
 */

/** Hosts considerados loopback (IPv4, IPv6 y `localhost`). */
export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]',
]);

/** `::ffff:127.0.0.1` (IPv4 mapeada en IPv6) cuenta como loopback. */
export const normalizeRemoteAddress = (address: string): string =>
  address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;

export const isLoopbackAddress = (address: string | undefined): boolean =>
  address !== undefined && LOOPBACK_HOSTS.has(normalizeRemoteAddress(address));

export const isLoopbackUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
};

/** Datos de la petición que necesita el guard (subset de `IncomingMessage`). */
export interface TProxyRequestContext {
  remoteAddress: string | undefined;
  origin: string | undefined;
  referer: string | undefined;
}

/**
 * Regla única del guard: sólo pasan peticiones que llegan desde un socket
 * loopback y cuyo `Origin`/`Referer` es del propio dev server (loopback).
 * Un origen ausente no es loopback → se rechaza.
 */
export const isAllowedProxyRequest = ({
  remoteAddress,
  origin,
  referer,
}: TProxyRequestContext): boolean => {
  if (!isLoopbackAddress(remoteAddress)) return false;
  return isLoopbackUrl(origin) || isLoopbackUrl(referer);
};
