import { describe, expect, it } from 'vitest';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { deriveAgentMedians } from '../agentLatencyMedians';

const assistant = (
  id: string,
  created: number,
  completed?: number,
): TSessionMessage => ({
  info: {
    id,
    type: 'assistant',
    agent: 'develop',
    model: { id: 'm', providerID: 'p' },
    time: {
      created,
      ...(completed === undefined ? {} : { completed }),
    },
    content: [],
  },
  parts: [],
});

const durations = (...completedAt: Array<number | undefined>): TSessionMessage[] =>
  completedAt.map((completed, index) =>
    assistant(`s${index}`, 0, completed === undefined ? undefined : completed),
  );

describe('deriveAgentMedians · mediana por agente', () => {
  it('agrupa las muestras de todos los nodos de un mismo agente', () => {
    const medians = deriveAgentMedians([
      { agent: 'develop', messages: durations(100, 300) },
      { agent: 'develop', messages: durations(500) },
    ]);

    expect(medians).toEqual({ develop: 300 });
  });

  it('calcula cada agente por separado', () => {
    const medians = deriveAgentMedians([
      { agent: 'develop', messages: durations(100, 200, 300) },
      { agent: 'review', messages: durations(1000, 3000) },
    ]);

    expect(medians.develop).toBe(200);
    expect(medians.review).toBe(2000);
  });
});

describe('deriveAgentMedians · muestras incompletas', () => {
  it('ignora los mensajes sin `time.completed` (totalMs nulo)', () => {
    const medians = deriveAgentMedians([
      { agent: 'develop', messages: durations(undefined, undefined, 600) },
    ]);

    expect(medians.develop).toBe(600);
  });

  it('sin muestras utilizables deja el agente a null', () => {
    const medians = deriveAgentMedians([
      { agent: 'develop', messages: durations(undefined) },
    ]);

    expect(medians.develop).toBeNull();
  });
});

describe('deriveAgentMedians · agentes sin muestras', () => {
  it('devuelve null para un agente sin mensajes', () => {
    const medians = deriveAgentMedians([{ agent: 'develop', messages: [] }]);

    expect(medians).toEqual({ develop: null });
  });

  it('registra todos los agentes vistos y no muta las entradas', () => {
    const messages = durations(400);
    const entries = [
      { agent: 'develop', messages },
      { agent: 'review', messages: [] },
    ];

    const medians = deriveAgentMedians(entries);

    expect(medians).toEqual({ develop: 400, review: null });
    expect(entries[0].messages).toBe(messages);
    expect(messages).toHaveLength(1);
  });

  it('sin entradas devuelve un mapa vacío', () => {
    expect(deriveAgentMedians([])).toEqual({});
  });
});
