import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import type { TNodeStatus } from '../Graph.entity';

/** Contador por estado de la barra de resumen de sesión (FR-024). */
export interface TSummaryCounter {
  status: TNodeStatus;
  label: string;
  count: number;
  /** Se muestra siempre aunque esté en 0 (FR-024: en curso/esperando/error). */
  always: boolean;
}

/**
 * Entrada mínima de `buildSummaryCounters`: solo los contadores por estado que
 * la barra lee. Deliberadamente estructural para no acoplar el componente
 * `Graph` a `Inspector` (AGENTS §8.3); `TSessionSummary` la satisface sin
 * cambios en sus consumidores.
 */
export interface TSummaryCounts {
  runningCount: number;
  waitingCount: number;
  errorCount: number;
  retryingCount: number;
  compactingCount: number;
  succeededCount: number;
  interruptedCount: number;
  createdCount: number;
}

/**
 * Construye, en orden estable, los contadores por estado de la barra de resumen
 * (FR-024). Las dos esperas (`waiting-permission` + `waiting-input`) se agrupan
 * bajo un único contador "Esperando" y una interrupción nunca se cuenta como
 * error (FR-019). `always` marca los tres contadores que se muestran aunque
 * estén en 0; el resto solo cuando tienen agentes. Función pura y sin SDK.
 */
export const buildSummaryCounters = (
  summary: TSummaryCounts,
): TSummaryCounter[] => [
  {
    status: 'running',
    label: NODE_STATUS_LABEL.running,
    count: summary.runningCount,
    always: true,
  },
  {
    status: 'waiting-permission',
    label: 'Esperando',
    count: summary.waitingCount,
    always: true,
  },
  {
    status: 'failed',
    label: NODE_STATUS_LABEL.failed,
    count: summary.errorCount,
    always: true,
  },
  {
    status: 'retrying',
    label: NODE_STATUS_LABEL.retrying,
    count: summary.retryingCount,
    always: false,
  },
  {
    status: 'compacting',
    label: NODE_STATUS_LABEL.compacting,
    count: summary.compactingCount,
    always: false,
  },
  {
    status: 'succeeded',
    label: NODE_STATUS_LABEL.succeeded,
    count: summary.succeededCount,
    always: false,
  },
  {
    status: 'interrupted',
    label: NODE_STATUS_LABEL.interrupted,
    count: summary.interruptedCount,
    always: false,
  },
  {
    status: 'created',
    label: NODE_STATUS_LABEL.created,
    count: summary.createdCount,
    always: false,
  },
];
