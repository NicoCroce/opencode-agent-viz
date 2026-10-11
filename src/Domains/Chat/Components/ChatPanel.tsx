import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import {
  Container,
  EmptyScreenError,
  EmptyState,
} from '@app/Application/Components';
import {
  ChatComposer,
  ListSkeleton,
} from '@app/Application/Components/Molecules';
import { ChatAttentionBanner } from '@app/Application/Components/Molecules/ChatAttentionBanner';
import { useEventStream } from '@app/Infrastructure/EventStreamProvider';
import { queryKeys } from '../../queryKeys';
import {
  ChatPendingRequest,
  type TChatPendingPermission,
} from '@app/Application/Components/Molecules/ChatPendingRequest';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import type {
  TAgentOption,
  TAttentionItem,
  TChatSelection,
  TModelOption,
} from '../Chat.entity';
import {
  useAgentOptions,
  useModelOptions,
  useReplyForm,
  useReplyPermission,
} from '../Chat.service';
import {
  useChatController,
  type TChatSelectionSeed,
} from '../Hooks/useChatController';
import { ChatTimeline } from './ChatTimeline';

/**
 * Panel de chat (FR-014; `contracts/chat-panel-contract.md` §1): orquestador
 * que compone la **bandeja de pendientes** (US3), el timeline del mensaje en
 * curso y el compositor sobre la sesión abierta (`:id`).
 *
 * Es presentación pura: toda la lógica (timeline, envío, borrador, delivery)
 * vive en `useChatController`, la **única fuente de lógica** que alimenta por
 * igual la pestaña de escritorio y el tab móvil (AGENTS §9; FR-014). La
 * **bandeja de pendientes** recibe los ítems del subárbol por props (el
 * data-fetching cross-domain se compone en `Infrastructure/WorkspacePage`, nunca
 * importando `@app/Domains/Inspector` desde este componente, Principio II) y
 * delega la respuesta inline en `ChatPendingRequest` (FR-005). Las señales de
 * atención (US5) y los estados de pantalla completos (US6) lo extienden en
 * tareas posteriores.
 */

/**
 * Pendiente accionable del subárbol que compone la bandeja (US3, FR-005/FR-007).
 *
 * El `originSessionId` es el de la sesión que **generó** el pendiente (puede ser
 * una hija/subagente); las mutations `useReplyPermission`/`useReplyForm` lo usan
 * para responder al origen correcto (FR-007).
 */
export type TChatPendingItem =
  | {
      kind: 'permission';
      /** Sesión de origen del pendiente (hija incluida, FR-007). */
      originSessionId: string;
      /** Etiqueta legible del origen (agente/sesión). */
      originLabel: string;
      permission: TChatPendingPermission;
    }
  | {
      kind: 'question';
      /** Sesión de origen del pendiente (hija incluida, FR-007). */
      originSessionId: string;
      /** Etiqueta legible del origen (agente/sesión). */
      originLabel: string;
      question: TQuestionEntry;
    };

/** Identidad estable de un pendiente para dedupe y foco programático. */
const itemKey = (item: TChatPendingItem): string =>
  item.kind === 'permission'
    ? `permission:${item.permission.id}`
    : `question:${item.question.id}`;

/** Identidad estable del set vacío: evita recomputar el efecto cada render. */
const EMPTY_PENDING: TChatPendingItem[] = [];

/** Identidades estables del catálogo vacío (evita re-renders del selector). */
const EMPTY_MODELS: TModelOption[] = [];
const EMPTY_AGENTS: TAgentOption[] = [];

/** Identidad estable del set vacío de atención (evita recomputar el banner). */
const EMPTY_ATTENTION: TAttentionItem[] = [];

/** Semilla vacía estable de la selección ("no cambiar", FR-008). */
const EMPTY_SELECTION_SEED: TChatSelectionSeed = {};

/** Acción por defecto del banner cuando el llamador no aporta navegación. */
const NOOP_GO_TO_REQUEST = () => undefined;

/** Etiqueta textual del badge de atención; el color por sí solo no comunica. */
const attentionLabel = (count: number): string =>
  count === 1 ? '1 pendiente por atender' : `${count} pendientes por atender`;

/**
 * Badge de atención de la pestaña/tab Chat (T053, FR-009;
 * `contracts/attention-contract.md §2`).
 *
 * Presentación pura y reutilizable: lo consume el trigger de la pestaña `Chat`
 * en escritorio (`InspectorPane`) y queda disponible para el tab móvil de primer
 * nivel (US7). Cumple los requisitos de la señal: token de contraste ≥3:1
 * (`bg-status-waiting` sobre `text-surface-0`), marca **no-color** (icono de
 * campana + recuento textual, no solo el color) y `aria-label` textual. Con
 * `count <= 0` no renderiza nada (FR-011).
 */
