import { DetailRow, SectionFrame } from '@app/Application/Components/Molecules';
import { UNAVAILABLE } from '@app/Application/Helpers';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';

interface ModelSectionProps {
  model: TGraphNode['data']['model'];
}

export const ModelSection = ({ model }: ModelSectionProps) => (
  <SectionFrame title="Modelo">
    <DetailRow
      label="Nombre"
      value={model ? `${model.providerID}/${model.id}` : UNAVAILABLE}
    />
    <DetailRow label="Razonamiento" value={model?.variant ?? UNAVAILABLE} />
  </SectionFrame>
);
