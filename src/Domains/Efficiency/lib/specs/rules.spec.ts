/**
 * Specs del catálogo de hallazgos (feature 015, engine §6, research R6).
 *
 * Tabla por regla: positivo/negativo, bordes de umbral, ancla obligatoria,
 * severidades, señales débiles separadas, orden determinista y cap 10. Todo se
 * construye con `TFacts` reales (`buildFacts`) y fixtures sin reloj ni azar.
 */
import { describe, expect, it } from 'vitest';
import type {
  SessionMessageAssistant,
  SessionMessageAssistantTool,
} from '@opencode/client';
import type { TFinding, TRuleId } from '../../Efficiency.entity';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import {
  attachTurnSignals,
  buildRuleFindings,
  splitRuleFindings,
} from '../rules';
import { buildFacts, type TFacts } from '../turns';
import {
  buildAssistant,
  buildCompaction,
  buildIdle,
  buildToolPart,
  buildUser,
} from './fixtures';

const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;

const factsFrom = (root: TSessionMessage[]): TFacts =>
  buildFacts({
    rootSessionId: 'root',
    messagesBySession: { root },
    sessions: { root: {} },
  });

const catalogFrom = (root: TSessionMessage[]) =>
  buildRuleFindings(factsFrom(root), 'root');

const ruleIds = (findings: readonly TFinding[]): TRuleId[] =>
  findings.map((finding) => finding.ruleId);

const findingOf = (
  findings: readonly TFinding[],
  ruleId: TRuleId,
): TFinding | undefined => findings.find((finding) => finding.ruleId === ruleId);

const userAt = (index: number, text: string, offset = 0): TSessionMessage =>
  buildUser({
    id: `user-${index}`,
    text,
    time: { created: BASE + index * TURN_MS + offset },
  });

const assistantAt = (
  index: number,
  content: SessionMessageAssistant['content'] = [],
  extra: Partial<SessionMessageAssistant> = {},
): TSessionMessage =>
  buildAssistant({
    id: `assistant-${index}`,
    content,
    time: { created: BASE + index * TURN_MS + 100, completed: BASE + index * TURN_MS + 400 },
    ...extra,
  });

const idleAt = (
  index: number,
  outcome: 'succeeded' | 'failed' | 'interrupted' = 'succeeded',
): TSessionMessage =>
  buildIdle(outcome, {
    id: `idle-${index}`,
    time: { created: BASE + index * TURN_MS + 5_000 },
  });

/** Turno cerrado estándar: user + assistant + idle. */
const closedTurn = (
  index: number,
  text: string,
  content: SessionMessageAssistant['content'] = [],
  extra: Partial<SessionMessageAssistant> = {},
  outcome: 'succeeded' | 'failed' | 'interrupted' = 'succeeded',
): TSessionMessage[] => [
  userAt(index, text),
  assistantAt(index, content, extra),
  idleAt(index, outcome),
];

/** Tool de lectura/escritura con tiempos explícitos dentro de un turno. */
const toolPart = (
  id: string,
  index: number,
  options: {
    name?: string;
    status?: 'completed' | 'error';
    input?: Record<string, string>;
    completedOffset?: number;
    output?: string;
  } = {},
) => {
  const start = BASE + index * TURN_MS + 150;
  return buildToolPart({
    id,
    name: options.name ?? 'read',
    status: options.status ?? 'completed',
    input: options.input ?? { filePath: `/repo/src/${id}.ts` },
    created: start,
    ran: start,
    completed: start + (options.completedOffset ?? 100),
    ...(options.output === undefined
      ? {}
      : { content: [{ type: 'text' as const, text: options.output }] }),
  });
};

const completed = (id: string): TFinding => ({
  ruleId: 'INP-1',
  severity: 'baja',
  dimension: null,
  penalizes: true,
  evidence: { sessionId: 'root', messageId: `msg-${id}` },
  quote: `[msg-${id}] "texto"`,
  condition: 'condición',
  recommendation: 'recomendación',
});

