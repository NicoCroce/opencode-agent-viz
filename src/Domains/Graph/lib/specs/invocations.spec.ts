import { describe, expect, it } from 'vitest';
import type { JsonValue, SessionStructuredError, ToolContent } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { assistantMessage } from './fixtures';
import { textPart } from '../eventReduce/messageParts';
import type { TInvocationBatch } from '../invocations';
import { deriveInvocationBatches, deriveInvocations } from '../invocations';

/**
 * Spec puro de la unidad de paralelismo por **invocación** (feature 011, US5).
 *
 * Fija `contracts/invocation-lanes-contract.md` §1-§2 y `data-model.md` §4-§5:
 * cada tool part `subagent`/`task` del padre aporta una invocación (sesión,
 * paso, tiempos y estado), y `deriveInvocationBatches` agrupa por `stepId`, de
 * modo que una hija **reutilizada en dos pasos** produce dos invocaciones y
 * participa en **dos** lotes.
 *
 * `../invocations` ya existe (T035), así que este spec es **verde** y sus
 * literales del SDK están tipados contra los tipos reales (`ToolPart`,
 * `ToolContent`, `SessionStructuredError`), no contra formas laxas: los datos de
 * prueba no deben poder desviarse del contrato del SDK (Constitución VIII).
 */

type TToolPart = Extract<TSessionMessage['parts'][number], { type: 'tool' }>;

interface TCall {
  id: string;
  sessionId: string | null;
  created: number;
  completed?: number;
  name?: 'subagent' | 'task' | 'bash';
  status?: 'completed' | 'error';
  background?: boolean;
}

/** `state.content` es una tupla no vacía en el SDK; un item basta para el spec. */
const toolContent: [ToolContent, ...ToolContent[]] = [{ type: 'text', text: 'ok' }];

/** `state.error` del SDK no acepta un string: lleva tipo y mensaje. */
const toolError: SessionStructuredError = { type: 'unknown', message: 'boom' };

/** Tool part de un spawn del padre (`subagent`/`task`), con tiempos explícitos. */
const call = ({
  id,
  sessionId,
  created,
  completed,
  name = 'subagent',
  status = 'completed',
  background = false,
}: TCall): TToolPart => {
  const input: Record<string, JsonValue> = background ? { background: true } : {};
  const metadata: Record<string, JsonValue> = sessionId === null ? {} : { sessionID: sessionId };
  const time = completed === undefined ? { created } : { created, completed };

  if (status === 'error') {
    return {
      type: 'tool',
      id,
      name,
      state: { status: 'error', input, error: toolError, content: toolContent, metadata },
      time,
    };
  }

  return {
    type: 'tool',
    id,
    name,
    state: { status: 'completed', input, content: toolContent, metadata },
    time,
  };
};

/** Paso del padre: un mensaje assistant cuyo id es el `stepId` de sus tool calls. */
const step = (
  stepId: string,
  parts: TSessionMessage['parts'],
  created = 10,
): TSessionMessage =>
  assistantMessage({
    id: stepId,
    time: { created, completed: created + 500 },
    content: parts,
  });

/** Proyección estable de los lotes: paso + miembros ordenados (sin el orden). */
const shape = (batches: TInvocationBatch[]): string[] =>
  batches
    .map((b) => `${b.stepId}:${[...b.sessionIds].sort().join('+')}`)
    .sort();

