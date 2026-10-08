import { Container } from '@app/Application/Components';

/**
 * Estado vacío del panel: invita a seleccionar un nodo del grafo para ver su
 * detalle (SC-003).
 */
export const InspectorEmptyPrompt = () => (
  <Container space="small" className="p-4">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Inspector
    </span>
    <p className="text-xs text-muted-foreground">
      Selecciona un nodo del grafo para ver su detalle.
    </p>
  </Container>
);
