import type {
  AgentInfo,
  ModelInfo,
  ModelRef,
  ModelVariant,
} from '@opencode/client';
import type { THistoryEntry } from '@app/Domains/History';

/**
 * View-models del dominio Chat (Principio IV: prefijo `T`, derivados del SDK de
 * OpenCode). No se redefine ningún tipo del SDK: `SessionMessageInfo`,
 * `ModelInfo`/`ModelVariant`, `AgentInfo`, `PermissionRequest`, `FormInfo` y
 * `SessionStatus` se consumen tal cual; aquí solo viven las formas de vista que
 * proyecta el chat (data-model §2).
 */

/** Parte provisional del mensaje en curso (un delta de texto o razonamiento). */
export interface TChatStreamPart {
  /** Según el delta: `session.text.delta` o `session.reasoning.delta`. */
  kind: 'text' | 'reasoning';
  /** Acumulado por concatenación de `data.delta`. */
  text: string;
  /** `event.created` del último delta (para ordenar). */
  at: number;
}

/**
 * Buffer del stream de una sesión (clave raíz `['chatStream', id]`, fuera de
 * `['sessions']`). Al cambiar `assistantMessageID` el buffer se resetea para
 * acotar la memoria a un único mensaje en curso (data-model §2.1, R2).
 */
export interface TChatStreamBuffer {
  /** Mensaje en curso; su cambio resetea `parts`. */
  assistantMessageID: string;
  /** Partes provisionales indexadas por el `ordinal` del parte del SDK. */
  parts: Record<number, TChatStreamPart>;
}

/** Proyección de `THistoryEntry.kind` para el timeline del chat. */
export type TChatTimelineKind =
  | 'text'
  | 'reasoning'
  | 'tool'
  | 'system'
  | 'question';

/**
 * Entrada del timeline del chat: unión del histórico consolidado y las partes
 * provisionales del buffer (data-model §2.2). Las provisionales llevan
 * `isComplete: false` y se renderizan en texto plano; las consolidadas exponen
 * su `THistoryEntry` de origen para renderizar con `HistoryEntry`/`RichText`.
 */
export interface TChatTimelineEntry {
  /**
   * `messageId:ordinal` (estable) para consolidado;
   * `stream:<messageId>:<ordinal>` para provisional.
   */
  id: string;
  /** `user` = mensaje propio; `agent` = respuesta/razonamiento. */
  role: 'user' | 'agent';
  kind: TChatTimelineKind;
  /** Texto a mostrar (plano si provisional). */
  text: string;
  /** `false` mientras es provisional ("En curso"). */
  isComplete: boolean;
  /** `info.time.created` (consolidado) o `event.created` (provisional). */
  at: number;
  /**
   * Entrada consolidada de origen (`buildHistory`), para renderizar con
   * `HistoryEntry`; `null`/ausente en las provisionales del buffer.
   */
  history?: THistoryEntry | null;
}

/**
 * Ítem de atención: pendiente (permiso o pregunta) del subárbol de la sesión
 * abierta (data-model §2.3). Única fuente de badge, banner, toast y realce.
 */
export interface TAttentionItem {
  /** Estable (id del permiso/form); dedupe de toast. */
  id: string;
  kind: 'permission' | 'question';
  /** Sesión de origen (puede ser una hija). */
  sessionId: string;
  /** Nodo afectado del grafo (para realce); `null` si no está en el subárbol. */
  nodeId: string | null;
  /** Texto breve (acción del permiso o título de la pregunta). */
  title: string;
  /** Instante del pendiente. */
  at: number;
}

/** Opción de razonamiento derivada de `ModelVariant` (data-model §2.4). */
export interface TReasoningOption {
  /** `ModelVariant.id`; `null`/vacío si el modelo no tiene variantes. */
  value: ModelVariant['id'];
  /** Etiqueta de la variante. */
  label: string;
}

/** Opción de modelo del selector, con sus variantes de razonamiento. */
export interface TModelOption {
  /** `ModelInfo.id`. */
  id: ModelInfo['id'];
  /** `ModelInfo.name`. */
  label: ModelInfo['name'];
  /** `{ id, providerID }` base (sin variante). */
  ref: ModelRef;
  /** Variantes de razonamiento del modelo (vacío si no tiene). */
  reasoning: TReasoningOption[];
}

/** Opción de agente del selector (data-model §2.4). */
export interface TAgentOption {
  /** `AgentInfo.id`. */
  id: AgentInfo['id'];
  /** `AgentInfo.name`. */
  label: AgentInfo['name'];
}

/** Selección activa de agente/modelo del compositor (data-model §2.5). */
export interface TChatSelection {
  /** Agente elegido; `null` = no cambiar. */
  agent: AgentInfo['id'] | null;
  /** Modelo + variante elegidos; `null` = no cambiar. */
  model: ModelRef | null;
  /** `true` si difiere del estado vigente del nodo/sesión. */
  isDirty: boolean;
}

/** Borrador del compositor, persistido por sesión (data-model §2.6). */
export interface TChatDraft {
  /** Texto; vacío o solo espacios → no enviable (FR-001). */
  text: string;
  /** Estado de la mutation (`isPending`). */
  isSubmitting: boolean;
  /** `true` cuando el envío fue a la cola (`delivery: 'queue'`). */
  queued: boolean;
}

/** Causa de un fallo de escritura del chat. */
export type TChatWriteErrorCode = 'validation' | 'sdk';

/**
 * Error tipado de la fachada de escritura (`sessionWriteService`). Se lanza
 * antes de tocar la red cuando Zod rechaza la entrada (FR-019) y distingue los
 * fallos de transporte del SDK, para que la UI avise y conserve el estado para
 * reintentar (FR-022).
 */
export class TChatWriteError extends Error {
  readonly code: TChatWriteErrorCode;

  constructor(code: TChatWriteErrorCode, message: string) {
    super(message);
    this.name = 'TChatWriteError';
    this.code = code;
  }
}
