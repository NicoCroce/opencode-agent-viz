import type {
  FileDiffInfo,
  InstructionEntryInfo,
  PermissionRequest,
  SessionInfo,
  SessionLogItem,
  SessionMessageInfo,
  SessionStatsInfo,
  SessionStatsInput,
  SessionStatus,
  SessionTransferData,
} from '@opencode/client';
import { opencodeClient } from './client';
import { collectAllMessages, MESSAGE_PAGE_SIZE } from './lib/messagePagination';
import { normalizeMessages, type TSessionMessage } from './message.entity';

/** Lecturas scopeadas por sesión del SDK (FR-016). */
export interface SessionReadService {
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
}

export const sessionReadService: SessionReadService = {
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
    return normalizeMessages(await collectAllMessages(opencodeClient, id));
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
};
