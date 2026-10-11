import { describe, expect, it } from 'vitest';
import type { TChatStreamBuffer } from '@app/Domains/Chat/Chat.entity';
import {
  type TChatStreamDeltaEvent,
  type TChatStreamEndedEvent,
  mergeChatStream,
} from '../mergeChatStream';

/**
 * S1/S2 (`contracts/chat-stream-contract.md` §2, data-model §2.1): buffer
 * provisional del mensaje en curso. `mergeChatStream` es la función pura
 * canónica del dominio Chat; para los deltas su comportamiento es idéntico al
 * slice `reduceChatStream` (`upsertChatStreamBuffer`) y además **limpia** el
 * `ordinal` ya consolidado cuando llega un `*.ended` (FR-003).
 */

const textDelta = (
  assistantMessageID: string,
  ordinal: number,
  delta: string,
  created: number,
): TChatStreamDeltaEvent => ({
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
): TChatStreamDeltaEvent => ({
  id: `evt_reasoning_${created}`,
  created,
  type: 'session.reasoning.delta',
  data: { sessionID: 'ses_1', assistantMessageID, ordinal, delta },
});

const textEnded = (
  assistantMessageID: string,
  ordinal: number,
  text: string,
  created: number,
): TChatStreamEndedEvent => ({
  id: `evt_ended_${created}`,
  created,
  type: 'session.text.ended',
  durable: { aggregateID: 'ses_1', seq: 1, version: 1 },
  data: { sessionID: 'ses_1', assistantMessageID, ordinal, text },
});

const bufferOf = (value: unknown): TChatStreamBuffer =>
  value as TChatStreamBuffer;

describe('mergeChatStream', () => {
  it('concatenates two deltas at the same assistantMessageID:ordinal (S1)', () => {
    let buffer = mergeChatStream(undefined, textDelta('msg_1', 0, 'ho', 10));
    buffer = mergeChatStream(buffer, textDelta('msg_1', 0, 'la', 11));

    expect(bufferOf(buffer).parts[0]).toEqual({
      kind: 'text',
      text: 'hola',
      at: 11,
    });
  });

  it('resets the buffer when assistantMessageID changes (S2)', () => {
    let buffer = mergeChatStream(undefined, textDelta('msg_1', 0, 'viejo', 10));
    buffer = mergeChatStream(buffer, textDelta('msg_2', 0, 'nuevo', 20));

    const cast = bufferOf(buffer);
    expect(cast.assistantMessageID).toBe('msg_2');
    expect(Object.keys(cast.parts)).toEqual(['0']);
    expect(cast.parts[0]).toEqual({ kind: 'text', text: 'nuevo', at: 20 });
  });

  it('starts a fresh buffer when there is no previous state', () => {
    const buffer = bufferOf(mergeChatStream(null, textDelta('msg_1', 0, 'x', 5)));

    expect(buffer.assistantMessageID).toBe('msg_1');
    expect(buffer.parts[0]).toEqual({ kind: 'text', text: 'x', at: 5 });
  });

  it('keeps one part per ordinal and maps reasoning deltas', () => {
    let buffer = mergeChatStream(undefined, textDelta('msg_1', 0, 'a', 10));
    buffer = mergeChatStream(buffer, reasoningDelta('msg_1', 1, 'pienso', 11));

    const cast = bufferOf(buffer);
    expect(cast.parts[0]).toEqual({ kind: 'text', text: 'a', at: 10 });
    expect(cast.parts[1]).toEqual({
      kind: 'reasoning',
      text: 'pienso',
      at: 11,
    });
  });

  it('clears the consolidated ordinal when a *.ended arrives', () => {
    let buffer = mergeChatStream(undefined, textDelta('msg_1', 0, 'hola', 10));
    buffer = mergeChatStream(buffer, reasoningDelta('msg_1', 1, 'pienso', 11));
    buffer = mergeChatStream(buffer, textEnded('msg_1', 0, 'hola', 12));

    const cast = bufferOf(buffer);
    expect(cast.assistantMessageID).toBe('msg_1');
    expect(Object.keys(cast.parts)).toEqual(['1']);
    expect(cast.parts[0]).toBeUndefined();
  });

  it('ignores an *.ended for a different in-progress message', () => {
    const buffer = mergeChatStream(undefined, textDelta('msg_1', 0, 'hola', 10));
    const next = mergeChatStream(buffer, textEnded('msg_2', 0, 'otro', 20));

    expect(next).toEqual(buffer);
  });

  it('does not mutate the previous buffer', () => {
    const previous = mergeChatStream(
      undefined,
      textDelta('msg_1', 0, 'ho', 10),
    );
    const snapshot = structuredClone(previous);

    mergeChatStream(previous, textDelta('msg_1', 0, 'la', 11));

    expect(previous).toEqual(snapshot);
  });
});
