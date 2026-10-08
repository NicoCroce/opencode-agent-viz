import { useCallback } from 'react';
import { InspectorPanel } from '@app/Domains/Inspector';
import type { TGraphModel, TParallelGroup } from '@app/Domains/Graph';
import { useInspectedNodeContext } from '../Hooks/useInspectedNodeContext';

interface InspectorPaneProps {
  graph: TGraphModel;
  parallelGroups: TParallelGroup[];
  inspectedNodeId: string | null;
  showReasoning: boolean;
  onToggleReasoning: () => void;
  onOpenHistory: (sessionId: string) => void;
}

/**
 * Panel del inspector: deriva el contexto del nodo inspeccionado (nodo, peers,
 * invocador) y rinde `InspectorPanel`. `InspectorPanel` se importa por el
 * **barrel** de dominio para que el `vi.mock('@app/Domains/Inspector')` de los
 * specs siga interceptándolo.
 */
export const InspectorPane = ({
  graph,
  parallelGroups,
  inspectedNodeId,
  showReasoning,
  onToggleReasoning,
  onOpenHistory,
}: InspectorPaneProps) => {
  const { node, peers, invokedBy } = useInspectedNodeContext({
    graph,
    parallelGroups,
    inspectedNodeId,
  });

  const handleOpenHistory = useCallback(() => {
    if (!node) return;
    onOpenHistory(node.data.sessionId);
  }, [node, onOpenHistory]);

  return (
    <InspectorPanel
      node={node}
      parallelPeers={peers}
      invokedBy={invokedBy}
      showReasoning={showReasoning}
      onToggleReasoning={onToggleReasoning}
      onOpenHistory={handleOpenHistory}
    />
  );
};
