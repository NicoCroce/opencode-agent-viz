import { describe, expect, it } from 'vitest';
import type {
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  SessionMessageUser,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TChatStreamBuffer } from '@app/Domains/Chat/Chat.entity';
import type { THistoryQuestion } from '@app/Domains/History';
import { buildChatTimeline } from '../buildChatTimeline';

/**
 * S3/S4 (`contracts/chat-stream-contract.md` §3, data-model §2.2): la proyección
 * del timeline = histórico consolidado (`buildHistory`) + buffer provisional +
 * preguntas. Las partes provisionales se etiquetan "En curso" (`isComplete:
 * false`) y **nunca** se duplican cuando su `messageId:ordinal` ya entró al
 * histórico (FR-002/FR-003).
 */

/** Envuelve un `SessionMessageInfo` como lo hace `normalizeMessages`. */
const msg = (info: SessionMessageInfo): TSessionMessage => ({
  info,
  parts: info.type === 'assistant' ? info.content : [],
});

const text = (
  value: string,
): SessionMessageAssistant['content'][number] => ({
  type: 'text',
  text: value,
});

const tool = (
  overrides: Partial<SessionMessageAssistantTool> = {},
): SessionMessageAssistantTool => ({
  type: 'tool',
  id: 'tool-1',
  name: 'read',
  state: {
    status: 'completed',
    input: { path: 'a.ts' },
    content: [{ type: 'text', text: 'contents' }],
  },
  time: { created: 1000, completed: 1200 },
  ...overrides,
});

const assistant = (
  content: SessionMessageAssistant['content'],
  overrides: Partial<SessionMessageAssistant> = {},
): SessionMessageAssistant => ({
  id: 'assistant-1',
  time: { created: 1000, completed: 2000 },
  type: 'assistant',
  agent: 'develop',
  model: { providerID: 'opencode', id: 'deepseek' },
  ...overrides,
  content,
});

const user = (
  overrides: Partial<SessionMessageUser> = {},
): SessionMessageUser => ({
  id: 'user-1',
  time: { created: 500 },
  type: 'user',
  text: 'hello',
  ...overrides,
});

const buffer = (
  assistantMessageID: string,
  parts: TChatStreamBuffer['parts'],
): TChatStreamBuffer => ({ assistantMessageID, parts });

describe('buildChatTimeline', () => {
  it('returns an empty timeline without messages, buffer or questions', () => {
    expect(buildChatTimeline([], null)).toEqual([]);
  });

  it('projects the consolidated history with role, kind and source entry', () => {
    const entries = buildChatTimeline(
      [
        msg(user({ id: 'u1', time: { created: 500 }, text: 'hola' })),
        msg(
          assistant([text('respuesta')], {
            id: 'a1',
            time: { created: 1000, completed: 2000 },
          }),
        ),
      ],
      null,
    );

    expect(entries.map((e) => [e.id, e.role, e.kind, e.isComplete])).toEqual([
      ['u1:0', 'user', 'text', true],
      ['a1:0', 'agent', 'text', true],
    ]);
    expect(entries[0].text).toBe('hola');
    expect(entries[1].text).toBe('respuesta');
    expect(entries[1].history).toMatchObject({ id: 'a1:0', kind: 'answer' });
  });

  it('adds an unconsolidated buffer part as a provisional "En curso" entry (S3)', () => {
    const entries = buildChatTimeline(
      [],
      buffer('msg_1', { 0: { kind: 'text', text: 'hola', at: 1500 } }),
    );

    expect(entries).toEqual([
      {
        id: 'stream:msg_1:0',
        role: 'agent',
        kind: 'text',
        text: 'hola',
        isComplete: false,
        at: 1500,
        history: null,
      },
    ]);
  });

  it('drops the provisional part once its ordinal is consolidated (dedupe, S4)', () => {
    const entries = buildChatTimeline(
      [
        msg(
          assistant([text('hola')], {
            id: 'msg_1',
            time: { created: 1000, completed: 2000 },
          }),
        ),
      ],
      buffer('msg_1', { 0: { kind: 'text', text: 'hola', at: 1500 } }),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('msg_1:0');
    expect(entries.some((e) => e.id === 'stream:msg_1:0')).toBe(false);
  });

  it('keeps unconsolidated ordinals as provisional while others dedupe', () => {
    const entries = buildChatTimeline(
      [
        msg(
          assistant([text('consolidado')], {
            id: 'msg_1',
            time: { created: 1000, completed: 2000 },
          }),
        ),
      ],
      buffer('msg_1', {
        0: { kind: 'text', text: 'consolidado', at: 1500 },
        1: { kind: 'reasoning', text: 'pienso', at: 1600 },
      }),
    );

    expect(entries.map((e) => e.id)).toEqual(['msg_1:0', 'stream:msg_1:1']);
    expect(entries[1]).toMatchObject({ kind: 'reasoning', isComplete: false });
  });

  it('orders provisional entries after the consolidated history by `at`', () => {
    const entries = buildChatTimeline(
      [
        msg(user({ id: 'u1', time: { created: 500 } })),
        msg(
          assistant([text('previo')], {
            id: 'a1',
            time: { created: 1000, completed: 1100 },
          }),
        ),
      ],
      buffer('msg_2', { 0: { kind: 'text', text: 'en curso', at: 2000 } }),
    );

    expect(entries.map((e) => e.id)).toEqual(['u1:0', 'a1:0', 'stream:msg_2:0']);
    expect(entries.map((e) => e.at)).toEqual([500, 1000, 2000]);
  });

  it('projects questions passed through to the history (kind "question")', () => {
    const question: THistoryQuestion = {
      id: 'q1',
      title: '¿Cómo?',
      fields: [],
      state: 'pending',
      answer: null,
    };
    const entries = buildChatTimeline([], null, [question]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'question:q1',
      kind: 'question',
      text: '¿Cómo?',
      isComplete: true,
    });
  });

  it('maps tool entries to kind "tool"', () => {
    const entries = buildChatTimeline(
      [msg(assistant([tool({ id: 't1' })], { id: 'a1' }))],
      null,
    );

    expect(entries[0]).toMatchObject({
      kind: 'tool',
      role: 'agent',
      isComplete: true,
    });
  });

  it('does not mutate the inputs', () => {
    const messages = [msg(user({ id: 'u1', time: { created: 500 } }))];
    const stream = buffer('msg_1', {
      0: { kind: 'text', text: 'hola', at: 1500 },
    });
    const snapshot = structuredClone({ messages, stream });

    buildChatTimeline(messages, stream);

    expect(structuredClone({ messages, stream })).toEqual(snapshot);
  });
});