/** Hallazgo con evidencia temporal explícita y sin `turnIndex` (fallback). */
const findingAt = (ruleId: TRuleId, at: number): TFinding => ({
  ...completed(`at-${ruleId}`),
  ruleId,
  evidence: { sessionId: 'root', messageId: `msg-${ruleId}`, at },
});

describe('INP-1 · reformulación', () => {
  // 6 tokens cada uno; los conjuntos de similitud quedan en 5 y 3 → 3/5 = 0,6.
  const ABOVE = 'alpha beta gamma alpha beta gamma';
  const BOUNDARY = 'alpha beta gamma delta epsilon delta';
  const BELOW = 'alpha beta delta epsilon zeta eta';

  it('emite con exactamente 0,6 y cita el segundo pedido', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, ABOVE),
      ...closedTurn(2, BOUNDARY),
    ]);
    const finding = findingOf(catalog.findings, 'INP-1');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('media');
    expect(finding?.dimension).toBe('entrada');
    expect(finding?.penalizes).toBe(true);
    expect(finding?.evidence.messageId).toBe('user-2');
    expect(finding?.quote).toMatch(/^\[turno 2 · user-2 · \d{2}:\d{2}\] "/);
    expect(finding?.condition).toContain('con similitud ≥ 0,6');
  });

  it('no emite por debajo del umbral', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, BOUNDARY),
      ...closedTurn(2, BELOW),
    ]);

    expect(ruleIds(catalog.findings)).not.toContain('INP-1');
    expect(catalog.findings).toEqual([]);
  });

  it('sube a alta con dos o más pares similares', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, BOUNDARY),
      ...closedTurn(2, ABOVE),
      ...closedTurn(3, BOUNDARY),
    ]);

    expect(findingOf(catalog.findings, 'INP-1')?.severity).toBe('alta');
  });

  it('elige el par más antiguo cuando la similitud empata', () => {
    const repeated = 'alpha beta gamma alpha beta gamma';
    const catalog = catalogFrom([
      ...closedTurn(1, repeated),
      ...closedTurn(2, repeated),
      ...closedTurn(3, repeated),
    ]);
    const finding = findingOf(catalog.findings, 'INP-1');

    expect(finding?.evidence.turnIndex).toBe(2);
    expect(finding?.evidence.messageId).toBe('user-2');
    expect(finding?.condition).toContain('2 de 2 pares');
  });
});

describe('INP-2 · interrupción', () => {
  it('emite media cuando el turno se cierra con idle interrumpido', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [], {}, 'interrupted'),
    ]);
    const finding = findingOf(catalog.findings, 'INP-2');

    expect(finding?.severity).toBe('media');
    expect(finding?.evidence.messageId).toBe('idle-1');
    expect(finding?.condition).toContain('1 de 1 turnos cerrados');
  });

  it('emite cuando el siguiente user interrumpe la ejecución', () => {
    const catalog = catalogFrom([
      userAt(1, 'Revisa el estado del panel en la sesión'),
      assistantAt(1, []),
      userAt(2, 'Cambia el layout del grafo ahora mismo'),
    ]);
    const finding = findingOf(catalog.findings, 'INP-2');

    expect(finding?.evidence.messageId).toBe('user-2');
    expect(finding?.quote).toContain('Cambia el layout');
  });

  it('no emite sin interrupciones', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
    ]);

    expect(ruleIds(catalog.findings)).not.toContain('INP-2');
  });
});

