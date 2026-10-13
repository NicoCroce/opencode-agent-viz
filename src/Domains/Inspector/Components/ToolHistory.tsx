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
  /** La consulta de mensajes falló (Principio VI). */
  isError?: boolean;
  /** La consulta de mensajes está en curso (Principio VI). */
  isLoading?: boolean;
}

/**
 * Sección **Herramientas** del panel de detalle: encabezado, lista truncada a
 * diez entradas con el control `Disclosure` "Ver N más" y estado vacío. Resuelve
 * los cuatro estados de pantalla vía `SectionFrame` con la prioridad
 * **error → carga → vacío → datos**; el encabezado y el estado vacío se
 * conservan tal cual. Presentación pura.
 */
export const ToolHistory = ({
  tools,
  isError = false,
  isLoading = false,
}: ToolHistoryProps) => {
  const { visibleTools, hiddenCount, canExpand, isExpanded, toggle } =
    useToolHistory(tools);

  return (
    <SectionFrame
      title="Herramientas"
      isError={isError}
      isLoading={isLoading}
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
