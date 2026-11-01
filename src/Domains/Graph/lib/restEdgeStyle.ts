import type { CSSProperties } from 'react';

/**
 * Reposo de una arista de invocación: hairline sólido `--edge`. Va sin alfa a
 * propósito: las aristas de un mismo padre comparten riel y, con opacidad, se
 * aclaraban al superponerse. Debe coincidir con `InvocationEdge.REST_STYLE`
 * (contrato de render §2): `AgentGraph` entrega este `style` como respaldo
 * mientras las aristas no tienen foco. `InvocationEdge` mantiene su copia
 * privada; la constante vive aquí para que el fallback de `AgentGraph` no
 * repita el magic string.
 */
export const REST_EDGE_COLOR = 'hsl(var(--edge))';

/** Estilo de arista en reposo (contrato de render §2). */
export const REST_EDGE_STYLE: CSSProperties = {
  stroke: REST_EDGE_COLOR,
  strokeWidth: 1,
  opacity: 1,
};
