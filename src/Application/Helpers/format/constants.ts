/**
 * Constantes compartidas de los formateadores de Application (SH-10).
 *
 * `UNAVAILABLE` estaba en `formatDuration.ts` (reimportado por `formatTokens` y
 * `formatCost`) y `UNAVAILABLE_LABEL` se duplicaba en `formatTimeRange.ts` y en
 * `AgentNode.tsx`. Un solo origen evita que el texto y el `aria-label` divergan.
 */

/** Marcador corto de valor ausente (`—`), usado por los formateadores numéricos. */
export const UNAVAILABLE = '—';

/** Texto largo de "no disponible" (rango horario, próximo intento, motivo). */
export const UNAVAILABLE_LABEL = 'no disponible';
