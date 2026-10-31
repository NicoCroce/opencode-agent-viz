import { MousePointerClick } from 'lucide-react';
import { Container } from '@app/Application/Components';
import { SectionHeading } from '@app/Application/Components/Molecules';

/**
 * Estado vacío del panel: invita a seleccionar un nodo del grafo para ver su
 * detalle (SC-003). El icono es decorativo; el texto conserva el nombre del
 * panel y la instrucción.
 */
export const InspectorEmptyPrompt = () => (
  <Container
    align="center"
    justify="center"
    space="none"
    className="h-full gap-3 p-6 text-center"
  >
    <span
      aria-hidden
      className="flex size-11 items-center justify-center rounded-full border border-border/70 bg-surface-1/60 text-muted-foreground"
    >
      <MousePointerClick className="size-5" strokeWidth={1.6} />
    </span>
    <SectionHeading>Inspector</SectionHeading>
    <p className="max-w-[220px] text-xs leading-relaxed text-muted-foreground">
      Selecciona un nodo del grafo para ver su detalle.
    </p>
  </Container>
);
