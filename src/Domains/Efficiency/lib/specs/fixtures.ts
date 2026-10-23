import type {
  JsonValue,
  SessionMessageAssistant,
  SessionMessageCompactionCompleted,
  SessionMessageIdle,
  SessionMessageUser,
  SessionStructuredError,
  SessionMessageAssistantTool,
  ToolContent,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';

/**
 * Builders deterministas para los specs del motor de eficiencia (feature 015).
 *
 * Viven junto a los specs (`lib/specs/`) porque son datos de prueba, no de
 * producción: reproducen la forma exacta de los tipos del SDK (`TSessionMessage`)
 * sin redefinirlos. Ningún builder lee el reloj (`Date.now`) ni usa azar; los
 * tiempos parten de una base fija y avanzan con incrementos constantes, de modo
 * que dos ejecuciones producen exactamente el mismo informe.
 */

/** Marca temporal base de todos los fixtures (2023-11-14T22:13:20Z). */
const BASE_TIME = 1_700_000_000_000;

/** Separación por defecto entre los mensajes de un mismo turno. */
const STEP_MS = 1_000;

/** Tokens por defecto de un paso assistant con caché reportada. */
const DEFAULT_TOKENS = {
  input: 1_200,
  output: 320,
  reasoning: 40,
  cache: { read: 900, write: 120 },
} satisfies SessionMessageAssistant['tokens'];

/** Error estructurado por defecto para tools y reintentos. */
const DEFAULT_ERROR: SessionStructuredError = {
  type: 'tool',
  message: 'fallo de herramienta',
};

/** Input canónico por defecto (`read`): clave estable y ruta normalizada. */
const DEFAULT_INPUT: Record<string, JsonValue> = {
  filePath: '/repo/src/session.ts',
};

/**
 * Mensaje `user` normalizado. Por defecto es el primer mensaje (tiempo
 * `BASE_TIME`) con un prompt de más de seis tokens; sobrescribe `time`,
 * `id` o `text` según el caso.
 */
export const buildUser = (
  overrides: Partial<SessionMessageUser> = {},
): TSessionMessage => {
  const info: SessionMessageUser = {
    id: 'msg_user',
    time: { created: BASE_TIME },
    text: 'Revisa el panel de eficiencia de la sesión actual',
    type: 'user',
    ...overrides,
  };
  return { info, parts: [] };
};

/**
 * Mensaje `assistant` normalizado (`parts` apunta a `content`, igual que
 * `normalizeMessages`). Trae tokens, coste y un `content` vacío sustituible;
 * `retry` y `error` se pasan por `overrides` cuando el caso los necesita.
 */
export const buildAssistant = (
  overrides: Partial<SessionMessageAssistant> = {},
): TSessionMessage => {
  const info: SessionMessageAssistant = {
    id: 'msg_assistant',
    time: { created: BASE_TIME + STEP_MS, completed: BASE_TIME + 3 * STEP_MS },
    type: 'assistant',
    agent: 'build',
    model: { providerID: 'opencode', id: 'deepseek-v4' },
    content: [],
    cost: 0.012,
    tokens: DEFAULT_TOKENS,
    ...overrides,
  };
  return { info, parts: info.content };
};

/** Opciones de `buildToolPart`; `state` se deriva del `status` elegido. */
export interface ToolPartOptions {
  id?: string;
  name?: string;
  status?: 'running' | 'completed' | 'error';
  /** Input canónico: mismas claves y rutas para un mismo caso. */
  input?: Record<string, JsonValue>;
  created?: number;
  ran?: number;
  completed?: number;
  executed?: boolean;
  content?: [ToolContent, ...ToolContent[]];
  error?: SessionStructuredError;
}

/**
 * Parte `tool` de un assistant. `time` incluye siempre `created` y `ran`; el
 * `completed` solo aparece en los estados `completed`/`error`. El input es
 * canónico (orden de claves estable) y el nombre por defecto es `read`.
 */
export const buildToolPart = (
  options: ToolPartOptions = {},
): SessionMessageAssistantTool => {
  const {
    id = 'tool_1',
    name = 'read',
    status = 'completed',
    input = DEFAULT_INPUT,
    created = BASE_TIME + STEP_MS,
    ran = BASE_TIME + 2 * STEP_MS,
    completed = BASE_TIME + 3 * STEP_MS,
    executed,
    content = [{ type: 'text', text: 'contenido de la herramienta' }],
    error = DEFAULT_ERROR,
  } = options;

  const time: SessionMessageAssistantTool['time'] =
    status === 'running' ? { created, ran } : { created, ran, completed };

  const state: SessionMessageAssistantTool['state'] =
    status === 'running'
      ? { status, input, metadata: {} }
      : status === 'error'
        ? { status, input, error }
        : { status, input, content };

  return {
    type: 'tool',
    id,
    name,
    executed,
    state,
    time,
  };
};

/**
 * Mensaje `idle` que cierra el turno abierto. Acepta los tres outcomes del SDK
 * (`succeeded`, `failed`, `interrupted`) y sobrescribe id/tiempo por argumento.
 */
export const buildIdle = (
  outcome: SessionMessageIdle['outcome'] = 'succeeded',
  overrides: Partial<SessionMessageIdle> = {},
): TSessionMessage => {
  const info: SessionMessageIdle = {
    id: 'msg_idle',
    time: { created: BASE_TIME + 4 * STEP_MS },
    type: 'idle',
    outcome,
    ...overrides,
  };
  return { info, parts: [] };
};

/**
 * Compactación completada (auto o manual). El motor solo cuenta las
 * `completed`; este builder nunca produce `running`/`failed`.
 */
export const buildCompaction = (
  reason: SessionMessageCompactionCompleted['reason'] = 'auto',
  overrides: Partial<SessionMessageCompactionCompleted> = {},
): TSessionMessage => {
  const info: SessionMessageCompactionCompleted = {
    id: 'msg_compaction',
    time: { created: BASE_TIME + 2 * STEP_MS },
    type: 'compaction',
    status: 'completed',
    reason,
    summary: 'Resumen de la conversación anterior',
    recent: 'Mensajes recientes conservados',
    ...overrides,
  };
  return { info, parts: [] };
};

/** Prompts distintos (≥6 tokens) para que los pares consecutivos sean elegibles. */
const LONG_PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
  'Optimiza el renderizado de turnos largos sin cambiar la presentación',
];

