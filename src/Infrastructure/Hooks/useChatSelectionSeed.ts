import { useMemo } from 'react';
import type { TChatSelectionSeed } from '@app/Domains/Chat';
import type { TGraphNode } from '@app/Domains/Graph';

interface UseChatSelectionSeedParams {
  nodes: TGraphNode[];
  sessionId: string | null;
}

/**
 * Semilla de la selección activa del chat (FR-008, T078): se deriva del **nodo
 * abierto** (`data.sessionId === sessionId`) para que `useChatController` arranque
 * el agente y el modelo vigentes del nodo y aplique `switch*` **solo si cambió**.
 *
 * Sin nodo (o sin sesión) ambos campos son `null`, que significa "no cambiar".
 * Memoizada por identidad de `nodes` + `sessionId` para preservar la referencia
 * entre renders (FR-019).
 */
export const useChatSelectionSeed = ({
  nodes,
  sessionId,
}: UseChatSelectionSeedParams): TChatSelectionSeed =>
  useMemo<TChatSelectionSeed>(() => {
    const node = nodes.find(
      (candidate) => candidate.data.sessionId === sessionId,
    );
    return {
      agent: node?.data.agentName ?? null,
      model: node?.data.model ?? null,
    };
  }, [nodes, sessionId]);
