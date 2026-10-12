import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModelRef } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryQuestion } from '@app/Domains/History';
import { queryKeys } from '../../queryKeys';
import { useGetSessionStatus } from '../../Sessions/Sessions.service';
import type {
  TChatSelection,
  TChatStreamBuffer,
  TChatTimelineEntry,
} from '../Chat.entity';
import {
  isSessionBusy,
  useCachedQueryData,
  useInterruptSession,
  useSendPrompt,
  useSetSelection,
} from '../Chat.service';
import { buildChatTimeline } from '../lib/buildChatTimeline';
import { useChatDraft } from './useChatDraft';

/**
 * `useChatController(sessionId)` — **fuente única** de lógica del panel de chat
 * (FR-014; data-model §2.5/§2.6, §5).
 *
 * Desktop y móvil consumen este mismo hook: el timeline lo proyecta la función
 * pura `buildChatTimeline` a partir de la caché (`sessions.messages`, el buffer
 * provisional `chatStream.for(id)` y las preguntas), el estado `busy` se deriva
 * del mapa global de estados (FR-020), el envío delega en `useSendPrompt`, la
 * **selección activa** de agente/modelo se aplica con `useSetSelection` (FR-008,
 * W7) y el borrador se coordina con `useChatDraft` (FR-015). El error de
 * escritura se expone para que el composer avise y conserve el texto (FR-022).
 */

/**
 * Semilla de la selección activa, sembrada desde el **nodo abierto**
 * (`node.data.agentName` / `node.data.model`, data-model §2.5). Ambos campos son
 * opcionales: sin nodo (o sin sesión) la selección arranca en `null`, que
 * significa "no cambiar".
 */
export interface TChatSelectionSeed {
  agent?: string | null;
  model?: ModelRef | null;
}

/** Selección pendiente + baseline aplicado, para decidir "solo si cambió". */
interface TAppliedSelection {
  agent: string | null;
  model: ModelRef | null;
}

/** ¿Los modelos son el mismo `{ id, providerID, variant }`? */
const sameModel = (a: ModelRef, b: ModelRef | null): boolean =>
  b !== null &&
  a.id === b.id &&
  a.providerID === b.providerID &&
  a.variant === b.variant;

/**
 * `isDirty` = algún campo **elegido** (no `null` = no cambiar) difiere del
 * baseline vigente del nodo/sesión (data-model §2.5). `null` nunca ensucia.
 */
const computeDirty = (
  selection: Pick<TChatSelection, 'agent' | 'model'>,
  applied: TAppliedSelection,
): boolean => {
  const agentChanged = selection.agent !== null && selection.agent !== applied.agent;
  const modelChanged =
    selection.model !== null && !sameModel(selection.model, applied.model);
  return agentChanged || modelChanged;
};

/** Estado que el panel (y el composer) consume del controlador. */
export interface TUseChatControllerResult {
  /** Histórico consolidado + partes provisionales, ordenado por `at`. */
  timeline: TChatTimelineEntry[];
  /** `true` si la sesión está ocupada (`SessionStatus.type === 'busy'`). */
  busy: boolean;
  /** `true` mientras la mutation de envío está en curso (`isPending`). */
  isSubmitting: boolean;
  /** `true` cuando el último envío fue a la cola (`delivery: 'queue'`). */
  queued: boolean;
  /** Error de la última escritura (FR-022); `null` si no hubo. */
  error: Error | null;
  /** `true` si se puede interrumpir: la sesión está `busy` (FR-004). */
  canInterrupt: boolean;
  /** `true` mientras la interrupción está en vuelo (`isPending`, FR-004). */
  isInterrupting: boolean;
  /** Interrumpe el turno de la sesión abierta (FR-004); no-op si no está `busy`. */
  interrupt: () => void;
  /** Texto del borrador persistido por sesión (FR-015). */
  text: string;
  /** Reemplaza el texto del borrador y lo persiste. */
  setText: (text: string) => void;
  /** Vacía el borrador persistido. */
  clear: () => void;
  /** Selección activa de agente/modelo y su `isDirty` (FR-008, data-model §2.5). */
  selection: TChatSelection;
  /** Elige agente; `null` = no cambiar (vuelve al valor vigente). */
  setAgent: (agent: string | null) => void;
  /** Elige modelo + variante; `null` = no cambiar. */
  setModel: (model: ModelRef | null) => void;
  /** Envía un prompt (texto vacío o solo espacios se ignora, FR-001). */
  send: (text: string) => void;
}