describe('INP-3 · aclaración repetida', () => {
  const question = (id: string, index: number) =>
    toolPart(id, index, {
      name: 'question',
      input: { question: '¿Qué archivo debo revisar primero?' },
    });

  it('emite media con una pregunta repetida', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Analiza el panel de eficiencia completo', [question('q1', 1)]),
      ...closedTurn(2, 'Continúa con la revisión del panel', [question('q2', 2)]),
    ]);
    const finding = findingOf(catalog.findings, 'INP-3');

    expect(finding?.severity).toBe('media');
    expect(finding?.evidence.toolId).toBe('q2');
    expect(finding?.condition).toContain('1 de 2 preguntas');
  });

  it('no emite con preguntas distintas', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Analiza el panel de eficiencia completo', [
        question('q1', 1),
      ]),
      ...closedTurn(2, 'Continúa con la revisión del panel', [
        toolPart('q2', 2, {
          name: 'question',
          input: { question: '¿Qué métrica quieres revisar en detalle?' },
        }),
      ]),
    ]);

    expect(ruleIds(catalog.findings)).not.toContain('INP-3');
  });
});

describe('INP-4 · restricción tardía', () => {
  const write = (id: string, index: number) =>
    toolPart(id, index, {
      name: 'write',
      input: { filePath: '/repo/src/config.ts' },
    });

  it('emite señal débil tras la primera escritura y la reedición', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Escribe el archivo de configuración inicial', [write('w1', 1)]),
      ...closedTurn(2, 'No modifiques el layout, solo el archivo de configuración', [
        toolPart('w2', 2, {
          name: 'write',
          input: { filePath: '/repo/src/config.ts' },
          output: 'contenido actualizado',
        }),
      ]),
    ]);
    const finding = findingOf(catalog.weakSignals, 'INP-4');

    expect(finding?.penalizes).toBe(false);
    expect(finding?.severity).toBe('baja');
    expect(finding?.dimension).toBeNull();
    expect(finding?.evidence.messageId).toBe('user-2');
    expect(finding?.evidence.toolId).toBe('w2');
    expect(catalog.findings).toEqual([]);
  });

  it('no emite sin marcador de restricción', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Escribe el archivo de configuración inicial', [write('w1', 1)]),
      ...closedTurn(2, 'Modifica el archivo de configuración otra vez', [
        write('w2', 2),
      ]),
    ]);

    expect(ruleIds(catalog.weakSignals)).not.toContain('INP-4');
  });

  it('no emite cuando la reedición llega después de 2 pasos', () => {
    const start = BASE + 2 * TURN_MS;
    const messages: TSessionMessage[] = [
      ...closedTurn(1, 'Escribe el archivo de configuración inicial', [write('w1', 1)]),
      userAt(2, 'No modifiques el layout, solo el archivo de configuración'),
      buildAssistant({
        id: 'a2-1',
        content: [],
        time: { created: start + 100, completed: start + 200 },
      }),
      buildAssistant({
        id: 'a2-2',
        content: [],
        time: { created: start + 300, completed: start + 400 },
      }),
      buildAssistant({
        id: 'a2-3',
        content: [
          buildToolPart({
            id: 'w2',
            name: 'write',
            input: { filePath: '/repo/src/config.ts' },
            created: start + 550,
            ran: start + 550,
            completed: start + 650,
          }),
        ],
        time: { created: start + 500, completed: start + 600 },
      }),
      idleAt(2),
    ];

    expect(ruleIds(catalogFrom(messages).weakSignals)).not.toContain('INP-4');
  });
});

