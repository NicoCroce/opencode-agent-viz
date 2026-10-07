import { Container, Metric, StatusDot } from '@app/Application/Components';
import {
  NODE_STATUS_LABEL,
  UNAVAILABLE,
  folderName,
  formatCost,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import type {
  TGraphNode,
  TNodeStatus,
  TTokenUsage,
} from '@app/Domains/Graph/Graph.entity';
import type { TLineageNav } from '../History.entity';

interface HistoryHeaderProps {
  /** Nodo cuyo histórico se muestra: identidad, estado y métricas (FR-010). */
  node: TGraphNode;
  /** Padre e hijos del nodo para la navegación de linaje (FR-012). */
  lineage: TLineageNav;
  /** Cambia la sesión objetivo del overlay sin cerrarlo (FR-012). */
  onNavigate: (sessionId: string) => void;
}

/**
 * Resultado final del turno. Solo los estados terminales lo tienen; una
 * ejecución activa o recién creada no reporta resultado (FR-038).
 */
const OUTCOME_LABEL: Partial<Record<TNodeStatus, string>> = {
  succeeded: 'Terminada con éxito',
  failed: 'Fallida',
  interrupted: 'Interrumpida',
};

/** Total de tokens consumidos (entrada + salida + razonamiento), o `null`. */
const totalTokens = (tokens: TTokenUsage | null): number | null => {
  if (!tokens) return null;
  const values = [tokens.input, tokens.output, tokens.reasoning].filter(
    (value): value is number => value !== null,
  );
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
};

/**
 * Chip de navegación de linaje: planos, monoespaciados y sin caja pesada para
 * encajar en la cabecera fija del overlay.
 */
const NavButton = ({
  sessionId,
  onNavigate,
}: {
  sessionId: string;
  onNavigate: (sessionId: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onNavigate(sessionId)}
    title={sessionId}
    className="max-w-[16rem] truncate rounded-flat border border-border px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent focus-visible:outline-none"
  >
    {sessionId}
  </button>
);

/**
 * Cabecera del histórico (FR-010): identidad (título o nombre), modelo, estado,
 * coste, tokens, resultado final y directorio, con "no disponible" ante datos
 * ausentes (FR-038); incluye la navegación "Invocado por" / "Invocó a" del
 * linaje (FR-012) mediante `onNavigate`.
 *
 * Componente de presentación pura: no accede al SDK ni muta estado.
 */
export const HistoryHeader = ({
  node,
  lineage,
  onNavigate,
}: HistoryHeaderProps) => {
  const { data } = node;
  const { metrics, model } = data;
  const { parentId, childrenIds } = lineage;

  const title = data.title ?? data.agentName;
  const modelValue = model ? `${model.providerID}/${model.id}` : null;
  const directoryValue = data.directory ? folderName(data.directory) : null;
  const costValue = metrics.cost === null ? null : formatCost(metrics.cost);
  const tokens = totalTokens(metrics.tokens);
  const tokensValue = tokens === null ? null : formatTokens(tokens);
  const outcomeValue = OUTCOME_LABEL[data.status] ?? null;

  return (
    <Container space="small" className="min-w-0">
      {/* Identidad: título/nombre + estado con su punto de color */}
      <Container space="small" className="min-w-0">
        <span className="truncate text-sm font-semibold leading-snug text-foreground">
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <StatusDot status={data.status} />
          <span className="text-foreground">{NODE_STATUS_LABEL[data.status]}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{data.agentName}</span>
        </span>
      </Container>

      {/* Datos de ejecución (FR-010): ausente → "no disponible" (FR-038) */}
      <Container row space="large" className="flex-wrap">
        <Metric label="Modelo" value={modelValue} />
        <Metric label="Estado" value={NODE_STATUS_LABEL[data.status]} />
        <Metric label="Costo" value={costValue} />
        <Metric label="Tokens" value={tokensValue} />
        <Metric
          label="Duración"
          value={metrics.durationMs === null ? null : formatDuration(metrics.durationMs)}
        />
        <Metric label="Resultado" value={outcomeValue} />
        <Metric label="Directorio" value={directoryValue} />
      </Container>

      {/* Navegación de linaje (FR-012): padre e hijos, sin cerrar el overlay */}
      <Container row space="large" className="flex-wrap items-center">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Invocado por
          </span>
          {parentId ? (
            <NavButton sessionId={parentId} onNavigate={onNavigate} />
          ) : (
            <span
              className="font-mono text-[11px] text-muted-foreground"
              aria-label="no disponible"
            >
              {UNAVAILABLE}
              <span className="sr-only"> no disponible</span>
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Invocó a
          </span>
          {childrenIds.length > 0 ? (
            childrenIds.map((childId) => (
              <NavButton
                key={childId}
                sessionId={childId}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <span
              className="font-mono text-[11px] text-muted-foreground"
              aria-label="no disponible"
            >
              {UNAVAILABLE}
              <span className="sr-only"> no disponible</span>
            </span>
          )}
        </span>
      </Container>
    </Container>
  );
};
