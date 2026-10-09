import type { SessionStatus } from '@opencode/client';

/**
 * Aplica la foto de `session.active()` sobre el mapa de estados y reconcilia
 * los `busy` que ya no están activos.
 *
 * V2 no emite `session.idle`, así que el único cierre fiable de una ejecución es
 * un `session.execution.*` terminal. Si ese evento se pierde (o el server deja
 * de reportar la sesión), el `busy` quedaría pegado para siempre y el nodo nunca
 * pasaría a un estado terminal. Por eso el poll degrada a `idle` lo que dejó de
 * estar activo.
 *
 * `reset` reemplaza el mapa entero (snapshot autoritativo al conectar) y no
 * reconcilia. En modo incremental, un `busy` ausente del seed no se degrada al
 * primer sondeo: se anota en `missing` y recién al segundo se marca `idle`, para
 * no oscilar cuando el request de `active()` quedó en vuelo justo al arrancar
 * una ejecución.
 */
export const applyActiveSeed = (
  prev: Record<string, SessionStatus>,
  seed: Record<string, SessionStatus>,
  { reset, missing }: { reset: boolean; missing: Set<string> },
): Record<string, SessionStatus> => {
  const next: Record<string, SessionStatus> = reset ? {} : { ...prev };

  for (const [id, status] of Object.entries(seed)) {
    // El seed solo sabe `running`; no pisa el detalle `retry` de los eventos.
    if (!reset && next[id]?.type === 'retry') continue;
    next[id] = status;
  }

  if (reset) {
    missing.clear();
    return next;
  }

  const activeIds = new Set(Object.keys(seed));
  for (const [id, status] of Object.entries(next)) {
    if (status.type !== 'busy' || activeIds.has(id)) {
      missing.delete(id);
      continue;
    }
    if (missing.has(id)) {
      next[id] = { type: 'idle' };
      missing.delete(id);
    } else {
      missing.add(id);
    }
  }

  return next;
};