export const useChatController = (
  sessionId: string,
  seed: TChatSelectionSeed = {},
): TUseChatControllerResult => {
  const statusQuery = useGetSessionStatus();
  const busy = isSessionBusy(statusQuery.data?.[sessionId]);

  const messages = useCachedQueryData<TSessionMessage[]>(
    queryKeys.sessions.messages(sessionId),
  );
  const buffer = useCachedQueryData<TChatStreamBuffer>(
    queryKeys.chatStream.for(sessionId),
  );
  const questions = useCachedQueryData<THistoryQuestion[]>(
    queryKeys.sessions.questions(sessionId),
  );

  const timeline = useMemo(
    () => buildChatTimeline(messages ?? [], buffer ?? null, questions ?? []),
    [messages, buffer, questions],
  );

  const mutation = useSendPrompt(sessionId);
  const selectionMutation = useSetSelection(sessionId);
  const interruptMutation = useInterruptSession(sessionId);
  const [queued, setQueued] = useState(false);

  // Selección activa (estado de vista, data-model §2.5): se siembra desde el
  // nodo abierto y `appliedRef` guarda el baseline vigente para aplicar
  // `switch*` **solo si cambió** respecto a él.
  const seedAgent = seed.agent ?? null;
  const seedModel = seed.model ?? null;
  const [selection, setSelection] = useState<TChatSelection>(() => ({
    agent: seedAgent,
    model: seedModel,
    isDirty: false,
  }));
  const appliedRef = useRef<TAppliedSelection>({
    agent: seedAgent,
    model: seedModel,
  });

  // Reajuste al cambiar de sesión (mismo patrón que `useChatDraft`): reseeda la
  // selección con el nodo de la nueva sesión. El baseline se guarda en estado
  // (solo cambia con la sesión) y se vuelca al ref en un efecto, para no
  // escribir el ref durante el render (react-hooks/refs).
  const [seededSessionId, setSeededSessionId] = useState(sessionId);
  const [baseline, setBaseline] = useState<TAppliedSelection>({
    agent: seedAgent,
    model: seedModel,
  });
  if (seededSessionId !== sessionId) {
    setSeededSessionId(sessionId);
    setBaseline({ agent: seedAgent, model: seedModel });
    setSelection({ agent: seedAgent, model: seedModel, isDirty: false });
  }
  useEffect(() => {
    appliedRef.current = baseline;
  }, [baseline]);

  const setAgent = useCallback((agent: string | null) => {
    setSelection((current) => {
      const next = { ...current, agent };
      return { ...next, isDirty: computeDirty(next, appliedRef.current) };
    });
  }, []);

  const setModel = useCallback((model: ModelRef | null) => {
    setSelection((current) => {
      const next = { ...current, model };
      return { ...next, isDirty: computeDirty(next, appliedRef.current) };
    });
  }, []);

  const draft = useChatDraft(sessionId, {
    isSubmitting: mutation.isPending,
    queued,
  });

  const send = useCallback(
    (text: string) => {
      const value = text.trim();
      if (value.length === 0) return;

      setQueued(false);

      // "Solo si cambió" respecto al baseline (W7): cada campo se aplica
      // únicamente si difiere del valor vigente; `null` = no cambiar.
      const applied = appliedRef.current;
      const agentChanged =
        selection.agent !== null && selection.agent !== applied.agent;
      const modelChanged =
        selection.model !== null && !sameModel(selection.model, applied.model);
      const selectionChanged = agentChanged || modelChanged;

      if (selectionChanged) {
        // Se actualiza el baseline de forma optimista para que un segundo envío
        // sin cambios no vuelva a aplicar `switch*`.
        appliedRef.current = { agent: selection.agent, model: selection.model };
        setSelection((current) => ({ ...current, isDirty: false }));
      }

      void (async () => {
        try {
          // Orden W7: `switchAgent`/`switchModel` (vía `useSetSelection`)
          // **antes** de `prompt`. Se anulan los campos que no cambiaron.
          if (selectionChanged) {
            await selectionMutation.mutateAsync({
              agent: agentChanged ? selection.agent : null,
              model: modelChanged ? selection.model : null,
              isDirty: false,
            });
          }

          const result = await mutation.mutateAsync(value);
          setQueued(result.queued);
          // El texto se conserva ante un fallo (FR-022); solo se limpia al éxito.
          draft.clear();
        } catch {
          // El error queda expuesto por `mutation.error` (FR-022).
        }
      })();
    },
    [selection, mutation, selectionMutation, draft],
  );

  const interrupt = useCallback(() => {
    // La mutation comprueba `busy` en el momento de invocarse (FR-004): si la
    // sesión ya no está en curso, no toca la red.
    interruptMutation.mutate();
  }, [interruptMutation]);

  return {
    timeline,
    busy,
    isSubmitting: mutation.isPending,
    queued,
    error: mutation.error,
    canInterrupt: busy,
    isInterrupting: interruptMutation.isPending,
    interrupt,
    text: draft.text,
    setText: draft.setText,
    clear: draft.clear,
    selection,
    setAgent,
    setModel,
    send,
  };
};