describe('deriveInvocations · contrato invocation-lanes §1', () => {
  it('devuelve una invocación por cada tool part de subagente del padre', () => {
    const invocations = deriveInvocations([
      step('step_1', [
        call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 40 }),
        textPart('lanzo el segundo'),
        call({
          id: 'tool_2',
          sessionId: 'child_b',
          created: 20,
          completed: 60,
          name: 'task',
        }),
        call({ id: 'tool_3', sessionId: null, created: 30, name: 'bash' }),
      ]),
    ]);

    expect(invocations).toEqual([
      {
        sessionId: 'child_a',
        stepId: 'step_1',
        startedAt: 10,
        endedAt: 40,
        status: 'completed',
        toolName: 'subagent',
      },
      {
        sessionId: 'child_b',
        stepId: 'step_1',
        startedAt: 20,
        endedAt: 60,
        status: 'completed',
        toolName: 'task',
      },
    ]);
  });

  it('ignora mensajes que no son assistant y pasos sin tool calls', () => {
    const invocations = deriveInvocations([
      { info: { id: 'user_1', type: 'user', time: { created: 1 }, text: 'hola' }, parts: [] },
      step('step_1', [textPart('sin spawns')]),
      step('step_2', [call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 15 })]),
    ]);

    expect(invocations.map((i) => i.stepId)).toEqual(['step_2']);
  });

  it('una sesión reutilizada en dos pasos produce dos invocaciones, no una fusionada', () => {
    const invocations = deriveInvocations([
      step('step_1', [call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 40 })]),
      step('step_2', [call({ id: 'tool_2', sessionId: 'child_a', created: 200, completed: 240 })]),
    ]);

    expect(invocations).toEqual([
      {
        sessionId: 'child_a',
        stepId: 'step_1',
        startedAt: 10,
        endedAt: 40,
        status: 'completed',
        toolName: 'subagent',
      },
      {
        sessionId: 'child_a',
        stepId: 'step_2',
        startedAt: 200,
        endedAt: 240,
        status: 'completed',
        toolName: 'subagent',
      },
    ]);
  });

  it('sin `metadata.sessionID` la invocación existe con `sessionId: null`', () => {
    const invocations = deriveInvocations([
      step('step_1', [call({ id: 'tool_1', sessionId: null, created: 10 })]),
    ]);

    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.sessionId).toBeNull();
    expect(invocations[0]?.endedAt).toBeNull();
  });

  it('conserva el estado del tool part (`error`) y su fin', () => {
    const invocations = deriveInvocations([
      step('step_1', [
        call({
          id: 'tool_1',
          sessionId: 'child_a',
          created: 10,
          completed: 25,
          status: 'error',
        }),
      ]),
    ]);

    expect(invocations[0]?.status).toBe('error');
    expect(invocations[0]?.endedAt).toBe(25);
  });
});

describe('deriveInvocations · fin de la invocación (FR-016, R9)', () => {
  const backgroundStep = (): TSessionMessage[] => [
    step('step_1', [
      call({
        id: 'tool_1',
        sessionId: 'child_a',
        created: 10,
        completed: 100,
        background: true,
      }),
    ]),
  ];

  it('en foreground el fin es el del tool part del padre', () => {
    const invocations = deriveInvocations([
      step('step_1', [call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 100 })]),
    ]);

    expect(invocations[0]?.endedAt).toBe(100);
  });

  it('con `background` y sin fin de hija conocido mantiene el fin del tool part', () => {
    expect(deriveInvocations(backgroundStep(), {})[0]?.endedAt).toBe(100);
  });

  it('con `background` usa `max(fin del tool part, fin de la sesión hija)`', () => {
    // La hija sobrevive al tool part (caso límite documentado, 0 casos medidos).
    expect(deriveInvocations(backgroundStep(), { child_a: 180 })[0]?.endedAt).toBe(180);
    // El fin de la hija no puede acortar la invocación del padre.
    expect(deriveInvocations(backgroundStep(), { child_a: 60 })[0]?.endedAt).toBe(100);
  });
});

describe('deriveInvocationBatches · contrato invocation-lanes §2', () => {
  it('un paso con 2+ invocaciones es un único lote paralelo (E1)', () => {
    const invocations = deriveInvocations([
      step('step_1', [
        call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 40 }),
        call({ id: 'tool_2', sessionId: 'child_b', created: 12, completed: 45 }),
        call({ id: 'tool_3', sessionId: 'child_c', created: 14, completed: 50 }),
      ]),
    ]);

    const batches = deriveInvocationBatches(invocations);

    expect(shape(batches)).toEqual(['step_1:child_a+child_b+child_c']);
    expect(batches[0]?.sessionIds).toHaveLength(3);
  });

  it('una hija reutilizada en dos pasos da dos invocaciones y dos lotes (E2)', () => {
    const invocations = deriveInvocations([
      step('step_1', [call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 40 })]),
      step('step_2', [call({ id: 'tool_2', sessionId: 'child_a', created: 200, completed: 240 })]),
    ]);

    const batches = deriveInvocationBatches(invocations);

    expect(invocations).toHaveLength(2);
    expect(shape(batches)).toEqual(['step_1:child_a', 'step_2:child_a']);
  });

  it('pasos secuenciales no caen en el mismo lote (E3)', () => {
    const invocations = deriveInvocations([
      step('step_1', [call({ id: 'tool_1', sessionId: 'child_a', created: 10, completed: 40 })]),
      step('step_2', [call({ id: 'tool_2', sessionId: 'child_b', created: 400, completed: 440 })]),
    ]);

    const batches = deriveInvocationBatches(invocations);

    expect(shape(batches)).toEqual(['step_1:child_a', 'step_2:child_b']);
  });

  it('sin invocaciones no hay lotes', () => {
    expect(deriveInvocationBatches([])).toEqual([]);
  });
});
