import { Container } from '@app/Application/Components';
import {
  ResourceRow,
  SectionFrame,
} from '@app/Application/Components/Molecules';
import type { TResourceUsage } from '../Inspector.entity';

interface ResourceListProps {
  resources: TResourceUsage;
}

export const ResourceList = ({ resources }: ResourceListProps) => {
  const isEmpty =
    resources.mcpServers.length === 0 &&
    resources.instructions.length === 0 &&
    resources.skills.length === 0 &&
    resources.tools.length === 0;

  return (
    <SectionFrame
      title="Recursos"
      isEmpty={isEmpty}
      emptyLabel="Sin recursos configurados para este agente."
    >
      <Container space="small">
        <ResourceRow
          label="MCP"
          items={resources.mcpServers.map((s) => `${s.name} (${s.status})`)}
          emptyLabel="Sin servidores MCP"
        />
        <ResourceRow
          label="Instructions"
          items={resources.instructions}
          emptyLabel="Sin instrucciones registradas"
        />
        <ResourceRow
          label="Skills"
          items={resources.skills.map((s) => s.name)}
          emptyLabel="Sin skills configuradas"
        />
        <ResourceRow
          label="Tools"
          items={resources.tools}
          emptyLabel="Sin herramientas usadas"
        />
      </Container>
    </SectionFrame>
  );
};
