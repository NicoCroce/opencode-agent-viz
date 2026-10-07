import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OpenCode,
  type SessionInfo,
  type SessionStatus,
  type V2Event,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { buildHistory } from '@app/Domains/History/lib/buildHistory';
import type { TExecutionSignal } from '../../Graph.entity';
import { buildGraph } from '../buildGraph';
import { reduceEvent, type TQueryUpdate } from '../eventReducer';
import { queryKeys } from '../../../queryKeys';

/** Password del background service, tal como la guarda OpenCode. */
const readServicePassword = (): string | undefined => {
  try {
    const configHome =
      process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
    const raw = readFileSync(
      join(configHome, 'opencode', 'service.json'),
      'utf8',
    );
    return (JSON.parse(raw) as { password?: string }).password;
  } catch {
    return undefined;
  }
};

/**
 * El background service vive en un puerto dinámico: hay que apuntarlo
 * explícitamente con `VIZ_API_URL` (usá `pnpm test:live`, que lo descubre con
 * `opencode service status`). La password sale de `OPENCODE_PASSWORD` o, si no,
 * del service.json de OpenCode.
 */
const API = process.env.VIZ_API_URL ?? '';
const password = process.env.OPENCODE_PASSWORD ?? readServicePassword();

/**
 * El server V2 exige HTTP Basic y el puerto es desconocido por defecto, así que
 * esta integración solo corre cuando se proveen `VIZ_API_URL` y la password
 * (`pnpm test:live`). En el run normal queda saltada.
 */
const maybe = API && password ? describe : describe.skip;

maybe('live OpenCode server integration', () => {
  const authorization = `Basic ${Buffer.from(`opencode:${password ?? ''}`).toString(
    'base64',
  )}`;
  const client = OpenCode.make({
    baseUrl: API,
    headers: { authorization },
  });

  it('derives a graph that mirrors the server sessions', async () => {
    const response = await client.session.list({ limit: 50 });
    const sessions = response.data;

    const graph = buildGraph({
      sessions,
      statuses: {},
      agents: [],
      messages: {},
      permissions: [],
      signals: {},
      forms: [],
      inbox: [],
      now: Date.now(),
    });

    expect(graph.nodes).toHaveLength(sessions.length);
    for (const node of graph.nodes) {
      expect(node.data.agentName.length).toBeGreaterThan(0);
    }
  }, 30000);
});

/**
 * `run.v2.ndjson` es la re-captura en eventos V2 de `run.ndjson` (que quedó en
 * la forma V1 `message.updated`/`message.part.updated`). Representa una corrida
 * real de `develop` en `ses_root`: un paso assistant que razona, responde, llama
 * a `read` (éxito), vuelve a responder, llama a `bash` (fallo) y cierra con otra
 * respuesta. Los `ordinal` de `text`/`reasoning` respetan las posiciones reales
 * del contenido, de modo que el reducer reconstruye el intercalado exacto.
 */
const RUN_V2_FIXTURE = join(
  process.cwd(),
  'src/Domains/Graph/lib/__fixtures__/run.v2.ndjson',
);
const RUN_SESSION_ID = 'ses_root';

/** Parsea el NDJSON de eventos V2 versionado como fixture. */
const readRunEvents = (): V2Event[] =>
  readFileSync(RUN_V2_FIXTURE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as V2Event);

/** `true` si el update es un `set` dirigido exactamente a `key`. */
const isSetFor = (
  update: TQueryUpdate,
  key: readonly unknown[],
): update is Extract<TQueryUpdate, { kind: 'set' }> =>
  update.kind === 'set' &&
  update.queryKey.length === key.length &&
  update.queryKey.every((value, index) => value === key[index]);

/**
 * Reconstruye una cache concreta reduciendo los eventos del fixture: aplica
 * solo los updates `set` dirigidos a `key` e ignora invalidaciones y caches
 * ajenas.
 */
const reduceCache = <T>(
  events: V2Event[],
  key: readonly unknown[],
  initial: T,
): T =>
  events.reduce<T>((cache, event) => {
    const updates = reduceEvent(event) ?? [];
    return updates.reduce<T>(
      (acc, update) =>
        isSetFor(update, key) ? (update.updater(acc) as T) : acc,
      cache,
    );
  }, initial);

/** Reconstruye la cache de mensajes de `ses_root` reduciendo los eventos. */
const reduceRunMessages = (events: V2Event[]): TSessionMessage[] =>
  reduceCache<TSessionMessage[]>(
    events,
    queryKeys.sessions.messages(RUN_SESSION_ID),
    [],
  );

/** Reconstruye los estados de sesion (`queryKeys.sessions.status()`). */
const reduceRunStatuses = (
  events: V2Event[],
): Record<string, SessionStatus> =>
  reduceCache<Record<string, SessionStatus>>(
    events,
    queryKeys.sessions.status(),
    {},
  );

