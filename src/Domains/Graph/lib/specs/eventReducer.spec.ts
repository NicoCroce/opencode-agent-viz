import { describe, expect, it } from 'vitest';
import type { SessionStatus, V2Event } from '@opencode/client';
import { reduceActivity, reduceEvent } from '../eventReducer';
import type { TReducibleEvent } from '../eventReducer';
import { setActivity } from '../eventReduce/cache';
import { queryKeys } from '../../../queryKeys';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TExecutionSignal } from '../../Graph.entity';

/**
 * `V2Event` incluye `V2EventServerConnected`, que no expone `created`. Cuando
 * un array mezcla eventos de `V2Event` con `SessionMessageContentUpdated`, el
 * tipo resultante (`V2Event | SessionMessageContentUpdated`) tampoco expone
 * `created`. Los helpers que devuelven deltas consolidados se tipan con este
 * subconjunto para conservar el acceso a `created` en los loops de actividad.
 */
type TCreatedV2Event = Extract<V2Event, { created: number }>;

const applySet = (prev: unknown, event: TReducibleEvent): unknown => {
  const updates = reduceEvent(event);
  if (!updates) return prev;
  return updates.reduce(
    (acc, update) => (update.kind === 'set' ? update.updater(acc) : acc),
    prev,
  );
};

const sameKey = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Aplica solo los updates `set` dirigidos a `queryKey` (ignora otras caches). */
const applyKey = (
  prev: unknown,
  event: TReducibleEvent,
  queryKey: readonly unknown[],
): unknown => {
  const updates = reduceEvent(event) ?? [];
  return updates.reduce(
    (acc, update) =>
      update.kind === 'set' && sameKey(update.queryKey, queryKey)
        ? update.updater(acc)
        : acc,
    prev,
  );
};

/** La cache de ejecucion es un `Record<sessionID, TExecutionSignal>`. */
const applyExecution = (
  prev: unknown,
  event: TReducibleEvent,
): Record<string, TExecutionSignal> =>
  applyKey(
    prev,
    event,
    queryKeys.sessions.execution('ses_1'),
  ) as Record<string, TExecutionSignal>;

/** La marca de actividad es un `Record<sessionID, number>` (TActivityMap). */
const applyActivity = (
  prev: Record<string, number> | undefined,
  event: TReducibleEvent,
): Record<string, number> | undefined => {
  const update = reduceActivity(event);
  if (!update || update.kind !== 'set') return prev;
  return update.updater(prev) as Record<string, number>;
};

const serverConnected: V2Event = {
  id: 'evt_connected',
  type: 'server.connected',
  data: {},
};

const sessionCreated: V2Event = {
  id: 'evt_created',
  created: 1,
  type: 'session.created',
  durable: { aggregateID: 'ses_1', seq: 1, version: 1 },
  data: {
    sessionID: 'ses_1',
    projectID: 'proj',
    location: { directory: '/repo' },
    slug: 'crisp-rocket',
    version: '1',
  },
};

const toolInputStarted: V2Event = {
  id: 'evt_tool',
  created: 10,
  type: 'session.tool.input.started',
  durable: { aggregateID: 'ses_1', seq: 2, version: 1 },
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    id: 'tool_1',
    name: 'bash',
  },
};

const permission: V2Event = {
  id: 'evt_perm',
  created: 3,
  type: 'permission.asked',
  data: {
    id: 'perm_1',
    sessionID: 'ses_1',
    action: 'bash',
    resources: ['echo hi'],
  },
};

const permissionReplied: V2Event = {
  id: 'evt_perm_reply',
  created: 4,
  type: 'permission.replied',
  data: { sessionID: 'ses_1', requestID: 'perm_1', reply: 'always' },
};

/* ------------------------------------------------------------------ */
/* Fixtures de contenido consolidado                                   */
/* ------------------------------------------------------------------ */

