import { OpenCode } from '@opencode/client';
import type {
  AgentInfo,
  FileDiffInfo,
  FormDetail,
  FormInfo,
  InstructionEntryInfo,
  McpServer,
  PermissionRequest,
  Project,
  SessionInboxInfo,
  SessionInfo,
  SessionLogItem,
  SessionMessageInfo,
  SessionStatsInfo,
  SessionStatsInput,
  SessionStatus,
  SessionTransferData,
  V2Event,
} from '@opencode/client';

/**
 * Contenido de un mensaje assistant en V2. Antes era `Part[]` con un tipo por
 * parte; V2 lo aplana en `content` con tres variantes (text | reasoning | tool).
 */
export type TContentPart = Extract<
  SessionMessageInfo,
  { type: 'assistant' }
>['content'][number];

/**
 * Forma normalizada que consume el resto de la app. V2 devuelve los mensajes
 * planos (`SessionMessageInfo[]`) sin separar info y partes; envolvemos cada
 * mensaje para no obligar a cada consumidor a discriminar por `type`.
 */
export interface TSessionMessage {
  info: SessionMessageInfo;
  parts: TContentPart[];
}

/**
 * Unique punto de acceso al SDK de OpenCode (Constitución III).
 * Read-only: solo se exponen métodos de lectura (FR-016).
 *
 * Todos los endpoints scopeados por proyecto aceptan `location.directory`: el
 * server resuelve el proyecto a partir de ese path, por lo que sin él solo se
 * ven las sesiones del `cwd` del server.
 */

/**
 * El cliente V2 resuelve cada ruta con `new URL(path, baseUrl)`, así que
 * `baseUrl` debe ser ABSOLUTA: un pathname relativo revienta con
 * `TypeError: Invalid URL`. En el browser apuntamos al proxy `/oc` de Vite,
 * que reescribe `/oc/api/...` hacia el background service de OpenCode
 * (configurable por `OPENCODE_URL`); el fallback 4096 aplica a SSR/tests.
 */
export const resolveBaseUrl = (): string => {
  const base =
    typeof window === 'undefined'
      ? 'http://127.0.0.1:4096'
      : `${window.location.origin}/oc`;
  return new URL(base).href;
};

export const opencodeClient = OpenCode.make({ baseUrl: resolveBaseUrl() });

/** `SessionMessageInfo` -> `{ info, parts }` con `content` en `parts`. */
export const normalizeMessages = (
  messages: SessionMessageInfo[],
): TSessionMessage[] =>
  messages.map((info) => ({
    info,
    parts: info.type === 'assistant' ? info.content : [],
  }));

/** V2 capa `limit` en 200 por request; paginamos con cursor hasta este tope. */
const MESSAGE_PAGE_SIZE = 200;
const MESSAGE_MAX_PAGES = 25;

export interface OpenCodeService {
  listProjects: () => Promise<Project[]>;
  listSessions: (directory?: string) => Promise<SessionInfo[]>;
  /**
   * V2 eliminó `session.status`. `session.active()` devuelve solo las sesiones
   * en curso como `{ [sessionID]: { type: 'running' } }`; las que no aparecen
   * están ociosas. El resto del detalle (retry) llega por el evento
   * `session.status`.
   */
  getActiveSessions: () => Promise<Record<string, SessionStatus>>;
  getSessionMessages: (
    id: string,
    directory?: string,
  ) => Promise<TSessionMessage[]>;
  /**
   * Histórico paginado por cursor, sin tope fijo (FR-013). Devuelve una página
   * (200 mensajes) y el cursor de la siguiente; la primera página es la más
   * reciente (`order: 'desc'`). El cursor ya fija la dirección, así que no se
   * combina con `order`.
   */
  getHistoryMessages: (
    id: string,
    cursor?: string,
  ) => Promise<{ messages: TSessionMessage[]; nextCursor: string | null }>;
  /** Impacto del agente en el repositorio (FR-028..FR-030). */
  getSessionDiff: (id: string) => Promise<FileDiffInfo[]>;
  /** Agregado por proyecto/rango (expuesto, no cableado — R2/R10). */
  getSessionStats: (input?: SessionStatsInput) => Promise<SessionStatsInfo>;
  /** Preguntas al usuario de una sesión (FR-032). */
  listSessionForms: (id: string) => Promise<FormInfo[]>;
  getSessionForm: (id: string, formID: string) => Promise<FormDetail>;
  /** Cola de turnos e items de inbox (FR-034). */
  listSessionInbox: (id: string) => Promise<SessionInboxInfo[]>;
  /** Contexto resultante de una compactación (FR-035). */
  getSessionContext: (id: string) => Promise<SessionMessageInfo[]>;
  /** Log durable (`follow: false`) para sembrar señales de ejecución (US3). */
  getSessionLog: (id: string) => Promise<SessionLogItem[]>;
  /** Export completo (expuesto, no cableado — R2/R3). */
  exportSession: (
    id: string,
    sanitize?: boolean,
  ) => Promise<SessionTransferData>;
  getSessionPermissions: (id: string) => Promise<PermissionRequest[]>;
  getSessionInstructions: (id: string) => Promise<InstructionEntryInfo[]>;
  listAgents: (directory?: string) => Promise<AgentInfo[]>;
  getMcpServers: (directory?: string) => Promise<McpServer[]>;
  /**
   * Un unico stream SSE global (`GET /api/event`, sin `location`). El cliente
   * V2 comparte la conexion entre suscriptores y NO reconecta solo: si el
   * iterador termina, hay que volver a suscribirse.
   */
  subscribeEvents: (signal?: AbortSignal) => AsyncIterable<V2Event>;
}