export const ChatAttentionBadge = ({
  count,
  className,
}: {
  count: number;
  className?: string;
}) => {
  if (count <= 0) return null;

  const label = attentionLabel(count);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="chat-attention-badge"
      className={`ml-1 inline-flex shrink-0 items-center gap-1 rounded-flat bg-status-waiting px-1.5 py-0.5 font-mono text-[11px] font-medium text-surface-0 ${className ?? ''}`}
    >
      <FontAwesomeIcon icon={faBell} className="size-3" aria-hidden />
      <span aria-hidden className="tabular-nums">
        {count}
      </span>
    </span>
  );
};

export interface ChatPanelProps {
  /** Sesión abierta (`:id`): el chat envía y proyecta su timeline. */
  sessionId: string;
  /**
   * Directorio del proyecto de la sesión: scopea el catálogo de modelos y
   * agentes del selector (FR-008). Sin él, los selectores quedan vacíos pero el
   * envío sigue operativo.
   */
  directory?: string | null;
  /**
   * Semilla de la **selección activa** (agente/modelo) con la que arranca
   * `useChatController` (FR-008). La deriva `WorkspacePage` del nodo abierto
   * (`node.data.agentName`/`node.data.model`); sin ella la selección arranca en
   * `null`, que significa "no cambiar" (no reaplica `switch*`).
   */
  selectionSeed?: TChatSelectionSeed;
  /** Visibilidad del razonamiento (FR-002); la posee `WorkspacePage`. */
  showReasoning?: boolean;
  /**
   * Pendientes del subárbol (permisos y preguntas) que la bandeja compone sobre
   * el composer. El cableado cross-domain vive en `Infrastructure/WorkspacePage`
   * (FR-005/FR-007; Principio II).
   */
  pending?: TChatPendingItem[];
  /**
   * Pendientes del subárbol para el **banner de atención** (FR-009/FR-010). Es la
   * misma lista derivada por `useSessionAttention` que alimenta el badge y el
   * toast; el data-fetching cross-domain vive en `Infrastructure/WorkspacePage`.
   * Sin ítems el banner no se monta (FR-011).
   */
  attention?: TAttentionItem[];
  /**
   * Lleva a la **request origen** de un pendiente (FR-010): selecciona la
   * sesión/nodo de origen —hija incluida— y abre la pestaña Chat. El cableado de
   * navegación vive en `WorkspacePage`; aquí solo se reenvía al banner.
   */
  onGoToRequest?: (item: TAttentionItem) => void;
  className?: string;
}

