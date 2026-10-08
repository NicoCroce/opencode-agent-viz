import type { CSSProperties } from 'react';

/**
 * Reposo de una arista de invocación: gris visible (no `--border`, que se pierde
 * en dark). Debe coincidir con `InvocationEdge.REST_STYLE` (contrato de render
 * §2): `AgentGraph` entrega este `style` como respaldo mientras las aristas no
 * tienen foco. `InvocationEdge` mantiene su copia privada; la constante vive
 * aquí para que el fallback de `AgentGraph` no repita el magic string.
 */
export const REST_EDGE_COLOR = 'hsl(var(--muted-foreground))';

/** Estilo de arista en reposo (contrato de render §2). */
export const REST_EDGE_STYLE: CSSProperties = {
  stroke: REST_EDGE_COLOR,
  strokeWidth: 1.25,
  opacity: 0.45,
};
