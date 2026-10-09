import { Container } from '@app/Application/Components';
import {
  DetailListRow,
  Disclosure,
  SectionFrame,
  ToolStatusBadge,
} from '@app/Application/Components/Molecules';
import { formatDuration, type TToolStatus } from '@app/Application/Helpers';
import type { TToolHistoryEntry } from '../Inspector.entity';
import { useToolHistory } from '../Hooks/useToolHistory';

interface ToolHistoryProps {
  tools: TToolHistoryEntry[];
}

export const ToolHistory = ({ tools }: ToolHistoryProps) => {
  const { visibleTools, hiddenCount, canExpand, isExpanded, toggle } =
    useToolHistory(tools);

  return (
    <SectionFrame
      title="Herramientas"
      isEmpty={tools.length === 0}
      emptyLabel="Sin actividad de herramientas todavía."
    >
      <Container space="small">
        {visibleTools.map((tool, index) => (
          <DetailListRow key={`${tool.name}-${index}`}>
            <span className="truncate font-mono text-xs text-foreground">
              {tool.name}
            </span>
            <ToolStatusBadge
              status={tool.status as TToolStatus}
              label={false}
            />
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatDuration(
                tool.startedAt !== undefined && tool.endedAt !== undefined
                  ? tool.endedAt - tool.startedAt
                  : null,
              )}
            </span>
          </DetailListRow>
        ))}
      </Container>

      {canExpand ? (
        <Disclosure
          title={`Ver ${hiddenCount} más`}
          expandedTitle="Ver menos"
          expanded={isExpanded}
          onToggle={toggle}
        />
      ) : null}
    </SectionFrame>
  );
};