export const ChatPanel = ({
  sessionId,
  directory = null,
  selectionSeed = EMPTY_SELECTION_SEED,
  showReasoning = true,
  pending = EMPTY_PENDING,
  attention = EMPTY_ATTENTION,
  onGoToRequest,
  className,
}: ChatPanelProps) => {
  const {
    timeline,
    text,
    setText,
    send,
    isSubmitting,
    busy,
    isInterrupting,
    interrupt,
    error,
    selection,
    setAgent,
    setModel,
  } = useChatController(sessionId, selectionSeed);

  // Catálogo del selector (FR-008): el SDK solo se toca en el service; aquí se
  // pasan las opciones ya derivadas (`mapModelOptions`) a la molecule.
  const modelsQuery = useModelOptions(directory);
  const agentsQuery = useAgentOptions(directory);

  // Estado de pantalla del timeline (FR-012; Principio VI). `ChatPanel` **no**
  // registra la query de mensajes (la siembra el grafo/el reducer de eventos en
  // la clave compartida `sessions.messages`): solo **observa** el estado de esa
  // misma entrada de caché, sin disparar una segunda petición ni pisar el
  // `queryFn` de otros consumidores (p. ej. el Inspector). `pending`/ausente =
  // carga; `error` = error; `success` con timeline vacío = vacío; con entradas =
  // datos. No duplica la lógica de estados del resto del visor.
  const queryClient = useQueryClient();
  const messagesState = queryClient.getQueryState(
    queryKeys.sessions.messages(sessionId),
  );
  const isMessagesError = messagesState?.status === 'error';
  const isMessagesLoading =
    messagesState === undefined || messagesState.status === 'pending';
  const isMessagesEmpty =
    !isMessagesError && !isMessagesLoading && timeline.length === 0;

  // Canal en vivo (FR-012): la fuente de verdad es el estado del stream global
  // (`EventStreamProvider`). Con el stream caído o reconectando se avisa al
  // **intentar enviar** que la respuesta en vivo puede no llegar.
  const { state: connectionState } = useEventStream();
  const [attemptedSend, setAttemptedSend] = useState(false);

  const models = modelsQuery.data ?? EMPTY_MODELS;
  const agents = agentsQuery.data ?? EMPTY_AGENTS;

  // La variante de razonamiento se acota al modelo elegido (FR-008, P6).
  const reasoning = useMemo(
    () => models.find((model) => model.id === selection.model?.id)?.reasoning ?? [],
    [models, selection.model?.id],
  );

  const handleSelectionChange = (next: TChatSelection) => {
    setAgent(next.agent);
    setModel(next.model);
  };

  // El envío real lo decide `useChatController` (ignora texto vacío, FR-001);
  // aquí solo se recuerda que hubo un intento para poder avisar del canal caído
  // (FR-012) sin mostrar el aviso antes de que el usuario interactúe.
  const handleSubmit = () => {
    if (text.trim().length > 0) setAttemptedSend(true);
    send(text);
  };

  const replyPermission = useReplyPermission();
  const replyForm = useReplyForm();

  // Foco programático al **pendiente nuevo** (FR-021): se recuerda el set previo
  // y solo se enfoca el que aparece; en el primer render no se roba el foco.
  const [focusId, setFocusId] = useState<string | null>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const pendingSignature = pending.map(itemKey).join('|');

  useEffect(() => {
    const keys = pendingSignature.length > 0 ? pendingSignature.split('|') : [];
    const previous = seenRef.current;
    seenRef.current = new Set(keys);
    if (!previous) return;
    const appeared = keys.find((key) => !previous.has(key));
    if (appeared) setFocusId(appeared);
  }, [pendingSignature]);

  return (
    <Container
      space="small"
      data-testid="chat-panel"
      className={`h-full min-h-0 ${className ?? ''}`}
    >
      {/* Banner de atención (T055, FR-009/FR-010): resume el pendiente más
          antiguo del subárbol y ofrece la acción a su request origen. Sin
          pendientes `ChatAttentionBanner` no renderiza (FR-011). */}
      <ChatAttentionBanner
        items={attention}
        onGoToRequest={onGoToRequest ?? NOOP_GO_TO_REQUEST}
        className="shrink-0"
      />

      <Container block className="min-h-0 flex-1 overflow-auto">
        {/* Estados de pantalla del timeline (FR-012; Principio VI): error →
            carga → vacío → datos. `ChatTimeline` se mantiene montado en todos
            los estados para no perder el punto de anclaje/aria del hilo. */}
        {isMessagesError ? (
          <EmptyScreenError message="No se pudieron cargar los mensajes de la sesión." />
        ) : null}

        {!isMessagesError && isMessagesLoading ? (
          <Container
            data-testid="chat-loading"
            role="status"
            space="small"
            className="shrink-0"
          >
            <span className="sr-only">Cargando conversación</span>
            <ListSkeleton lines={4} />
          </Container>
        ) : null}

        {isMessagesEmpty ? (
          <EmptyState
            title="Sin mensajes todavía"
            description="Escribe un mensaje para empezar la conversación con este agente."
          />
        ) : null}

        <ChatTimeline
          entries={timeline}
          showReasoning={showReasoning}
          sessionId={sessionId}
        />
      </Container>

      {pending.length > 0 ? (
        <Container
          data-testid="chat-pending-tray"
          role="region"
          aria-label="Pendientes del subárbol"
          space="small"
          className="shrink-0 border-t border-border pt-2"
        >
          <span
            role="status"
            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {pending.length === 1
              ? '1 pendiente por responder'
              : `${pending.length} pendientes por responder`}
          </span>

          {pending.map((item) => {
            const key = itemKey(item);
            return (
              <Container
                key={key}
                space="small"
                className="rounded-flat border border-border p-2"
              >
                <span className="text-[11px] text-muted-foreground">
                  Origen: {item.originLabel}
                </span>

                {item.kind === 'permission' ? (
                  <ChatPendingRequest
                    kind="permission"
                    permission={item.permission}
                    isPending={replyPermission.isPending}
                    autoFocus={key === focusId}
                    onReplyPermission={(decision) =>
                      replyPermission.mutate({
                        sessionID: item.originSessionId,
                        requestID: item.permission.id,
                        decision,
                      })
                    }
                  />
                ) : (
                  <ChatPendingRequest
                    kind="question"
                    question={item.question}
                    isPending={replyForm.isPending}
                    autoFocus={key === focusId}
                    onReplyForm={(answer) =>
                      replyForm.mutate({
                        sessionID: item.originSessionId,
                        formID: item.question.id,
                        answer,
                      })
                    }
                  />
                )}
              </Container>
            );
          })}
        </Container>
      ) : null}

      {/* Aviso accesible y conservación del estado ante un fallo de escritura
          (FR-022): `useChatController` solo limpia el borrador al éxito. */}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          No se pudo completar la acción: {error.message}
        </p>
      ) : null}

      {/* Aviso de canal en vivo caído (FR-012): se muestra al intentar enviar
          con el stream `disconnected`/`reconnecting` y desaparece al reconectar.
          `role="status"` (no `alert`) para no colisionar con el aviso de fallo
          de escritura (FR-022). */}
      {attemptedSend && connectionState !== 'connected' ? (
        <p
          role="status"
          data-testid="chat-disconnected-notice"
          className="text-xs text-muted-foreground"
        >
          El canal en vivo no está conectado; la respuesta puede no llegar
          aunque el envío se realice.
        </p>
      ) : null}

      <ChatComposer
        className="shrink-0"
        value={text}
        onChange={setText}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        busy={busy}
        onInterrupt={interrupt}
        isInterrupting={isInterrupting}
        agents={agents}
        models={models}
        reasoning={reasoning}
        selection={selection}
        onSelectionChange={handleSelectionChange}
      />
    </Container>
  );
};