/** Cada cuántos mensajes de la sesión larga se intercala cada variante. */
const LONG_SESSION_TURN_MS = 5_000;

/**
 * Sesión larga y determinista para el test de rendimiento (SC-006).
 *
 * Genera turnos cerrados de cuatro mensajes: `user`, `assistant` con tool,
 * respuesta o compactación, e `idle`. Los turnos alternan variantes estables
 * (escritura, error de tool, reintento, compactación auto/manual y tool lenta)
 * para que el motor recorra ramas reales sin depender del reloj. Devuelve como
 * máximo `count` mensajes; por defecto 200.
 */
export const buildLongSession = (count = 200): TSessionMessage[] => {
  const messages: TSessionMessage[] = [];
  let turn = 0;
  let cursor = BASE_TIME;

  while (messages.length < count) {
    turn += 1;
    const turnStart = cursor;

    messages.push(
      buildUser({
        id: `long-user-${turn}`,
        time: { created: turnStart },
        text: LONG_PROMPTS[(turn - 1) % LONG_PROMPTS.length],
      }),
    );

    const isWriteTurn = turn % 4 === 0;
    const isErrorTurn = turn % 10 === 0;
    const hasRetry = turn % 7 === 0;
    const isSlowTurn = turn % 15 === 0;
    const hasCompaction = isErrorTurn;
    const toolRan = turnStart + 500;
    const toolCompleted = toolRan + (isSlowTurn ? 65_000 : 800 + (turn % 5) * 50);

    const content: SessionMessageAssistant['content'] = [
      { type: 'reasoning', text: `Analizo el turno ${turn} del recorrido largo` },
      buildToolPart({
        id: `long-tool-${turn}`,
        name: isWriteTurn ? 'write' : 'read',
        status: isErrorTurn ? 'error' : 'completed',
        input: isWriteTurn
          ? { filePath: `/repo/src/borrador-${turn}.ts`, content: 'export {};' }
          : { filePath: `/repo/src/modulo-${turn}.ts` },
        created: turnStart + 100,
        ran: toolRan,
        completed: toolCompleted,
      }),
      { type: 'text', text: `Respuesta del turno ${turn} para la prueba` },
    ];

    messages.push(
      buildAssistant({
        id: `long-assistant-${turn}`,
        time: { created: turnStart + 200, completed: turnStart + 2_000 },
        content,
        cost: 0.01 + turn * 0.002,
        tokens: {
          input: 1_000 + turn * 20,
          output: 200 + turn * 5,
          reasoning: 50,
          cache: { read: 700 + turn * 10, write: 80 },
        },
        ...(hasRetry
          ? {
              retry: {
                attempt: 3,
                at: turnStart + 200,
                error: { type: 'api', message: 'límite temporal del proveedor' },
              },
            }
          : {}),
      }),
    );
    cursor = turnStart + 2_500;

    if (hasCompaction) {
      messages.push(
        buildCompaction(turn % 20 === 0 ? 'manual' : 'auto', {
          id: `long-compaction-${turn}`,
          time: { created: cursor },
          summary: `Resumen compactado del turno ${turn}`,
          recent: 'Mensajes recientes conservados',
        }),
      );
      cursor += STEP_MS;
    } else {
      messages.push(
        buildAssistant({
          id: `long-assistant-${turn}-cierre`,
          time: { created: cursor, completed: cursor + 2 * STEP_MS },
          content: [{ type: 'text', text: `Cierre del turno ${turn} sin tool` }],
          cost: 0.004,
          tokens: {
            input: 800 + turn * 10,
            output: 120,
            reasoning: 20,
            cache: { read: 400 + turn * 5, write: 40 },
          },
        }),
      );
      cursor += 2 * STEP_MS;
    }

    messages.push(
      buildIdle('succeeded', {
        id: `long-idle-${turn}`,
        time: { created: cursor },
      }),
    );
    cursor += LONG_SESSION_TURN_MS;
  }

  return messages.slice(0, count);
};
