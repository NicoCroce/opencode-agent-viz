import { Container } from '@app/Application/Components';
import {
  DetailRow,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import {
  formatDuration,
  formatPercent,
  formatSpeedup,
} from '@app/Application/Helpers';
import type { TNodeSpeedup } from '@app/Domains/Graph/Graph.entity';

interface ParallelismSectionProps {
  /** Aceleración del grupo del nodo; `null`/sin `speedup` si corrió solo. */
  speedup: TNodeSpeedup | null;
}

/**
 * Apartado **Paralelismo** del panel de contexto (FR-009;
 * `contracts/context-panel-contract.md` §3). Visible solo cuando el nodo
 * participa de un grupo con aceleración calculable; muestra tamaño del grupo,
 * tiempo en serie, tiempo real, aceleración y eficiencia. La provisionalidad se
 * etiqueta en texto (no depende solo del color). Presentación pura.
 */
export const ParallelismSection = ({ speedup }: ParallelismSectionProps) => {
  if (!speedup || speedup.speedup === null) return null;

  return (
    <Container space="small" data-testid="parallelism-section">
      <Container row align="baseline" justify="between" space="small">
        <SectionHeading>Paralelismo</SectionHeading>
        {speedup.provisional ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            provisional
          </span>
        ) : null}
      </Container>

      <Container space="none" className="gap-0.5">
        <DetailRow label="Agentes en paralelo" value={speedup.size} />
        <DetailRow
          label="Tiempo en serie"
          value={formatDuration(speedup.serialMs)}
        />
        <DetailRow label="Tiempo real" value={formatDuration(speedup.wallMs)} />
        <DetailRow
          label="Aceleración"
          value={formatSpeedup(speedup.speedup)}
        />
        <DetailRow
          label="Eficiencia"
          value={
            speedup.efficiency === null
              ? null
              : formatPercent(speedup.efficiency * 100, 0)
          }
        />
      </Container>
    </Container>
  );
};
