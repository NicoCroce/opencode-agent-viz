import type { TGraphNode } from '@app/Domains/Graph';
import type { TLineageNav } from '@app/Domains/History';
import {
  useSessionContext,
  useSessionForms,
  type TQuestionEntry,
  type TSessionContextResult,
} from '@app/Domains/Inspector';
import { useHistoryOverlay } from './useHistoryOverlay';

/**
 * Params del overlay de histórico (`useHistoryOverlay`) tal como los declara su
 * firma: derivarlos evita duplicar la forma del contrato congelado
 * (`contracts/enrichment-pure-api.md` §2).
 */
type UseHistoryOverlayParams = Parameters<typeof useHistoryOverlay>[0];

/**
 * `sessionIdForForms` es **opcional**: la sesión del histórico se deriva del
 * nodo (`node.data.sessionId`), que es la identidad real del overlay. Se acepta
 * explícita solo para preservar la firma congelada del contrato; si viene, manda
 * (en la práctica es el mismo valor que el derivado).
 */
export type UseHistoryDataParams = UseHistoryOverlayParams & {
  sessionIdForForms?: string | null;
};

/** Datos que consume `HistoryOverlay`: vista del overlay + preguntas + contexto. */
export interface UseHistoryDataResult {
  node: TGraphNode | null;
  lineage: TLineageNav;
  missingId: string | null;
  clearMissing: () => void;
  questions: TQuestionEntry[];
  context: TSessionContextResult;
}

/**
 * Data-fetching del histórico (FR-010): compone el estado de vista del overlay
 * (`useHistoryOverlay`) con las preguntas dirigidas al usuario (FR-033) y el
 * contexto de compactación (FR-035) de la sesión **del nodo abierto**.
 *
 * El `sessionId` de forms/contexto no es un prop de la página: se deriva del
 * nodo del histórico (`node.data.sessionId ?? null`), con la misma composición
 * que `WorkspacePage` hacía inline. Con `targetId` nulo —o inexistente, y por
 * tanto con `missingId`— la sesión es `null` y ninguna de las dos consultas se
 * dispara (`enabled: Boolean(sessionId)`).
 */
export const useHistoryData = ({
  sessionIdForForms,
  ...overlay
}: UseHistoryDataParams): UseHistoryDataResult => {
  const overlayData = useHistoryOverlay(overlay);

  const sessionId =
    sessionIdForForms ?? overlayData.node?.data.sessionId ?? null;
  const forms = useSessionForms(sessionId);
  const context = useSessionContext(sessionId);

  return {
    node: overlayData.node,
    lineage: overlayData.lineage,
    missingId: overlayData.missingId,
    clearMissing: overlayData.clearMissing,
    questions: forms.questions,
    context,
  };
};
