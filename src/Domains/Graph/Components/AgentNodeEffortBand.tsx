import { Container } from '@app/Application/Components';
import type { TNodeEffort } from '../Graph.entity';
import { EffortMeter } from './EffortMeter';

interface AgentNodeEffortBandProps {
  effort: TNodeEffort | null | undefined;
}

const LABEL = 'esfuerzo';
const PROVISIONAL_SUFFIX = ' · provisional';

/**
 * Banda de esfuerzo al pie del card (la firma del nodo): etiqueta, barra de 5
 * segmentos (`EffortMeter`) y nivel `N/5`. Da nombre y contexto a la firma y
 * hace comparables los nodos de una misma fila. La etiqueta y el nivel son
 * `aria-hidden`: la descripción accesible la aporta el propio medidor
 * (`role="img"`). No se renderiza cuando el nodo no tiene esfuerzo.
 */
export const AgentNodeEffortBand = ({ effort }: AgentNodeEffortBandProps) => {
  if (!effort) return null;

  return (
    <Container space="none" className="min-w-0 border-t border-border pt-1.5">
      <Container row align="center" space="none" className="min-w-0 gap-2">
        <span
          aria-hidden
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          {effort.provisional ? `${LABEL}${PROVISIONAL_SUFFIX}` : LABEL}
        </span>
        <EffortMeter effort={effort} />
        <span
          aria-hidden
          className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
        >
          {effort.level}/5
        </span>
      </Container>
    </Container>
  );
};
