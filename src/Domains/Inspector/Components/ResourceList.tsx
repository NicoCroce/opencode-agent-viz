import { Container } from '@app/Application/Components';
import type { TResourceUsage } from '../Inspector.entity';

interface ResourceListProps {
  resources: TResourceUsage;
}

const ResourceRow = ({
  label,
  items,
  emptyLabel,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {items.length === 0 ? (
      <span className="text-[11px] text-muted-foreground">{emptyLabel}</span>
    ) : (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-flat border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
          >
            {item}
            <span className="ml-1 text-muted-foreground">disponible</span>
          </span>
        ))}
      </div>
    )}
  </div>
);

export const ResourceList = ({ resources }: ResourceListProps) => {
  const isEmpty =
    resources.mcpServers.length === 0 &&
    resources.instructions.length === 0 &&
    resources.skills.length === 0 &&
    resources.tools.length === 0;

  return (
    <Container space="small">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Recursos
      </span>
      {isEmpty ? (
        <p className="text-xs text-muted-foreground">
          Sin recursos configurados para este agente.
        </p>
      ) : (
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
      )}
    </Container>
  );
};
