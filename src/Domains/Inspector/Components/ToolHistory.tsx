import { Container, DurationBar } from '@app/Application/Components';
import {
  DETAIL_LIST_CLASSNAME,
  DETAIL_LIST_ROW_CLASSNAME,
  Disclosure,
  SectionFrame,
  ToolStatusBadge,
} from '@app/Application/Components/Molecules';
import { formatDuration, type TToolStatus } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TToolHistoryEntry } from '../Inspector.entity';
import { useToolHistory } from '../Hooks/useToolHistory';

/**
 * Columnas de la fila: herramienta (trunca) · estado · duración con barra.
 * Rejilla fija para que la duración se lea en vertical como una tabla.
 */
const TOOL_ROW_CLASSNAME =
  'grid grid-cols-[minmax(0,1fr)_auto_4rem] items-center gap-2.5';

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
 *
 * La lista es un único bloque con borde y separadores; la llamada más lenta (o
 * en curso) se destaca en acento y cada fila lleva una barra de 2px con su
 * duración relativa (la derivación vive en `useToolHistory`).
 */
export const ToolHistory = ({
  tools,
  isError = false,
  isLoading = false,
}: ToolHistoryProps) => {
  const { visibleRows, hiddenCount, canExpand, isExpanded, toggle } =
    useToolHistory(tools);

  return (
    <SectionFrame
      title="Herramientas"
      isError={isError}
      isLoading={isLoading}
      isEmpty={tools.length === 0}
      emptyLabel="Sin actividad de herramientas todavía."
    >
      <ul className={DETAIL_LIST_CLASSNAME}>
        {visibleRows.map(
          ({ entry, durationMs, ratio, isHighlighted }, index) => (
            <li
              key={`${entry.name}-${index}`}
              className={cn(TOOL_ROW_CLASSNAME, DETAIL_LIST_ROW_CLASSNAME)}
            >
              <span
                className={cn(
                  'truncate font-mono text-xs',
                  isHighlighted ? 'text-accent' : 'text-foreground',
                )}
              >
                {entry.name}
              </span>
              <ToolStatusBadge
                status={entry.status as TToolStatus}
                label={false}
              />
              <Container space="none" align="end" className="gap-1!">
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatDuration(durationMs)}
                </span>
                <DurationBar
                  ratio={ratio}
                  tone={isHighlighted ? 'accent' : 'muted'}
                  decorative
                />
              </Container>
            </li>
          ),
        )}
      </ul>

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
