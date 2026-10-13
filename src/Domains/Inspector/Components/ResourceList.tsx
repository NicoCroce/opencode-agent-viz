import { Container } from '@app/Application/Components';
import {
  ResourceRow,
  SectionFrame,
} from '@app/Application/Components/Molecules';
import { formatTokens } from '@app/Application/Helpers';
import type { TResourceUsage } from '../Inspector.entity';

interface ResourceListProps {
  resources: TResourceUsage;
}

/**
 * Nota de una skill cargada: `~3.4k tokens`. El `~` es deliberado porque
 * `estTokens` es una estimación (caracteres ÷ 4, FR-010) y nunca un coste real;
 * sin estimación no se inventa número (`undefined` → solo el nombre).
 */
const skillNote = (estTokens: number | null): string | undefined =>
  estTokens === null ? undefined : `~${formatTokens(estTokens)} tokens`;

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
          items={resources.mcpServers.map((server) => ({
            label: `${server.name} (${server.status})`,
          }))}
          emptyLabel="Sin servidores MCP"
        />
        <ResourceRow
          label="Instructions"
          items={resources.instructions.map((instruction) => ({
            label: instruction,
          }))}
          emptyLabel="Sin instrucciones registradas"
        />
        <ResourceRow
          label="Skills"
          items={resources.skills.map((skill) => ({
            label: skill.name,
            note: skillNote(skill.estTokens),
          }))}
          emptyLabel="Sin skills cargadas"
        />
        <ResourceRow
          label="Tools"
          items={resources.tools.map((tool) => ({ label: tool }))}
          emptyLabel="Sin herramientas usadas"
        />
      </Container>
    </SectionFrame>
  );
};