describe('RES-1 · herramientas fallidas', () => {
  const tools = (
    index: number,
    total: number,
    errors: number,
  ): SessionMessageAssistant['content'] =>
    Array.from({ length: total }, (_, position) =>
      toolPart(`t-${index}-${position}`, index, {
        status: position < errors ? 'error' : 'completed',
      }),
    );

  const session = (total: number, errors: number, outcome: 'succeeded' | 'failed' = 'succeeded') => [
    ...closedTurn(
      1,
      'Ejecuta las herramientas del turno de revisión',
      tools(1, total, errors),
      {},
      outcome,
    ),
  ];

  it('emite con exactamente 10 % de errores', () => {
    const catalog = catalogFrom(session(10, 1));
    const finding = findingOf(catalog.findings, 'RES-1');

    expect(finding?.severity).toBe('media');
    expect(finding?.condition).toContain('1 de 10 llamadas fallaron (10,0 %)');
  });

  it('no emite por debajo de 10 % con menos de 3 errores', () => {
    const catalog = catalogFrom(session(11, 1));

    expect(ruleIds(catalog.findings)).not.toContain('RES-1');
  });

  it('emite con 3 errores aunque el ratio sea menor', () => {
    const catalog = catalogFrom(session(40, 3));

    expect(findingOf(catalog.findings, 'RES-1')?.severity).toBe('media');
  });

  it('sube a alta con ratio ≥ 0,25', () => {
    const catalog = catalogFrom(session(8, 2));

    expect(findingOf(catalog.findings, 'RES-1')?.severity).toBe('alta');
  });

  it('sube a alta cuando contribuye al fallo', () => {
    const catalog = catalogFrom(session(10, 1, 'failed'));

    expect(findingOf(catalog.findings, 'RES-1')?.severity).toBe('alta');
  });

  it('usa la salida de la tool fallida en la cita cuando existe', () => {
    const errorTool: SessionMessageAssistantTool = {
      type: 'tool',
      id: 't-enoent',
      name: 'read',
      state: {
        status: 'error',
        input: { filePath: '/repo/src/a.ts' },
        error: { type: 'tool', message: 'fallo de herramienta' },
        content: [{ type: 'text', text: 'ENOENT: no such file or directory' }],
      },
      time: { created: BASE + 150, ran: BASE + 150, completed: BASE + 250 },
    };
    const messages = [
      userAt(1, 'Ejecuta las herramientas del turno de revisión'),
      assistantAt(1, [errorTool]),
      idleAt(1),
    ];
    const finding = findingOf(catalogFrom(messages).findings, 'RES-1');

    expect(finding?.quote).toContain('ENOENT: no such file or directory');
    expect(finding?.evidence).toMatchObject({
      messageId: 'assistant-1',
      toolId: 't-enoent',
    });
  });

  it('no emite sin ancla (messageId vacío)', () => {
    const catalog = catalogFrom([
      userAt(1, 'Ejecuta las herramientas del turno de revisión'),
      buildAssistant({
        id: '',
        content: [
          toolPart('sin-ancla', 1, { status: 'error' }),
          toolPart('ok', 1),
        ],
        time: { created: BASE + 100, completed: BASE + 400 },
      }),
      idleAt(1),
    ]);

    expect(ruleIds(catalog.findings)).not.toContain('RES-1');
  });
});

describe('RES-2 · reintentos', () => {
  const retry = (attempt: number) => ({
    retry: {
      attempt,
      at: BASE + 200,
      error: { type: 'api' as const, message: 'límite temporal' },
    },
  });

  it('emite alta solo desde attempt 3', () => {
    const below = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel', [], retry(2)),
    ]);
    expect(ruleIds(below.findings)).not.toContain('RES-2');

    const atThreshold = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel', [], retry(3)),
    ]);
    const finding = findingOf(atThreshold.findings, 'RES-2');
    expect(finding?.severity).toBe('alta');
    expect(finding?.dimension).toBe('ejecucion');
    expect(finding?.condition).toContain('intento máximo 3');
  });

  it('emite con 3 reintentos de attempt menor', () => {
    const messages: TSessionMessage[] = [
      userAt(1, 'Revisa el estado del panel en la sesión'),
      assistantAt(1, [], retry(2)),
      assistantAt(2, [], retry(2)),
      assistantAt(3, [], retry(2)),
      idleAt(1),
    ];
    const catalog = catalogFrom(messages);

    expect(findingOf(catalog.findings, 'RES-2')?.severity).toBe('alta');
  });

  it('no emite con 2 reintentos de attempt menor', () => {
    const messages: TSessionMessage[] = [
      userAt(1, 'Revisa el estado del panel en la sesión'),
      assistantAt(1, [], retry(2)),
      assistantAt(2, [], retry(2)),
      idleAt(1),
    ];

    expect(ruleIds(catalogFrom(messages).findings)).not.toContain('RES-2');
  });

  it('cita el intento máximo aunque no sea el último reintento', () => {
    const messages: TSessionMessage[] = [
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [], retry(3)),
      ...closedTurn(2, 'Continúa con la revisión del panel', [], retry(1)),
    ];
    const catalog = catalogFrom(messages);
    const finding = findingOf(catalog.findings, 'RES-2');

    expect(finding?.evidence.messageId).toBe('assistant-1');
    expect(finding?.evidence.turnIndex).toBe(1);
    expect(finding?.quote).toContain('intento 3');
    expect(finding?.condition).toContain('intento máximo 3');
  });

  it('elige el mismo reintento con mensajes en orden inverso', () => {
    const messages: TSessionMessage[] = [
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [], retry(3)),
      ...closedTurn(2, 'Continúa con la revisión del panel', [], retry(1)),
    ];
    const forward = findingOf(catalogFrom(messages).findings, 'RES-2');
    const reversed = findingOf(
      catalogFrom([...messages].reverse()).findings,
      'RES-2',
    );

    expect(reversed?.evidence).toEqual(forward?.evidence);
    expect(reversed?.quote).toBe(forward?.quote);
  });
});

