import { useEffect } from 'react';
import {
  useNodesInitialized,
  useReactFlow,
  useStore,
  useStoreApi,
} from '@xyflow/react';
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layoutGraph';
import {
  FIT_PADDING,
  MIN_READABLE_ZOOM,
  readableViewport,
} from '../lib/readableViewport';

/**
 * Centra el viewport en un nodo seguido (modo follow). No relayouta: solo mueve
 * la cámara sobre el nodo ya posicionado.
 */
export const FollowController = ({ nodeId }: { nodeId: string | null }) => {
  const { getNode, setCenter } = useReactFlow();

  useEffect(() => {
    if (!nodeId) return;
    const node = getNode(nodeId);
    if (!node) return;
    void setCenter(
      node.position.x + NODE_WIDTH / 2,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 1, duration: 300 },
    );
  }, [nodeId, getNode, setCenter]);

  return null;
};

/**
 * Ajusta el viewport cuando cambia la firma de topología de la vista. React Flow
 * solo hace `fitView` en el montaje, así que un cambio de topología necesita un
 * ajuste explícito. No relayouta: solo encuadra los nodos ya posicionados
 * (Principio VII). Si el ajuste completo dejaría las cards ilegibles, encuadra
 * desde arriba a zoom legible (`readableViewport`), centrado en `anchorX` si
 * se aporta.
 */
export const FitViewController = ({
  signature,
  anchorX = null,
}: {
  signature: string;
  anchorX?: number | null;
}) => {
  const { fitView, getNodes, getNodesBounds, setViewport } = useReactFlow();
  const store = useStoreApi();
  // Se reencuadra cuando el panel pasa a estar medido (al montar mide 0), pero
  // no en cada resize: eso movería la cámara que el usuario ya ajustó.
  const isPaneMeasured = useStore(
    (state) => state.width > 0 && state.height > 0,
  );
  // Ídem con los nodos: sus límites solo son reales una vez medidos.
  const nodesInitialized = useNodesInitialized();

  useEffect(() => {
    const { width, height } = store.getState();
    const viewport = readableViewport(
      getNodesBounds(getNodes()),
      { width, height },
      MIN_READABLE_ZOOM,
      anchorX,
    );
    if (viewport) {
      void setViewport(viewport, { duration: 300 });
      return;
    }
    void fitView({ duration: 300, padding: FIT_PADDING });
    // `anchorX` no entra en las deps: solo encuadra al cambiar la firma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    signature,
    isPaneMeasured,
    nodesInitialized,
    store,
    fitView,
    getNodes,
    getNodesBounds,
    setViewport,
  ]);

  return null;
};