export const opencodeService: OpenCodeService = {
  async listProjects() {
    return opencodeClient.project.list();
  },
  async listSessions(directory) {
    const { data } = await opencodeClient.session.list({
      directory,
      order: 'desc',
      limit: 200,
    });
    return data;
  },
  async getActiveSessions() {
    const active = await opencodeClient.session.active();
    const statuses: Record<string, SessionStatus> = {};
    for (const sessionID of Object.keys(active)) {
      statuses[sessionID] = { type: 'busy' };
    }
    return statuses;
  },
  async getSessionMessages(id) {
    // V2 limita `limit` a 200 por página (pedir más da error de validación), así
    // que paginamos con el cursor para no truncar métricas de sesiones largas.
    // El cursor ya fija la dirección: la API rechaza `cursor` + `order`.
    const messages: SessionMessageInfo[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MESSAGE_MAX_PAGES; page += 1) {
      const { data, cursor: next } = await opencodeClient.message.list({
        sessionID: id,
        limit: MESSAGE_PAGE_SIZE,
        ...(cursor === undefined ? { order: 'asc' as const } : { cursor }),
      });
      messages.push(...data);
      if (!next.next) break;
      cursor = next.next;
    }
    return normalizeMessages(messages);
  },
  async getHistoryMessages(id, cursor) {
    // Una sola página por llamada: el cursor se expone al `useInfiniteQuery`
    // para la carga progresiva. La 1ª página es la más reciente (`desc`).
    const { data, cursor: page } = await opencodeClient.message.list({
      sessionID: id,
      limit: MESSAGE_PAGE_SIZE,
      ...(cursor === undefined ? { order: 'desc' as const } : { cursor }),
    });
    return {
      messages: normalizeMessages(data),
      nextCursor: page.next ?? null,
    };
  },
  async getSessionDiff(id) {
    return opencodeClient.session.diff({ sessionID: id });
  },
  async getSessionStats(input) {
    return opencodeClient.session.stats(input);
  },
  async listSessionForms(id) {
    return opencodeClient.session.form.list({ sessionID: id });
  },
  async getSessionForm(id, formID) {
    return opencodeClient.session.form.get({ sessionID: id, formID });
  },
  async listSessionInbox(id) {
    return opencodeClient.session.inbox.list({ sessionID: id });
  },
  async getSessionContext(id) {
    return opencodeClient.session.context({ sessionID: id });
  },
  async getSessionLog(id) {
    // `session.log` es un `AsyncIterable`; con `follow: false` termina solo y lo
    // materializamos en un array para las señales de ejecución (US3).
    const items: SessionLogItem[] = [];
    for await (const item of opencodeClient.session.log({
      sessionID: id,
      follow: false,
    })) {
      items.push(item);
    }
    return items;
  },
  async exportSession(id, sanitize) {
    return opencodeClient.session.export({ sessionID: id, sanitize });
  },
  async getSessionPermissions(id) {
    return opencodeClient.permission.list({ sessionID: id });
  },
  async getSessionInstructions(id) {
    return opencodeClient.session.instructions.entry.list({ sessionID: id });
  },
  async listAgents(directory) {
    const { data } = await opencodeClient.agent.list({
      location: { directory },
    });
    return data;
  },
  async getMcpServers(directory) {
    const { data } = await opencodeClient.mcp.list({ location: { directory } });
    return data;
  },
  subscribeEvents(signal) {
    return opencodeClient.event.subscribe({ signal });
  },
};