const stepStarted: V2Event = {
  id: 'evt_step',
  created: 100,
  type: 'session.step.started',
  durable: { aggregateID: 'ses_1', seq: 10, version: 1 },
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    agent: 'build',
    model: { id: 'claude', providerID: 'anthropic' },
    started: 100,
  },
};

const textEnded = (ordinal: number, text: string): TCreatedV2Event => ({
  id: `evt_text_${ordinal}`,
  created: 101 + ordinal,
  type: 'session.text.ended',
  durable: { aggregateID: 'ses_1', seq: 11 + ordinal, version: 1 },
  data: { sessionID: 'ses_1', assistantMessageID: 'msg_1', ordinal, text },
});

const reasoningEnded = (ordinal: number, text: string): TCreatedV2Event => ({
  id: `evt_reasoning_${ordinal}`,
  created: 110 + ordinal,
  type: 'session.reasoning.ended',
  durable: { aggregateID: 'ses_1', seq: 20 + ordinal, version: 1 },
  data: { sessionID: 'ses_1', assistantMessageID: 'msg_1', ordinal, text },
});

const contentUpdated: TReducibleEvent = {
  id: 'evt_content',
  created: 130,
  type: 'session.message.content.updated',
  durable: { aggregateID: 'ses_1', seq: 30, version: 1 },
  data: {
    sessionID: 'ses_1',
    messageID: 'msg_1',
    content: [
      { type: 'text', text: 'snapshot' },
      {
        type: 'tool',
        id: 'tool_1',
        name: 'bash',
        state: { status: 'streaming', input: '' },
        time: { created: 100 },
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Fixtures de senales de ejecucion                                    */
/* ------------------------------------------------------------------ */

const retryScheduled: V2Event = {
  id: 'evt_retry',
  created: 200,
  type: 'session.retry.scheduled',
  durable: { aggregateID: 'ses_1', seq: 40, version: 1 },
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    attempt: 2,
    at: 5000,
    error: { type: 'api', message: 'boom' },
  },
};

const statusRetry: V2Event = {
  id: 'evt_status_retry',
  created: 201,
  type: 'session.status',
  data: {
    sessionID: 'ses_1',
    status: { type: 'retry', attempt: 3, message: 'retrying', next: 6000 },
  },
};

const compactionStarted: V2Event = {
  id: 'evt_compact_start',
  created: 300,
  type: 'session.compaction.started',
  durable: { aggregateID: 'ses_1', seq: 50, version: 1 },
  data: { sessionID: 'ses_1', reason: 'auto', recent: 'recent text' },
};

const compactionEnded: V2Event = {
  id: 'evt_compact_end',
  created: 301,
  type: 'session.compaction.ended',
  durable: { aggregateID: 'ses_1', seq: 51, version: 1 },
  data: {
    sessionID: 'ses_1',
    reason: 'auto',
    text: 'summary',
    recent: 'recent',
  },
};

const compactionFailed: V2Event = {
  id: 'evt_compact_fail',
  created: 302,
  type: 'session.compaction.failed',
  durable: { aggregateID: 'ses_1', seq: 52, version: 1 },
  data: {
    sessionID: 'ses_1',
    reason: 'auto',
    error: { type: 'api', message: 'nope' },
  },
};

const execSucceeded: V2Event = {
  id: 'evt_exec_ok',
  created: 400,
  type: 'session.execution.succeeded',
  durable: { aggregateID: 'ses_1', seq: 60, version: 1 },
  data: { sessionID: 'ses_1' },
};

const execFailed: V2Event = {
  id: 'evt_exec_fail',
  created: 401,
  type: 'session.execution.failed',
  durable: { aggregateID: 'ses_1', seq: 61, version: 1 },
  data: { sessionID: 'ses_1', error: { type: 'api', message: 'boom' } },
};

const execInterrupted: V2Event = {
  id: 'evt_exec_interrupt',
  created: 402,
  type: 'session.execution.interrupted',
  durable: { aggregateID: 'ses_1', seq: 62, version: 1 },
  data: { sessionID: 'ses_1', reason: 'user' },
};

const execStarted: V2Event = {
  id: 'evt_exec_start',
  created: 403,
  type: 'session.execution.started',
  durable: { aggregateID: 'ses_1', seq: 63, version: 1 },
  data: { sessionID: 'ses_1' },
};

const sessionIdle: V2Event = {
  id: 'evt_idle',
  created: 500,
  type: 'session.idle',
  data: { sessionID: 'ses_1' },
};

/* ------------------------------------------------------------------ */
/* Fixtures de inbox / forms                                           */
/* ------------------------------------------------------------------ */

const inboxDelivered: V2Event = {
  id: 'evt_inbox',
  created: 600,
  type: 'session.inbox.delivered',
  durable: { aggregateID: 'ses_1', seq: 70, version: 1 },
  data: { sessionID: 'ses_1', inboxID: 'inbox_1' },
};

const formCreated: V2Event = {
  id: 'evt_form_created',
  created: 700,
  type: 'form.created',
  data: {
    form: {
      id: 'form_1',
      sessionID: 'ses_1',
      title: 'Pregunta',
      fields: [{ type: 'string', key: 'q', title: 'Q' }],
    },
  },
};

const formReplied: V2Event = {
  id: 'evt_form_replied',
  created: 701,
  type: 'form.replied',
  data: { id: 'form_1', sessionID: 'ses_1', answer: { q: 'ok' } },
};

const formCancelled: V2Event = {
  id: 'evt_form_cancelled',
  created: 702,
  type: 'form.cancelled',
  data: { id: 'form_1', sessionID: 'ses_1' },
};

/* ------------------------------------------------------------------ */
/* Fixtures de deltas (deben ignorarse)                                */
/* ------------------------------------------------------------------ */

const textDelta: V2Event = {
  id: 'evt_text_delta',
  created: 800,
  type: 'session.text.delta',
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    ordinal: 0,
    delta: 'ho',
  },
};

const reasoningDelta: V2Event = {
  id: 'evt_reasoning_delta',
  created: 801,
  type: 'session.reasoning.delta',
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    ordinal: 0,
    delta: 'pi',
  },
};

const toolInputDelta: V2Event = {
  id: 'evt_tool_delta',
  created: 802,
  type: 'session.tool.input.delta',
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    id: 'tool_1',
    delta: '{"a"',
  },
};

