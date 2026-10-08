import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layoutGraph';

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
 * (Principio VII).
 */
export const FitViewController = ({ signature }: { signature: string }) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    void fitView({ duration: 300, padding: 0.1 });
  }, [signature, fitView]);

  return null;
};