describe('RES-3 · bucle o redundancia', () => {
  it('emite media con 3 llamadas de la misma firma', () => {
    const input = { filePath: '/repo/src/compartido.ts' };
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa los archivos del módulo de sesiones', [
        toolPart('r1', 1, { input, output: 'uno' }),
        toolPart('r2', 1, { input, output: 'dos' }),
        toolPart('r3', 1, { input, output: 'tres' }),
      ]),
    ]);
    const finding = findingOf(catalog.findings, 'RES-3');

    expect(finding?.severity).toBe('media');
    expect(finding?.evidence.toolId).toBe('r2');
  });

  it('emite con 2 salidas exactas iguales sin llegar a 3 firmas', () => {
    const input = { filePath: '/repo/src/compartido.ts' };
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa los archivos del módulo de sesiones', [
        toolPart('r1', 1, { input, output: 'misma salida' }),
        toolPart('r2', 1, { input, output: 'misma salida' }),
      ]),
    ]);

    expect(findingOf(catalog.findings, 'RES-3')?.evidence.toolId).toBe('r2');
  });

  it('no emite con 2 firmas y salidas distintas', () => {
    const input = { filePath: '/repo/src/compartido.ts' };
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa los archivos del módulo de sesiones', [
        toolPart('r1', 1, { input, output: 'uno' }),
        toolPart('r2', 1, { input, output: 'dos' }),
      ]),
    ]);

    expect(ruleIds(catalog.findings)).not.toContain('RES-3');
  });
});

describe('RES-4 · presión de contexto', () => {
  const compaction = (id: string, index: number, reason: 'auto' | 'manual') =>
    buildCompaction(reason, {
      id,
      time: { created: BASE + index * TURN_MS + 2_000 },
    });

  it('con una compactación automática emite señal débil', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      compaction('c1', 1, 'auto'),
    ]);
    const finding = findingOf(catalog.weakSignals, 'RES-4');

    expect(finding?.penalizes).toBe(false);
    expect(finding?.dimension).toBe('contexto');
    expect(finding?.condition).toContain('1 compactación automática');
  });

  it('con dos compactaciones automáticas resta', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      compaction('c1', 1, 'auto'),
      compaction('c2', 1, 'auto'),
    ]);
    const finding = findingOf(catalog.findings, 'RES-4');

    expect(finding?.penalizes).toBe(true);
    expect(finding?.evidence.messageId).toBe('c2');
    expect(finding?.condition).toContain('2 compactaciones');
  });

  it('no cuenta compactaciones manuales', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      compaction('c1', 1, 'manual'),
    ]);

    expect(ruleIds(catalog.weakSignals)).not.toContain('RES-4');
    expect(ruleIds(catalog.findings)).not.toContain('RES-4');
  });
});