const toolProgress: V2Event = {
  id: 'evt_tool_progress',
  created: 803,
  type: 'session.tool.progress',
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    id: 'tool_1',
    metadata: {},
  },
};

const compactionDelta: V2Event = {
  id: 'evt_compact_delta',
  created: 804,
  type: 'session.compaction.delta',
  data: { sessionID: 'ses_1', text: 'partial' },
};

describe('reduceEvent', () => {
  it('maps server.connected to the connection state key', () => {
    const updates = reduceEvent(serverConnected);
    expect(updates?.[0]).toMatchObject({
      kind: 'set',
      queryKey: queryKeys.connection.state,
    });
    expect(applySet(undefined, serverConnected)).toBe('connected');
  });

  it('invalidates session lists on session.created', () => {
    const updates = reduceEvent(sessionCreated);
    expect(updates?.[0]).toEqual({
      kind: 'invalidate',
      queryKey: queryKeys.sessions.all,
    });
  });

  it('routes tool parts to the session messages cache', () => {
    const updates = reduceEvent(toolInputStarted);
    expect(updates?.[0]).toMatchObject({
      kind: 'set',
      queryKey: queryKeys.sessions.messages('ses_1'),
    });
  });

  it('adds and removes permissions', () => {
    const added = applySet([], permission);
    expect(added).toEqual([
      {
        id: 'perm_1',
        sessionID: 'ses_1',
        action: 'bash',
        resources: ['echo hi'],
      },
    ]);
    expect(applySet(added, permissionReplied)).toEqual([]);
  });

  it('inserts consolidated text and reasoning by ordinal', () => {
    const key = queryKeys.sessions.messages('ses_1');
    let cache = applyKey(undefined, stepStarted, key);
    cache = applyKey(cache, textEnded(0, 'hola'), key);
    cache = applyKey(cache, reasoningEnded(1, 'pienso'), key);

    const [message] = cache as TSessionMessage[];
    expect(message.parts[0]).toEqual({ type: 'text', text: 'hola' });
    expect(message.parts[1]).toEqual({ type: 'reasoning', text: 'pienso' });
  });

  it('replaces the part already present at the same ordinal', () => {
    const key = queryKeys.sessions.messages('ses_1');
    let cache = applyKey(undefined, stepStarted, key);
    cache = applyKey(cache, textEnded(0, 'hola'), key);
    cache = applyKey(cache, textEnded(0, 'hola, mundo'), key);

    const [message] = cache as TSessionMessage[];
    expect(message.parts).toHaveLength(1);
    expect(message.parts[0]).toEqual({ type: 'text', text: 'hola, mundo' });
  });

  it('replaces content with the durable snapshot on content.updated', () => {
    const key = queryKeys.sessions.messages('ses_1');
    let cache = applyKey(undefined, stepStarted, key);
    cache = applyKey(cache, textEnded(0, 'parcial'), key);
    cache = applyKey(cache, contentUpdated, key);

    const [message] = cache as TSessionMessage[];
    expect(message.parts).toHaveLength(2);
    expect(message.parts[0]).toMatchObject({ type: 'text', text: 'snapshot' });
    expect(message.parts[1]).toMatchObject({ type: 'tool', id: 'tool_1' });
  });

  it('records a scheduled retry in the execution signal', () => {
    const cache = applyExecution(undefined, retryScheduled);
    expect(cache['ses_1'].retry).toEqual({ attempt: 2, next: 5000 });
  });

  it('records retry from session.status with type retry', () => {
    const cache = applyExecution(undefined, statusRetry);
    expect(cache['ses_1'].retry).toEqual({ attempt: 3, next: 6000 });
  });

  it('tracks the compaction lifecycle in the execution signal', () => {
    expect(
      applyExecution(undefined, compactionStarted)['ses_1'].compaction,
    ).toBe('running');
    expect(
      applyExecution(undefined, compactionEnded)['ses_1'].compaction,
    ).toBe('completed');
    expect(
      applyExecution(undefined, compactionFailed)['ses_1'].compaction,
    ).toBe('failed');
  });

  it('records terminal outcomes and the interruption reason', () => {
    expect(applyExecution(undefined, execSucceeded)['ses_1'].outcome).toBe(
      'succeeded',
    );
    expect(applyExecution(undefined, execFailed)['ses_1'].outcome).toBe(
      'failed',
    );

    const interrupted = applyExecution(undefined, execInterrupted)['ses_1'];
    expect(interrupted.outcome).toBe('interrupted');
    expect(interrupted.interruptReason).toBe('user');
  });

  it('clears active signals on session.idle while keeping the outcome', () => {
    let cache = applyExecution(undefined, execFailed);
    cache = applyExecution(cache, retryScheduled);
    cache = applyExecution(cache, compactionStarted);
    cache = applyExecution(cache, sessionIdle);

    expect(cache['ses_1'].retry).toBeNull();
    expect(cache['ses_1'].compaction).toBeNull();
    expect(cache['ses_1'].outcome).toBe('failed');
  });

  it('marks busy and clears the previous outcome when a new execution starts', () => {
    let cache = applyExecution(undefined, execSucceeded);
    cache = applyExecution(cache, execInterrupted);
    expect(cache['ses_1'].outcome).toBe('interrupted');

    cache = applyExecution(cache, execStarted);

    // La sesión vuelve a correr: `busy` y sin outcome viejo que lo tape.
    expect(cache['ses_1'].outcome).toBeNull();
    expect(cache['ses_1'].interruptReason).toBeNull();
    expect(cache['ses_1'].retry).toBeNull();

    const statuses = applyKey(
      {},
      execStarted,
      queryKeys.sessions.status(),
    ) as Record<string, SessionStatus>;
    expect(statuses['ses_1']).toEqual({ type: 'busy' });
  });

  it('invalidates inbox and forms caches on their events', () => {
    expect(reduceEvent(inboxDelivered)).toEqual([
      { kind: 'invalidate', queryKey: queryKeys.sessions.inbox('ses_1') },
    ]);
    expect(reduceEvent(formCreated)).toEqual([
      { kind: 'invalidate', queryKey: queryKeys.sessions.forms('ses_1') },
    ]);
    expect(reduceEvent(formReplied)).toEqual([
      { kind: 'invalidate', queryKey: queryKeys.sessions.forms('ses_1') },
    ]);
    expect(reduceEvent(formCancelled)).toEqual([
      { kind: 'invalidate', queryKey: queryKeys.sessions.forms('ses_1') },
    ]);
  });

  it('ignores text/reasoning/tool deltas and progress (FR-005)', () => {
    for (const event of [
      textDelta,
      reasoningDelta,
      toolInputDelta,
      toolProgress,
      compactionDelta,
    ]) {
      expect(reduceEvent(event)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/* Marca de actividad (contract session-activity §2, A1/A2)            */
/* ------------------------------------------------------------------ */

describe('reduceActivity', () => {
  it('returns null for events without a session (server.connected)', () => {
    expect(reduceActivity(serverConnected)).toBeNull();
  });

  it('targets sessions.activity() with a set update for events with a session', () => {
    expect(reduceActivity(stepStarted)).toMatchObject({
      kind: 'set',
      queryKey: queryKeys.sessions.activity(),
    });
  });

  it('records event.created for lifecycle/status/idle events', () => {
    for (const event of [sessionCreated, statusRetry, sessionIdle]) {
      expect(applyActivity({}, event)).toEqual({ ses_1: event.created });
    }
  });

  it('records event.created for message/content events', () => {
    for (const event of [
      stepStarted,
      textEnded(0, 'hola'),
      reasoningEnded(1, 'pienso'),
      contentUpdated,
      toolInputStarted,
    ]) {
      expect(applyActivity({}, event)).toEqual({ ses_1: event.created });
    }
  });

  it('records event.created for execution/retry/compaction events', () => {
    for (const event of [
      execStarted,
      execSucceeded,
      execFailed,
      execInterrupted,
      retryScheduled,
      compactionStarted,
      compactionEnded,
      compactionFailed,
    ]) {
      expect(applyActivity({}, event)).toEqual({ ses_1: event.created });
    }
  });

  it('records event.created for permission events', () => {
    for (const event of [permission, permissionReplied]) {
      expect(applyActivity({}, event)).toEqual({ ses_1: event.created });
    }
  });

  it('records event.created for inbox/forms events', () => {
    for (const event of [
      inboxDelivered,
      formCreated,
      formReplied,
      formCancelled,
    ]) {
      expect(applyActivity({}, event)).toEqual({ ses_1: event.created });
    }
  });

  it('records event.created for deltas, whose content is otherwise ignored', () => {
    for (const event of [
      textDelta,
      reasoningDelta,
      toolInputDelta,
      toolProgress,
      compactionDelta,
    ]) {
      expect(applyActivity({}, event)).toEqual({ ses_1: event.created });
    }
  });
});

describe('setActivity', () => {
  it('adds the activity mark for a session absent from the map', () => {
    expect(setActivity({}, 'ses_1', 42)).toEqual({ ses_1: 42 });
  });

  it('keeps the maximum so the mark never moves backwards', () => {
    expect(setActivity({ ses_1: 100 }, 'ses_1', 50)).toEqual({ ses_1: 100 });
    expect(setActivity({ ses_1: 100 }, 'ses_1', 150)).toEqual({ ses_1: 150 });
  });

  it('does not mutate the input map', () => {
    const prev = { ses_1: 100 };
    const next = setActivity(prev, 'ses_1', 200);

    expect(prev).toEqual({ ses_1: 100 });
    expect(next).not.toBe(prev);
  });
});
