import { describe, expect, it } from 'vitest';
import type { V2Event } from '@opencode/client';
import { reduceEvent } from '../eventReducer';
import { queryKeys } from '../../../queryKeys';

const applySet = (prev: unknown, event: V2Event): unknown => {
  const updates = reduceEvent(event);
  if (!updates) return prev;
  return updates.reduce(
    (acc, update) => (update.kind === 'set' ? update.updater(acc) : acc),
    prev,
  );
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
});
