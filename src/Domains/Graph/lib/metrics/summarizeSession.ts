import type { SessionInfo } from '@opencode/client';
import type {
  TGraphModel,
  TNodeMetrics,
  TNodeStatus,
  TTokenUsage,
} from '../../Graph.entity';
import type {
  TResourceUsage,
  TSessionSummary,
} from '../../../Inspector/Inspector.entity';
import { sumNullable } from '@app/Application/Helpers/number';
import { isActiveStatus } from '../nodeStatus';

export const summarizeSession = (
  root: SessionInfo,
  graph: TGraphModel,
  resourceUsage: TResourceUsage,
  now: number,
): TSessionSummary => {
  const nodes = graph.nodes;
  const statuses = nodes.map((n) => n.data.status);
  const countStatus = (status: TNodeStatus): number =>
    statuses.filter((candidate) => candidate === status).length;

  const durationMs = sumNullable(nodes.map((n) => n.data.metrics.durationMs));
  const cost = sumNullable(nodes.map((n) => n.data.metrics.cost));

  const tokenValues = nodes.map((n) => n.data.metrics.tokens);
  const tokenField = (
    pick: (t: TTokenUsage) => number | null,
  ): number | null =>
    sumNullable(tokenValues.map((t) => (t === null ? null : pick(t))));

  const tokens: TTokenUsage | null =
    tokenValues.some((t) => t !== null)
      ? {
          input: tokenField((t) => t.input),
          output: tokenField((t) => t.output),
          reasoning: tokenField((t) => t.reasoning),
          cacheRead: tokenField((t) => t.cacheRead),
          cacheWrite: tokenField((t) => t.cacheWrite),
        }
      : null;

  const startValues = nodes
    .map((n) => n.data.metrics.startedAt)
    .filter((v): v is number => v !== null);
  const endValues = nodes
    .map((n) => n.data.metrics.endedAt)
    .filter((v): v is number => v !== null);

  // Tiempo transcurrido de la sesión (FR-026): del primer inicio al último fin;
  // mientras algún agente siga activo (corre, reintenta, compacta o espera), el
  // fin es `now` para que la barra avance en vivo sin relayoutar (FR-027).
  const sessionActive = statuses.some(isActiveStatus);
  const elapsedMs =
    startValues.length === 0
      ? null
      : (sessionActive || endValues.length === 0
          ? now
          : Math.max(...endValues)) - Math.min(...startValues);

  const agentInvocations: Record<string, number> = {};
  for (const node of nodes) {
    const name = node.data.agentName;
    agentInvocations[name] = (agentInvocations[name] ?? 0) + 1;
  }

  const loopEvidence = nodes.flatMap((n) => n.data.metrics.loopEvidence);

  const metrics: TNodeMetrics = {
    durationMs,
    startedAt: startValues.length > 0 ? Math.min(...startValues) : null,
    endedAt: endValues.length > 0 ? Math.max(...endValues) : null,
    cost,
    tokens,
    invocations: nodes.reduce(
      (total, n) => total + n.data.metrics.invocations,
      0,
    ),
    retryCount: nodes.reduce((total, n) => total + n.data.metrics.retryCount, 0),
    hasLoop: nodes.some((n) => n.data.metrics.hasLoop),
    loopEvidence,
  };

  return {
    rootSessionId: root.id,
    metrics,
    agentCount: nodes.length,
    subagentCount: nodes.filter((n) => !n.data.isRoot).length,
    createdCount: countStatus('created'),
    runningCount: countStatus('running'),
    retryingCount: countStatus('retrying'),
    compactingCount: countStatus('compacting'),
    // Las dos esperas (permiso y respuesta) se agrupan en un solo contador
    // (FR-024); se distinguen entre sí en el detalle del agente.
    waitingCount: countStatus('waiting-permission') + countStatus('waiting-input'),
    succeededCount: countStatus('succeeded'),
    // `errorCount` cuenta solo `failed`: una interrupción no es un fallo
    // propio y se reporta por separado (FR-019).
    errorCount: countStatus('failed'),
    interruptedCount: countStatus('interrupted'),
    loopCount: nodes.filter((n) => n.data.metrics.hasLoop).length,
    agentInvocations,
    resourceUsage,
    elapsedMs,
  };
};
