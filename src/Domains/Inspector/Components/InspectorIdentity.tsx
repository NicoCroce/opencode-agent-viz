import { Container } from '@app/Application/Components';
import { NODE_STATUS_LABEL, folderName } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TGraphNode, TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/**
 * Tono de la píldora de estado: texto + borde atenuado + LED. Activo (en curso,
 * reintentando, compactando) usa el acento con halo; el resto, el color de su
 * estado. La etiqueta textual acompaña siempre al color.
 */
interface TStatusPillTone {
  pill: string;
  led: string;
}

const ACTIVE_TONE: TStatusPillTone = {
  pill: 'border-accent/30 text-accent',
  led: 'bg-accent glow-accent',
};

const WAITING_TONE: TStatusPillTone = {
  pill: 'border-status-waiting/30 text-status-waiting',
  led: 'bg-status-waiting',
};

const ERROR_TONE: TStatusPillTone = {
  pill: 'border-status-error/30 text-status-error',
  led: 'bg-status-error',
};

const STATUS_PILL_TONE: Record<TNodeStatus, TStatusPillTone> = {
  created: {
    pill: 'border-status-idle/30 text-status-idle',
    led: 'bg-status-idle',
  },
  running: ACTIVE_TONE,
  retrying: ACTIVE_TONE,
  compacting: ACTIVE_TONE,
  'waiting-permission': WAITING_TONE,
  'waiting-input': WAITING_TONE,
  succeeded: {
    pill: 'border-status-done/30 text-status-done',
    led: 'bg-status-done',
  },
  failed: ERROR_TONE,
  interrupted: ERROR_TONE,
};

interface InspectorIdentityProps {
  node: TGraphNode;
  /** Nodo que invocó a `node` (relación padre → hijo), si lo hay. */
  invokedBy?: TGraphNode | null;
}

/**
 * Encabezado de identidad del nodo seleccionado (FR-001/SC-003): título
 * completo (sin cortar) con la píldora de estado, línea mono de agente y
 * modelo, directorio y el origen si el nodo fue invocado.
 */
export const InspectorIdentity = ({
  node,
  invokedBy = null,
}: InspectorIdentityProps) => {
  const { status } = node.data;
  const tone = STATUS_PILL_TONE[status];
  const modelId = node.data.model?.id ?? null;

  return (
    <Container space="none" className="min-w-0 gap-1.5!">
      <Container
        row
        align="center"
        space="none"
        className="min-w-0 flex-wrap gap-x-2.5! gap-y-1!"
      >
        <span className="min-w-0 break-words font-display text-xl font-medium leading-tight text-foreground">
          {node.data.title ?? node.data.agentName}
        </span>
        <Container
          row
          align="center"
          space="none"
          className={cn(
            'h-[22px] shrink-0 gap-1.5! rounded-full border px-2 font-mono text-[10px] uppercase tracking-[0.08em]',
            tone.pill,
          )}
        >
          <span
            aria-hidden
            className={cn('size-1.5 shrink-0 rounded-full', tone.led)}
          />
          <span>{NODE_STATUS_LABEL[status]}</span>
        </Container>
      </Container>
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">{node.data.agentName}</span>
        {modelId ? (
          <>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate">{modelId}</span>
          </>
        ) : null}
      </span>
      <span
        className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"
        title={node.data.directory}
      >
        <span aria-hidden className="text-accent">
          #
        </span>
        <span className="truncate">{folderName(node.data.directory)}</span>
      </span>
      {invokedBy ? (
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          Invocado por{' '}
          <span className="text-foreground">
            {invokedBy.data.title ?? invokedBy.data.agentName}
          </span>
        </span>
      ) : null}
    </Container>
  );
};
