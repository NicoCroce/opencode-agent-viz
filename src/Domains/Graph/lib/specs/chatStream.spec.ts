import { describe, expect, it } from 'vitest';
import type { TChatStreamBuffer } from '@app/Domains/Chat/Chat.entity';
import { queryKeys } from '../../../queryKeys';
import type { TReducibleEvent } from '../eventReducer';
import { reduceChatStream } from '../eventReduce/slices/chatStream';

/**
 * S1/S2/S5 (`contracts/chat-stream-contract.md` §2): el slice acumula los deltas
 * en la clave **raíz** `['chatStream', sessionID]` (fuera de `['sessions']`),
 * concatena por `assistantMessageID:ordinal` y resetea al cambiar de mensaje.
 */
type TChatStreamEvent = Extract<
  TReducibleEvent,
  { type: 'session.text.delta' | 'session.reasoning.delta' }
>;

const sameKey = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const textDelta = (
  assistantMessageID: string,
  ordinal: number,
  delta: string,
  created: number,
): TChatStreamEvent => ({
  id: `evt_text_${created}`,
  created,
  type: 'session.text.delta',
  data: { sessionID: 'ses_1', assistantMessageID, ordinal, delta },
});

const reasoningDelta = (
  assistantMessageID: string,
  ordinal: number,
  delta: string,
  created: number,
): TChatStreamEvent => ({
  id: `evt_reasoning_${created}`,
  created,
  type: 'session.reasoning.delta',
  data: { sessionID: 'ses_1', assistantMessageID, ordinal, delta },
});

/** Aplica el `set` del slice dirigido a `['chatStream', 'ses_1']`. */
const applyStream = (prev: unknown, event: TChatStreamEvent): unknown => {
  const updates = reduceChatStream(event);
  const update = updates.find((candidate) =>
    sameKey(candidate.queryKey, queryKeys.chatStream.for('ses_1')),
  );
  return update && update.kind === 'set' ? update.updater(prev) : prev;
};

const bufferOf = (value: unknown): TChatStreamBuffer =>
  value as TChatStreamBuffer;

describe('reduceChatStream', () => {
  it('writes the buffer to the root chatStream key, never under sessions (S5)', () => {
    const updates = reduceChatStream(textDelta('msg_1', 0, 'ho', 10));

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      kind: 'set',
      queryKey: queryKeys.chatStream.for('ses_1'),
    });
    expect(updates[0].queryKey).toEqual(['chatStream', 'ses_1']);
    expect(updates.some((update) => update.queryKey[0] === 'sessions')).toBe(
      false,
    );
  });

  it('concatenates two deltas at the same assistantMessageID:ordinal (S1)', () => {
    let buffer = applyStream(undefined, textDelta('msg_1', 0, 'ho', 10));
    buffer = applyStream(buffer, textDelta('msg_1', 0, 'la', 11));

    expect(bufferOf(buffer).parts[0]).toEqual({
      kind: 'text',
      text: 'hola',
      at: 11,
    });
  });

  it('resets the buffer when assistantMessageID changes (S2)', () => {
    let buffer = applyStream(undefined, textDelta('msg_1', 0, 'viejo', 10));
    buffer = applyStream(buffer, textDelta('msg_2', 0, 'nuevo', 20));

    const cast = bufferOf(buffer);
    expect(cast.assistantMessageID).toBe('msg_2');
    expect(Object.keys(cast.parts)).toEqual(['0']);
    expect(cast.parts[0]).toEqual({ kind: 'text', text: 'nuevo', at: 20 });
  });

  it('keeps one part per ordinal and maps reasoning deltas', () => {
    let buffer = applyStream(undefined, textDelta('msg_1', 0, 'a', 10));
    buffer = applyStream(buffer, reasoningDelta('msg_1', 1, 'pienso', 11));

    const cast = bufferOf(buffer);
    expect(cast.parts[0]).toEqual({ kind: 'text', text: 'a', at: 10 });
    expect(cast.parts[1]).toEqual({
      kind: 'reasoning',
      text: 'pienso',
      at: 11,
    });
  });

  it('starts a fresh buffer when there is no previous state', () => {
    const buffer = bufferOf(
      applyStream(null, textDelta('msg_1', 0, 'x', 5)),
    );

    expect(buffer.assistantMessageID).toBe('msg_1');
    expect(buffer.parts[0]).toEqual({ kind: 'text', text: 'x', at: 5 });
  });
});