/**
 * Reconstruye las senales de ejecucion de `ses_root`
 * (`queryKeys.sessions.execution(id)`): retry, compaction, outcome e
 * interruptReason.
 */
const reduceRunSignals = (
  events: V2Event[],
): Record<string, TExecutionSignal> =>
  reduceCache<Record<string, TExecutionSignal>>(
    events,
    queryKeys.sessions.execution(RUN_SESSION_ID),
    {},
  );

describe('run.v2.ndjson → buildHistory', () => {
  it('derives reasoning, answers and tools in their production order', () => {
    const entries = buildHistory(reduceRunMessages(readRunEvents()));

    expect(entries.map((entry) => entry.kind)).toEqual([
      'reasoning',
      'answer',
      'tool',
      'answer',
      'tool',
      'answer',
    ]);
    expect(
      entries.map((entry) => (entry.kind === 'answer' ? entry.text : null)),
    ).toEqual([
      null,
      'Primero leo el punto de entrada.',
      null,
      'Ahora ejecuto los tests.',
      null,
      'Corrijo los tests que fallan.',
    ]);
  });

  it('preserves each tool real state, result and error', () => {
    const tools = buildHistory(reduceRunMessages(readRunEvents())).filter(
      (entry) => entry.kind === 'tool',
    );

    expect(tools).toHaveLength(2);
    expect(tools[0]).toMatchObject({
      kind: 'tool',
      entry: {
        name: 'read',
        status: 'completed',
        result: 'export const x = 1;',
        error: null,
      },
    });
    expect(tools[1]).toMatchObject({
      kind: 'tool',
      entry: {
        name: 'bash',
        status: 'error',
        result: null,
        error: 'exit 1: 2 tests failed',
      },
    });
  });
});

/**
 * `session.created` trae el `SessionInfo` minimo; el resto de campos los
 * completa el servidor. Para derivar el grafo desde el fixture basta con la
 * identidad y la ubicacion reales de la corrida de `develop` en `ses_root`.
 */
const RUN_SESSION: SessionInfo = {
  id: RUN_SESSION_ID,
  projectID: 'proj',
  agent: 'develop',
  cost: 0.0123,
  tokens: {
    input: 1200,
    output: 300,
    reasoning: 120,
    cache: { read: 400, write: 50 },
  },
  time: { created: 1000, updated: 1200, idle: 1200 },
  title: 'develop',
  location: { directory: '/repo' },
};

/**
 * Construye el grafo del fixture con el contrato completo de `buildGraph`
 * (`signals`, `forms` e `inbox` incluidos): los mensajes, los estados de sesion
 * y las senales de ejecucion se derivan reduciendo los mismos eventos.
 */
const buildRunGraph = (events: V2Event[] = readRunEvents()) =>
  buildGraph({
    sessions: [RUN_SESSION],
    statuses: reduceRunStatuses(events),
    agents: [],
    messages: { [RUN_SESSION_ID]: reduceRunMessages(events) },
    permissions: [],
    signals: reduceRunSignals(events),
    forms: [],
    inbox: [],
    now: 1200,
  });

describe('run.v2.ndjson → buildGraph (estado enriquecido)', () => {
  it('derives one of the 9 valid states from the fixture signals', () => {
    const events = readRunEvents();
    // `session.execution.succeeded` cierra la corrida: outcome terminal.
    expect(reduceRunSignals(events)[RUN_SESSION_ID]?.outcome).toBe(
      'succeeded',
    );

    const [node] = buildRunGraph(events).nodes;
    expect(node.data.status).toBe('succeeded');
    // Sin retry/compaction/interrupcion, esos campos no se exponen.
    expect(node.data.retry).toBeNull();
    expect(node.data.interruptReason).toBeNull();
  });

  it('a failed tool does not tint a succeeded execution (FR-020)', () => {
    const events = readRunEvents();
    const tools = buildHistory(reduceRunMessages(events)).filter(
      (entry) => entry.kind === 'tool',
    );
    // La herramienta `bash` fallo en la misma corrida...
    expect(tools[1]).toMatchObject({
      entry: { name: 'bash', status: 'error' },
    });
    // ...pero el outcome terminal mantiene la ejecucion `succeeded`.
    expect(buildRunGraph(events).nodes[0].data.status).toBe('succeeded');
  });

  it('without the terminal outcome the failed tool marks the execution failed', () => {
    const events = readRunEvents().filter(
      (event) => event.type !== 'session.execution.succeeded',
    );
    // Sin outcome, el error de la herramienta si tine el estado (FR-020).
    expect(buildRunGraph(events).nodes[0].data.status).toBe('failed');
  });
});
