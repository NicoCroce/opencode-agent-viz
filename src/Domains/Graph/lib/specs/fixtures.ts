import type {
  SessionInfo,
  SessionMessageAssistant,
  SessionMessageUser,
  SessionStatus,
  TokenUsageInfo,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';

/**
 * Builders reutilizables para los specs del dominio Graph (feature 006).
 *
 * Viven junto a los specs (`lib/specs/`) porque son datos de prueba, no de
 * producción: reproducen la forma exacta de los tipos del SDK (`SessionInfo`,
 * `SessionStatus` y mensajes) sin redefinirlos (Constitución IV). Cada builder
 * parte de valores estables y deterministas para que los tests no dependan del
 * reloj ni del azar; los campos que importan se sobrescriben por argumento.
 */

/** Directorio por defecto de las sesiones de prueba. */
export const DEFAULT_DIRECTORY = '/repo';

/** `TokenUsageInfo` del SDK con todos los contadores a cero. */
export const zeroTokens = (): TokenUsageInfo => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
});

/**
 * Builder de `SessionInfo`. Por defecto es una raíz (sin `parentID`) con
 * tiempos fijos; pasa `parentID` en `overrides` para construir un subárbol, o
 * cualquier otro campo, incluido `time.created` para ordenar.
 */
export const session = (
  id: string,
  overrides: Partial<SessionInfo> = {},
): SessionInfo => ({
  id,
  projectID: 'proj',
  agent: 'develop',
  cost: 0,
  tokens: zeroTokens(),
  title: `tarea ${id}`,
  time: { created: 1, updated: 2 },
  location: { directory: DEFAULT_DIRECTORY },
  ...overrides,
});

/** `SessionStatus` ocioso (sin actividad en curso). */
export const idleStatus: SessionStatus = { type: 'idle' };

/** `SessionStatus` ocupado (agente corriendo). */
export const busyStatus: SessionStatus = { type: 'busy' };

/**
 * Builder de `SessionStatus` en reintento (variante `retry`). Por defecto trae
 * un intento y una espera deterministas; sobrescribe `attempt`/`message`/`next`
 * si el test lo necesita.
 */
export const retryStatus = (
  overrides: Partial<Extract<SessionStatus, { type: 'retry' }>> = {},
): SessionStatus => ({
  type: 'retry',
  attempt: 2,
  message: 'rate limited',
  next: 1_234,
  ...overrides,
});

/**
 * Builder de respuesta `assistant` normalizada (`TSessionMessage`). `parts`
 * apunta a `content`, igual que `normalizeMessages`, de modo que los specs
 * puedan ejercitar `hasError`/`currentTool` inyectando partes de tool.
 */
export const assistantMessage = (
  overrides: Partial<SessionMessageAssistant> = {},
): TSessionMessage => {
  const info: SessionMessageAssistant = {
    id: 'msg_1',
    time: { created: 2, completed: 5 },
    type: 'assistant',
    agent: 'develop',
    model: { providerID: 'opencode', id: 'deepseek' },
    content: [],
    cost: 0.01,
    tokens: {
      input: 10,
      output: 5,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    ...overrides,
  };
  return { info, parts: info.content };
};

/**
 * Builder de mensaje de usuario normalizado (`TSessionMessage`) con `parts`
 * vacío, igual que `normalizeMessages` para los mensajes no assistant.
 */
export const userMessage = (
  overrides: Partial<SessionMessageUser> = {},
): TSessionMessage => {
  const info: SessionMessageUser = {
    id: 'msg_user_1',
    time: { created: 1 },
    text: 'hola',
    type: 'user',
    ...overrides,
  };
  return { info, parts: [] };
};