describe('RES-5 · coste sin resultado', () => {
  it('emite señal débil con coste y resultado interrumpido', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [], {}, 'interrupted'),
    ]);
    const finding = findingOf(catalog.weakSignals, 'RES-5');

    expect(finding?.penalizes).toBe(false);
    expect(finding?.severity).toBe('media');
    expect(finding?.condition).toContain('interrumpido');
  });

  it('no emite con resultado correcto', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
    ]);

    expect(ruleIds(catalog.weakSignals)).not.toContain('RES-5');
  });

  it('no emite con coste no reportado y resultado interrumpido', () => {
    const catalog = catalogFrom([
      ...closedTurn(
        1,
        'Revisa el estado del panel en la sesión',
        [],
        { cost: undefined },
        'interrupted',
      ),
    ]);

    expect(ruleIds(catalog.weakSignals)).not.toContain('RES-5');
    expect(catalog.weakSignals).toEqual([]);
    expect(
      catalog.findings.some((finding) => finding.condition.includes('Coste ')),
    ).toBe(false);
  });

  it('no inventa ahorro con coste 0 aunque el resultado sea fallido', () => {
    const catalog = catalogFrom([
      ...closedTurn(
        1,
        'Revisa el estado del panel en la sesión',
        [],
        { cost: 0 },
        'failed',
      ),
    ]);

    expect(ruleIds(catalog.findings)).not.toContain('RES-5');
    expect(ruleIds(catalog.weakSignals)).not.toContain('RES-5');
    expect(catalog.findings).toEqual([]);
    expect(catalog.weakSignals).toEqual([]);
  });
});

describe('RES-6 · latencia de herramientas', () => {
  it('emite señal débil cuando el p95 supera 60 s', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [
        toolPart('slow', 1, { completedOffset: 61_000 }),
      ]),
    ]);
    const finding = findingOf(catalog.weakSignals, 'RES-6');

    expect(finding?.penalizes).toBe(false);
    expect(finding?.severity).toBe('baja');
    expect(finding?.evidence.toolId).toBe('slow');
    expect(finding?.condition).toContain('llamadas superaron 60 s');
  });

  it('no emite con exactamente 60 s', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [
        toolPart('edge', 1, { completedOffset: 60_000 }),
      ]),
    ]);

    expect(ruleIds(catalog.weakSignals)).not.toContain('RES-6');
  });

  it('no emite con herramientas rápidas', () => {
    const catalog = catalogFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [
        toolPart('fast', 1, { completedOffset: 59_000 }),
      ]),
    ]);

    expect(ruleIds(catalog.weakSignals)).not.toContain('RES-6');
  });
});

