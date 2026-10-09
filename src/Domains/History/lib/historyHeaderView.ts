import {
  folderName,
  formatCost,
  formatDuration,
  formatModelRef,
  formatTokens,
  isTerminalOutcome,
  OUTCOME_LABEL,
  totalTokens,
} from '@app/Application/Helpers';
import type { TGraphNode, TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/**
 * Vista derivada de la cabecera del histórico (FR-010/FR-038). Reúne la
 * identidad y las 7 métricas en un objeto plano que la presentación consume sin
 * recalcular nada.
 */
export interface THistoryHeaderView {
  title: string;
  agentName: string;
  status: TNodeStatus;
  modelValue: string | null;
  costValue: string | null;
  tokensValue: string | null;
  durationValue: string | null;
  outcomeValue: string | null;
  directoryValue: string | null;
}

/**
 * Selector puro de la cabecera del histórico (FR-010): deriva identidad, estado
 * y métricas del nodo, aplicando el "no disponible" (`null`) ante datos ausentes
 * (FR-038). Sin JSX ni estado; testeable en aislamiento.
 */
export const deriveHistoryHeaderView = (
  node: TGraphNode,
): THistoryHeaderView => {
  const { data } = node;
  const { metrics, model } = data;
  const tokens = totalTokens(metrics.tokens);

  return {
    title: data.title ?? data.agentName,
    agentName: data.agentName,
    status: data.status,
    modelValue: model ? formatModelRef(model) : null,
    costValue: metrics.cost === null ? null : formatCost(metrics.cost),
    tokensValue: tokens === null ? null : formatTokens(tokens),
    durationValue:
      metrics.durationMs === null ? null : formatDuration(metrics.durationMs),
    outcomeValue: isTerminalOutcome(data.status)
      ? OUTCOME_LABEL[data.status]
      : null,
    directoryValue: data.directory ? folderName(data.directory) : null,
  };
};
