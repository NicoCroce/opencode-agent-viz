import { Container } from '@app/Application/Components';
import { UNAVAILABLE } from '@app/Application/Helpers';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';

interface ModelSectionProps {
  model: TGraphNode['data']['model'];
}

/** Fila etiqueta/valor: etiqueta a la izquierda, dato monoespaciado a la derecha. */
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 items-baseline justify-between gap-3">
    <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
    <span className="min-w-0 break-all text-right font-mono text-[11px] text-foreground">
      {value}
    </span>
  </div>
);

export const ModelSection = ({ model }: ModelSectionProps) => (
  <Container space="small">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Modelo
    </span>
    <Container space="small">
      <DetailRow
        label="Nombre"
        value={model ? `${model.providerID}/${model.id}` : UNAVAILABLE}
      />
      <DetailRow label="Razonamiento" value={model?.variant ?? UNAVAILABLE} />
    </Container>
  </Container>
);
