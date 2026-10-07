import { describe, expect, it } from 'vitest';
import type {
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  SessionMessageUser,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryQuestion } from '../../History.entity';
import { buildHistory } from '../buildHistory';

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

const reasoning = (
  value: string,
): SessionMessageAssistant['content'][number] => ({
  type: 'reasoning',
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

const user = (overrides: Partial<SessionMessageUser> = {}): SessionMessageUser => ({
  id: 'user-1',
  time: { created: 500 },
  type: 'user',
  text: 'hello',
  ...overrides,
});

describe('buildHistory', () => {
  it('orders entries chronologically by message creation time', () => {
    const entries = buildHistory([
      msg(
        assistant([text('later')], {
          id: 'a2',
          time: { created: 2000, completed: 2100 },
        }),
      ),
      msg(user({ id: 'u1', time: { created: 1000 } })),
      msg(
        assistant([text('earliest')], {
          id: 'a1',
          time: { created: 500, completed: 600 },
        }),
      ),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(['a1:0', 'u1:0', 'a2:0']);
    expect(entries.map((entry) => entry.at)).toEqual([500, 1000, 2000]);
  });

  it('does not mutate the input order', () => {
    const first = msg(user({ id: 'u2', time: { created: 200 } }));
    const second = msg(user({ id: 'u1', time: { created: 100 } }));
    const input = [first, second];

    buildHistory(input);

    expect(input[0]).toBe(first);
    expect(input[1]).toBe(second);
  });

  it('interleaves assistant parts in their production order', () => {
    const entries = buildHistory([
      msg(
        assistant(
          [
            text('first'),
            tool({ id: 't1' }),
            reasoning('thinking'),
            tool({ id: 't2' }),
            text('last'),
          ],
          { id: 'a1' },
        ),
      ),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      'answer',
      'tool',
      'reasoning',
      'tool',
      'answer',
    ]);
    expect(entries.map((entry) => entry.id)).toEqual([
      'a1:0',
      'a1:1',
      'a1:2',
      'a1:3',
      'a1:4',
    ]);
    expect(entries[1]).toMatchObject({ kind: 'tool', entry: { id: 't1' } });
    expect(entries[3]).toMatchObject({ kind: 'tool', entry: { id: 't2' } });
  });

  it('marks answers and reasoning as incomplete while the assistant is streaming', () => {
    const [answer] = buildHistory([
      msg(assistant([text('partial')], { time: { created: 1000 } })),
    ]);
    expect(answer).toMatchObject({
      kind: 'answer',
      text: 'partial',
      isComplete: false,
    });

    const [reasoningEntry] = buildHistory([
      msg(assistant([reasoning('draft')], { time: { created: 1000 } })),
    ]);
    expect(reasoningEntry).toMatchObject({
      kind: 'reasoning',
      isComplete: false,
    });

    const [complete] = buildHistory([
      msg(
        assistant([text('full')], {
          time: { created: 1000, completed: 2000 },
        }),
      ),
    ]);
    expect(complete).toMatchObject({ kind: 'answer', isComplete: true });
  });

  it('collects user attachments with and without a name', () => {
    const entries = buildHistory([
      msg(
        user({
          files: [
            {
              data: 'x',
              mime: 'text/plain',
              source: { type: 'inline' },
              name: 'a.ts',
            },
            { data: 'y', mime: 'text/plain', source: { type: 'inline' } },
          ],
          agents: [{ name: 'develop' }],
          skills: [{ id: 's1', name: 'commit-conventions', text: 'body' }],
        }),
      ),
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'user',
      attachments: [
        { kind: 'file', name: 'a.ts' },
        { kind: 'file', name: null },
        { kind: 'agent', name: 'develop' },
        { kind: 'skill', name: 'commit-conventions' },
      ],
    });
  });

  it('projects agent, model and location switches with their previous value', () => {
    const entries = buildHistory([
      msg({
        id: 'ag',
        time: { created: 100 },
        type: 'agent-switched',
        agent: 'reviewer',
        previous: 'develop',
      }),
      msg({
        id: 'ag2',
        time: { created: 150 },
        type: 'agent-switched',
        agent: 'develop',
      }),
      msg({
        id: 'mo',
        time: { created: 200 },
        type: 'model-switched',
        model: { providerID: 'opencode', id: 'gpt' },
        previous: { providerID: 'opencode', id: 'deepseek' },
      }),
      msg({
        id: 'lo',
        time: { created: 300 },
        type: 'location-switched',
        location: { directory: '/repo' },
      }),
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'agent-switched',
      agent: 'reviewer',
      previous: 'develop',
    });
    expect(entries[1]).toMatchObject({
      kind: 'agent-switched',
      previous: null,
    });
    expect(entries[2]).toMatchObject({
      kind: 'model-switched',
      model: { id: 'gpt' },
      previous: { id: 'deepseek' },
    });
    expect(entries[3]).toMatchObject({
      kind: 'location-switched',
      directory: '/repo',
    });
  });

  it('projects system, synthetic, skill and shell entries', () => {
    const entries = buildHistory([
      msg({
        id: 'sy',
        time: { created: 1 },
        type: 'system',
        text: 'sys',
        description: 'desc',
      }),
      msg({ id: 'sn', time: { created: 2 }, type: 'synthetic', text: 'syn' }),
      msg({
        id: 'sk',
        time: { created: 3 },
        type: 'skill',
        skill: 'commit-conventions',
        name: 'Commit conventions',
        text: 'body',
      }),
      msg({
        id: 'sh',
        time: { created: 4 },
        type: 'shell',
        shellID: 'sh1',
        command: 'ls',
        status: 'exited',
        exit: 0,
      }),
      msg({
        id: 'sh2',
        time: { created: 5 },
        type: 'shell',
        shellID: 'sh2',
        command: 'boom',
        status: 'killed',
        exit: 'Infinity',
      }),
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'system',
      text: 'sys',
      description: 'desc',
    });
    expect(entries[1]).toMatchObject({
      kind: 'synthetic',
      text: 'syn',
      description: null,
    });
    expect(entries[2]).toMatchObject({
      kind: 'skill',
      skill: 'commit-conventions',
      name: 'Commit conventions',
      text: 'body',
    });
    expect(entries[3]).toMatchObject({
      kind: 'shell',
      command: 'ls',
      status: 'exited',
      exit: 0,
    });
    expect(entries[4]).toMatchObject({
      kind: 'shell',
      command: 'boom',
      status: 'killed',
      exit: null,
    });
  });

  it('marks compaction episodes with their real status', () => {
    const entries = buildHistory([
      msg({
        id: 'c1',
        time: { created: 1 },
        type: 'compaction',
        status: 'running',
        reason: 'auto',
        summary: 's1',
        recent: 'r1',
      }),
      msg({
        id: 'c2',
        time: { created: 2 },
        type: 'compaction',
        status: 'completed',
        reason: 'manual',
        summary: 's2',
        recent: 'r2',
      }),
      msg({
        id: 'c3',
        time: { created: 3 },
        type: 'compaction',
        status: 'failed',
        reason: 'auto',
        error: { type: 'api', message: 'boom' },
      }),
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'compaction',
      status: 'running',
      reason: 'auto',
      summary: 's1',
    });
    expect(entries[1]).toMatchObject({
      kind: 'compaction',
      status: 'completed',
      reason: 'manual',
      summary: 's2',
    });
    expect(entries[2]).toMatchObject({
      kind: 'compaction',
      status: 'failed',
      summary: null,
    });
  });

  it('keeps each compaction status in its chronological position', () => {
    const entries = buildHistory([
      msg({
        id: 'c-run',
        time: { created: 1 },
        type: 'compaction',
        status: 'running',
        reason: 'auto',
        summary: 's1',
        recent: 'r1',
      }),
      msg(user({ id: 'u-mid', time: { created: 2 }, text: 'mid' })),
      msg({
        id: 'c-ok',
        time: { created: 3 },
        type: 'compaction',
        status: 'completed',
        reason: 'manual',
        summary: 's2',
        recent: 'r2',
      }),
      msg(user({ id: 'u-mid2', time: { created: 4 }, text: 'mid2' })),
      msg({
        id: 'c-bad',
        time: { created: 5 },
        type: 'compaction',
        status: 'failed',
        reason: 'auto',
        error: { type: 'api', message: 'boom' },
      }),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      'compaction',
      'user',
      'compaction',
      'user',
      'compaction',
    ]);
    expect(
      entries
        .filter((entry) => entry.kind === 'compaction')
        .map((entry) => entry.status),
    ).toEqual(['running', 'completed', 'failed']);
  });

  it('never presents a failed compaction as successful', () => {
    const entries = buildHistory([
      msg({
        id: 'c-ok',
        time: { created: 1 },
        type: 'compaction',
        status: 'completed',
        reason: 'manual',
        summary: 'resumen',
        recent: 'r',
      }),
      msg({
        id: 'c-bad',
        time: { created: 2 },
        type: 'compaction',
        status: 'failed',
        reason: 'auto',
        error: { type: 'api', message: 'boom' },
      }),
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'compaction',
      status: 'completed',
      summary: 'resumen',
    });
    expect(entries[1]).toMatchObject({
      kind: 'compaction',
      status: 'failed',
      summary: null,
    });
    expect(entries[1]).not.toMatchObject({ status: 'completed' });
  });

  it('projects idle outcomes', () => {
    const entries = buildHistory([
      msg({ id: 'i1', time: { created: 1 }, type: 'idle', outcome: 'succeeded' }),
      msg({ id: 'i2', time: { created: 2 }, type: 'idle', outcome: 'failed' }),
      msg({
        id: 'i3',
        time: { created: 3 },
        type: 'idle',
        outcome: 'interrupted',
      }),
    ]);

    expect(
      entries.map((entry) => (entry.kind === 'idle' ? entry.outcome : null)),
    ).toEqual(['succeeded', 'failed', 'interrupted']);
  });

  it('maps tool parts to their real state, result and error', () => {
    const entries = buildHistory([
      msg(
        assistant([
          tool({
            id: 't-ok',
            name: 'read',
            state: {
              status: 'completed',
              input: { path: 'a.ts' },
              content: [{ type: 'text', text: 'contents' }],
            },
            time: { created: 100, completed: 250 },
          }),
          tool({
            id: 't-err',
            name: 'bash',
            state: {
              status: 'error',
              input: { command: 'x' },
              error: { type: 'api', message: 'boom' },
            },
            time: { created: 300, completed: 400 },
          }),
          tool({
            id: 't-run',
            name: 'grep',
            state: { status: 'running', input: { q: 'x' }, metadata: {} },
            time: { created: 500 },
          }),
        ]),
      ),
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'tool',
      entry: {
        id: 't-ok',
        name: 'read',
        status: 'completed',
        result: 'contents',
        error: null,
        startedAt: 100,
        completedAt: 250,
        durationMs: 150,
      },
    });
    expect(entries[1]).toMatchObject({
      kind: 'tool',
      entry: {
        id: 't-err',
        status: 'error',
        result: null,
        error: 'boom',
        durationMs: 100,
      },
    });
    expect(entries[2]).toMatchObject({
      kind: 'tool',
      entry: {
        id: 't-run',
        status: 'running',
        result: null,
        error: null,
        completedAt: null,
        durationMs: null,
      },
    });
  });

  it('returns an empty history for no messages', () => {
    expect(buildHistory([])).toEqual([]);
  });

  describe('questions (FR-033)', () => {
    const question = (
      overrides: Partial<THistoryQuestion> = {},
    ): THistoryQuestion => ({
      id: 'q1',
      title: '¿Qué hago?',
      fields: [
        {
          key: 'choice',
          title: 'Opción',
          type: 'multiselect',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
      state: 'answered',
      answer: 'choice: a',
      ...overrides,
    });

    const questionTool = (
      id: string,
      input: Record<string, string>,
    ): SessionMessageAssistantTool =>
      tool({
        id,
        name: 'question',
        state: { status: 'completed', input, content: [{ type: 'text', text: 'ok' }] },
      });

    it('anchors the question to its tool call and replaces it in position', () => {
      const entries = buildHistory(
        [
          msg(user({ id: 'u1', time: { created: 100 }, text: 'antes' })),
          msg(
            assistant([questionTool('t-q', { question: '¿Qué hago?' })], {
              id: 'a1',
              time: { created: 200, completed: 250 },
            }),
          ),
          msg(user({ id: 'u2', time: { created: 300 }, text: 'después' })),
        ],
        { questions: [question()] },
      );

      expect(entries.map((entry) => entry.kind)).toEqual([
        'user',
        'question',
        'user',
      ]);
      expect(entries[1]).toMatchObject({
        kind: 'question',
        id: 'question:q1',
        at: 200,
        formId: 'q1',
        state: 'answered',
        answer: 'choice: a',
        anchorId: 't-q',
        anchored: true,
      });
      // El tool call ancla no se duplica como entrada de herramienta.
      expect(entries.some((entry) => entry.kind === 'tool')).toBe(false);
    });

    it('matches each question to its anchor by title, regardless of order', () => {
      const entries = buildHistory(
        [
          msg(
            assistant(
              [
                questionTool('t-q1', { question: 'Primera' }),
                questionTool('t-q2', { question: 'Segunda' }),
              ],
              { id: 'a1', time: { created: 100, completed: 150 } },
            ),
          ),
        ],
        {
          questions: [
            question({ id: 'q2', title: 'Segunda' }),
            question({ id: 'q1', title: 'Primera' }),
          ],
        },
      );

      const byForm = Object.fromEntries(
        entries
          .filter((entry) => entry.kind === 'question')
          .map((entry) => [entry.formId, entry]),
      );
      expect(byForm['q1']).toMatchObject({ anchorId: 't-q1' });
      expect(byForm['q2']).toMatchObject({ anchorId: 't-q2' });
    });

    it('distinguishes pending and cancelled questions from answered ones', () => {
      const entries = buildHistory(
        [
          msg(
            assistant([questionTool('t-q1', { question: 'Pendiente' })], {
              id: 'a1',
              time: { created: 100, completed: 150 },
            }),
          ),
          msg(
            assistant([questionTool('t-q2', { question: 'Cancelada' })], {
              id: 'a2',
              time: { created: 200, completed: 250 },
            }),
          ),
        ],
        {
          questions: [
            question({ id: 'q1', title: 'Pendiente', state: 'pending', answer: null }),
            question({
              id: 'q2',
              title: 'Cancelada',
              state: 'cancelled',
              answer: null,
            }),
          ],
        },
      );

      const [pending, cancelled] = entries;
      expect(pending).toMatchObject({ kind: 'question', state: 'pending', answer: null });
      expect(cancelled).toMatchObject({
        kind: 'question',
        state: 'cancelled',
        answer: null,
      });
      expect(pending).not.toMatchObject({ state: 'answered' });
      expect(cancelled).not.toMatchObject({ state: 'answered' });
    });

    it('appends the question at the end when no anchor is available', () => {
      const entries = buildHistory(
        [msg(user({ id: 'u1', time: { created: 100 }, text: 'solo' }))],
        { questions: [question({ id: 'orphan' })] },
      );

      expect(entries.map((entry) => entry.kind)).toEqual(['user', 'question']);
      expect(entries[1]).toMatchObject({
        kind: 'question',
        formId: 'orphan',
        anchorId: null,
        anchored: false,
      });
      expect(entries[1].at).toBeGreaterThan(entries[0].at);
    });

    it('keeps a question tool call as a tool entry when there is no question', () => {
      const entries = buildHistory([
        msg(
          assistant([questionTool('t-q', { question: '¿Qué hago?' })], {
            id: 'a1',
            time: { created: 100, completed: 150 },
          }),
        ),
      ]);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ kind: 'tool', entry: { id: 't-q' } });
    });
  });
});
