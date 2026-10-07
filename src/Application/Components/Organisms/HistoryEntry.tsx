import type { ReactNode } from 'react';
import { RichText } from '@app/Application/Components/Molecules/RichText';
import type { ModelRef } from '@opencode/client';
import type {
  THistoryAttachment,
  THistoryCompactionEntry,
  THistoryEntry,
  THistoryIdleEntry,
  THistoryQuestionState,
  TShellStatus,
} from '@app/Domains/History/History.entity';
import { ToolCallEntry } from './ToolCallEntry';

interface HistoryEntryProps {
  /** Entrada cronológica del histórico (`buildHistory`). */
  entry: THistoryEntry;
  /**
   * Cuando es `false`, las entradas de razonamiento no se renderizan (FR-002).
   * La visibilidad la posee el llamador (`useReasoningVisibility`).
   */
  showReasoning?: boolean;
  /**
   * Sesión a la que pertenece la entrada. Se pasa al render del contexto de
   * compactación inyectado por el llamador (FR-035); sin ella la compactación
   * se muestra sin contexto.
   */
  sessionId?: string | null;
  /**
   * Render del contexto resultante de una compactación (FR-035). Lo inyecta el
   * llamador del dominio dueño (que pide los datos con `useSessionContext`),
   * de modo que este componente compartido no depende de ningún service de
   * dominio (Constitución II). Sin él, la compactación se muestra sin contexto.
   */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/** Etiqueta plana de tipo de entrada (FR-003). */
const KIND_LABEL: Record<THistoryEntry['kind'], string> = {
  user: 'Usuario',
  answer: 'Respuesta',
  reasoning: 'Razonamiento',
  tool: 'Herramienta',
  'agent-switched': 'Cambio de agente',
  'model-switched': 'Cambio de modelo',
  'location-switched': 'Cambio de ubicación',
  system: 'Sistema',
  synthetic: 'Sintético',
  skill: 'Skill',
  shell: 'Shell',
  compaction: 'Compactación',
  idle: 'Cierre de turno',
  question: 'Pregunta',
};

/** Franja plana a la izquierda que distingue el tipo de entrada (FR-003). */
const KIND_STRIPE: Record<THistoryEntry['kind'], string> = {
  user: 'border-accent',
  answer: 'border-status-done',
  reasoning: 'border-border',
  tool: 'border-status-running',
  'agent-switched': 'border-status-idle',
  'model-switched': 'border-status-idle',
  'location-switched': 'border-status-idle',
  system: 'border-status-idle',
  synthetic: 'border-status-idle',
  skill: 'border-accent',
  shell: 'border-border',
  compaction: 'border-status-waiting',
  idle: 'border-status-done',
  question: 'border-accent',
};

/** Estado del episodio de compactación (FR-035). */
const COMPACTION_LABEL: Record<THistoryCompactionEntry['status'], string> = {
  running: 'En curso',
  completed: 'Completada',
  failed: 'Fallida',
};

/** Resultado final del turno. */
const IDLE_LABEL: Record<THistoryIdleEntry['outcome'], string> = {
  succeeded: 'Terminada con éxito',
  failed: 'Fallida',
  interrupted: 'Interrumpida',
};

/** Estado real de una ejecución de shell. */
const SHELL_LABEL: Record<TShellStatus, string> = {
  running: 'En curso',
  exited: 'Finalizado',
  timeout: 'Agotado',
  killed: 'Interrumpido',
};

/** Tipo de adjunto de un prompt de usuario (FR-007). */
const ATTACHMENT_LABEL: Record<THistoryAttachment['kind'], string> = {
  file: 'archivo',
  agent: 'agente',
  skill: 'skill',
};

/** Estado de la pregunta en lenguaje natural (FR-033). */
const QUESTION_STATE_LABEL: Record<THistoryQuestionState, string> = {
  pending: 'pendiente',
  answered: 'respondida',
  cancelled: 'cancelada',
};

const QUESTION_STATE_COLOR: Record<THistoryQuestionState, string> = {
  pending: 'text-status-running',
  answered: 'text-status-done',
  cancelled: 'text-muted-foreground',
};

/** Nombre mostrado de un modelo; nunca un valor inventado (FR-038). */
const formatModel = (model: ModelRef): string => `${model.providerID}/${model.id}`;

/** Indicador de respuesta/razonamiento aún no consolidado (FR-006). */
const InProgress = () => (
  <span className="font-mono text-[11px] text-status-running">En curso</span>
);

/** Descripción opcional de system/synthetic; se omite si no existe. */
const Description = ({ value }: { value: string | null }) =>
  value ? <p className="text-xs text-muted-foreground">{value}</p> : null;

/** Cuerpo de la entrada según su `kind` (FR-003/006). */
const renderBody = (
  entry: THistoryEntry,
  sessionId: string | null,
  renderCompactionContext?: (sessionId: string) => ReactNode,
): ReactNode => {
  switch (entry.kind) {
    case 'user':
      return (
        <>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {entry.text}
          </p>
          {entry.attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {entry.attachments.map((attachment, index) => (
                <li
                  key={`${attachment.kind}-${index}`}
                  className="rounded-flat border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  <span className="text-foreground">
                    {ATTACHMENT_LABEL[attachment.kind]}
                  </span>
                  {' · '}
                  {attachment.name ?? 'sin nombre'}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      );
    case 'answer':
      return entry.isComplete ? (
        <RichText text={entry.text} variant="answer" />
      ) : (
        <InProgress />
      );
    case 'reasoning':
      return entry.isComplete ? (
        <RichText text={entry.text} variant="reasoning" />
      ) : (
        <InProgress />
      );
    case 'tool':
      return <ToolCallEntry entry={entry.entry} />;
    case 'agent-switched':
      return (
        <p className="font-mono text-xs text-foreground">
          {entry.agent}
          {entry.previous ? (
            <span className="text-muted-foreground"> · antes {entry.previous}</span>
          ) : null}
        </p>
      );
    case 'model-switched':
      return (
        <p className="break-all font-mono text-xs text-foreground">
          {formatModel(entry.model)}
          {entry.previous ? (
            <span className="text-muted-foreground">
              {' '}
              · antes {formatModel(entry.previous)}
            </span>
          ) : null}
        </p>
      );
    case 'location-switched':
      return (
        <p className="break-all font-mono text-xs text-foreground">
          {entry.directory}
        </p>
      );
    case 'system':
      return (
        <>
          <p className="whitespace-pre-wrap break-words text-xs text-foreground">
            {entry.text}
          </p>
          <Description value={entry.description} />
        </>
      );
    case 'synthetic':
      return (
        <>
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {entry.text}
          </p>
          <Description value={entry.description} />
        </>
      );
    case 'skill':
      return (
        <>
          <p className="font-mono text-xs text-foreground">
            {entry.name}
            <span className="text-muted-foreground"> · {entry.skill}</span>
          </p>
          {entry.text ? (
            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {entry.text}
            </p>
          ) : null}
        </>
      );
    case 'shell':
      return (
        <div className="flex flex-col gap-1">
          <p className="break-all font-mono text-xs text-foreground">
            $ {entry.command}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">{SHELL_LABEL[entry.status]}</span>
            {entry.exit !== null ? ` · exit ${entry.exit}` : null}
          </p>
        </div>
      );
    case 'compaction':
      return (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">
              {COMPACTION_LABEL[entry.status]}
            </span>
            {` · ${entry.reason}`}
          </p>
          {entry.summary ? (
            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {entry.summary}
            </p>
          ) : null}
          {sessionId && renderCompactionContext
            ? renderCompactionContext(sessionId)
            : null}
        </div>
      );
    case 'question':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-xs text-foreground">
              {entry.title}
            </span>
            <span
              className={`shrink-0 font-mono text-[11px] ${QUESTION_STATE_COLOR[entry.state]}`}
            >
              {QUESTION_STATE_LABEL[entry.state]}
            </span>
          </div>
          {entry.fields.map((field) => (
            <span
              key={field.key}
              className="text-[11px] text-muted-foreground"
            >
              {field.title ?? field.key}
              {field.options.length > 0
                ? ` · ${field.options
                    .map((option) => option.label)
                    .join(', ')}`
                : null}
            </span>
          ))}
          {entry.state === 'answered' && entry.answer ? (
            <span className="text-[11px] text-status-done">
              Respuesta: {entry.answer}
            </span>
          ) : null}
        </div>
      );
    case 'idle':
      return (
        <p className="font-mono text-[11px] text-muted-foreground">
          {IDLE_LABEL[entry.outcome]}
        </p>
      );
  }
};

/**
 * Renderiza una entrada del histórico con una franja/etiqueta plana de tipo
 * (FR-003). El texto del agente se muestra con `RichText` y el razonamiento
 * atenuado; una respuesta no consolidada se indica como "en curso" sin
 * presentar texto parcial como completo (FR-006).
 */
export const HistoryEntry = ({
  entry,
  showReasoning = true,
  sessionId = null,
  renderCompactionContext,
}: HistoryEntryProps) => {
  if (entry.kind === 'reasoning' && !showReasoning) {
    return null;
  }

  return (
    <article
      className={`flex flex-col gap-1 border-l-2 pl-3 ${KIND_STRIPE[entry.kind]}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {KIND_LABEL[entry.kind]}
      </span>
      {renderBody(entry, sessionId, renderCompactionContext)}
    </article>
  );
};
