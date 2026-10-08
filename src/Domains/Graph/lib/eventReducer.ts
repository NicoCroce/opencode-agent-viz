import { reduceConnection } from './eventReduce/slices/connection';
import { reduceExecution } from './eventReduce/slices/execution';
import { reduceFormsInbox } from './eventReduce/slices/formsInbox';
import { reduceIgnored } from './eventReduce/slices/ignored';
import { reduceMessages } from './eventReduce/slices/messages';
import { reducePermissions } from './eventReduce/slices/permissions';
import { reduceSessionLifecycle } from './eventReduce/slices/sessionLifecycle';
import type { TReducibleEvent } from './eventReduce/eventTypes';
import type { TEventUpdate } from './eventReduce/queryUpdates';

export type { TSessionMessageCache } from './eventReduce/cache';
export type { TReducibleEvent } from './eventReduce/eventTypes';
export type {
  TEventUpdate,
  TQueryUpdate,
} from './eventReduce/queryUpdates';

/**
 * Reduce un evento a la lista de updates de cache que dispara. Devuelve `null`
 * para los eventos que no tocan ninguna cache (deltas ignorados y eventos
 * desconocidos). El dispatch agrupa por fallthrough hacia el slice de su familia
 * y deja que cada slice haga su `switch` exhaustivo, preservando el narrowing
 * de `strict` sin `as` ni tablas de `Record`.
 */
export const reduceEvent = (event: TReducibleEvent): TEventUpdate | null => {
  switch (event.type) {
    case 'server.connected':
      return reduceConnection(event);

    /* --- ciclo de vida + estado --- */
    case 'session.created':
    case 'session.renamed':
    case 'session.metadata.updated':
    case 'session.moved':
    case 'session.usage.updated':
    case 'session.forked':
    case 'session.agent.selected':
    case 'session.model.selected':
    case 'session.deleted':
    case 'session.status':
    case 'session.idle':
      return reduceSessionLifecycle(event);

    /* --- ejecución / señales --- */
    case 'session.execution.started':
    case 'session.execution.succeeded':
    case 'session.execution.failed':
    case 'session.execution.interrupted':
    case 'session.retry.scheduled':
    case 'session.compaction.started':
    case 'session.compaction.ended':
    case 'session.compaction.failed':
      return reduceExecution(event);

    /* --- mensajes / contenido consolidado / tools --- */
    case 'session.step.started':
    case 'session.step.ended':
    case 'session.step.failed':
    case 'session.text.ended':
    case 'session.reasoning.ended':
    case 'session.message.content.updated':
    case 'session.tool.input.started':
    case 'session.tool.called':
    case 'session.tool.success':
    case 'session.tool.failed':
      return reduceMessages(event);

    /* --- deltas ignorados (FR-005, Principio VII) --- */
    case 'session.text.delta':
    case 'session.reasoning.delta':
    case 'session.tool.input.delta':
    case 'session.tool.progress':
    case 'session.compaction.delta':
      return reduceIgnored(event);

    /* --- permisos --- */
    case 'permission.asked':
    case 'permission.replied':
      return reducePermissions(event);

    /* --- inbox / forms --- */
    case 'session.inbox.delivered':
    case 'session.inbox.enqueued':
    case 'session.inbox.cancelled':
    case 'session.inbox.delivery.changed':
    case 'form.created':
    case 'form.replied':
    case 'form.cancelled':
      return reduceFormsInbox(event);

    default:
      return null;
  }
};