describe('orden, señales y cap', () => {
  it('ordena por severidad, peso de dimensión, turno y regla', () => {
    const catalog = catalogFrom([
      userAt(1, 'Revisa el estado del panel en la sesión'),
      assistantAt(1, [], {
        retry: {
          attempt: 3,
          at: BASE + 200,
          error: { type: 'api', message: 'límite temporal' },
        },
      }),
      assistantAt(2, []),
      userAt(2, 'Cambia el layout del grafo ahora mismo'),
      assistantAt(3, []),
      idleAt(2, 'interrupted'),
      buildCompaction('auto', {
        id: 'c1',
        time: { created: BASE + 2 * TURN_MS + 2_000 },
      }),
      buildCompaction('auto', {
        id: 'c2',
        time: { created: BASE + 2 * TURN_MS + 3_000 },
      }),
    ]);

    expect(ruleIds(catalog.findings)).toEqual(['RES-2', 'INP-2', 'RES-4']);
    expect(catalog.findings.every((finding) => finding.penalizes)).toBe(true);
    expect(catalog.weakSignals.every((finding) => !finding.penalizes)).toBe(true);
  });

  it('capa findings y weakSignals a 10', () => {
    const many = Array.from({ length: 12 }, (_, index) => completed(`x${index}`));
    const weak = many.map((finding) => ({ ...finding, penalizes: false }));
    const catalog = splitRuleFindings([...many, ...weak]);

    expect(catalog.findings).toHaveLength(10);
    expect(catalog.weakSignals).toHaveLength(10);
  });

  it('puebla signals de cada turno con la evidencia en su ventana', () => {
    const messages = [
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [
        toolPart('t1', 1, { status: 'error' }),
      ]),
      ...closedTurn(2, 'Continúa con la revisión del panel', [
        toolPart('t2', 2),
      ]),
    ];
    const facts = factsFrom(messages);
    const catalog = buildRuleFindings(facts, 'root');
    const turns = attachTurnSignals(facts.turns, catalog);

    expect(turns[0].signals).toContain('RES-1');
    expect(turns[1].signals).not.toContain('RES-1');
  });

  it('no asigna la señal de un turno a la ventana del turno anterior', () => {
    const facts = factsFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      ...closedTurn(2, 'Continúa con la revisión del panel'),
    ]);
    const inTurnTwo = findingAt('RES-6', BASE + 2 * TURN_MS + 500);
    const turns = attachTurnSignals(facts.turns, {
      findings: [inTurnTwo],
      weakSignals: [],
    });

    expect(turns[0].signals).toEqual([]);
    expect(turns[1].signals).toEqual(['RES-6']);
  });

  it('trata el borde del siguiente user como inicio del turno nuevo, no del anterior', () => {
    const facts = factsFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      ...closedTurn(2, 'Continúa con la revisión del panel'),
    ]);
    const atBoundary = findingAt('RES-6', BASE + 2 * TURN_MS);
    const turns = attachTurnSignals(facts.turns, {
      findings: [atBoundary],
      weakSignals: [],
    });

    expect(turns[0].signals).toEqual([]);
    expect(turns[1].signals).toEqual(['RES-6']);
  });

  it('deja fuera de todo turno la evidencia posterior al cierre real', () => {
    const facts = factsFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      ...closedTurn(2, 'Continúa con la revisión del panel'),
    ]);
    // Turno 1 cierra en +15 s y el 2 abre en +20 s; el turno 2 cierra en +25 s.
    const betweenCloses = findingAt('RES-6', BASE + TURN_MS + 7_000);
    const afterLastClose = findingAt('RES-1', BASE + 3 * TURN_MS);
    const turns = attachTurnSignals(facts.turns, {
      findings: [betweenCloses, afterLastClose],
      weakSignals: [],
    });

    expect(turns.map((turn) => turn.signals)).toEqual([[], []]);
  });

  it('no asigna una señal sin ancla temporal a ningún turno', () => {
    const facts = factsFrom([
      ...closedTurn(1, 'Revisa el estado del panel en la sesión'),
      ...closedTurn(2, 'Continúa con la revisión del panel'),
    ]);
    const withoutTime: TFinding = {
      ...completed('sin-tiempo'),
      ruleId: 'RES-6',
      evidence: { sessionId: 'root', messageId: 'msg-sin-tiempo' },
    };
    const turns = attachTurnSignals(facts.turns, {
      findings: [withoutTime],
      weakSignals: [],
    });

    expect(turns.map((turn) => turn.signals)).toEqual([[], []]);
  });

  it('es determinista con el mismo hecho', () => {
    const messages = [
      ...closedTurn(1, 'Revisa el estado del panel en la sesión', [
        toolPart('t1', 1, { status: 'error' }),
        toolPart('t2', 1, { status: 'error' }),
      ], {}, 'failed'),
    ];
    const first = buildRuleFindings(factsFrom(messages), 'root');
    const second = buildRuleFindings(factsFrom(messages), 'root');

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
