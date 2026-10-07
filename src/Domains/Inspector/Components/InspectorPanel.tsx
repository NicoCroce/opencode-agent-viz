import {
  CompactionContext,
  Container,
  StatusDot,
} from '@app/Application/Components';
import { NODE_STATUS_LABEL, folderName } from '@app/Application/Helpers';
import { useReasoningVisibility } from '@app/Application/Hooks';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { useInspectorData } from '../Hooks/useInspectorData';
import { AdvancedSection } from './AdvancedSection';
import { AnswersSection } from './AnswersSection';
import { ErrorsSection } from './ErrorsSection';
import { FileChanges } from './FileChanges';
import { MetricsSection } from './MetricsSection';
import { ModelSection } from './ModelSection';
import { QuestionsSection } from './QuestionsSection';
import { ResourceList } from './ResourceList';
import { SubagentsSection } from './SubagentsSection';
import { ToolHistory } from './ToolHistory';
import { ToolStats } from './ToolStats';

interface InspectorPanelProps {
  node: TGraphNode | null;
  /** Otros agentes del mismo grupo de paralelismo que `node`. */
  parallelPeers?: TGraphNode[];
  /** Nodo que invocó a `node` (relación padre → hijo), si lo hay. */
  invokedBy?: TGraphNode | null;
  /**
   * Visibilidad del razonamiento. Si se omite, el panel la gestiona localmente
   * con `useReasoningVisibility`; US2 la controla desde `WorkspacePage` para
   * que coincida con el overlay (contrato rich-text).
   */
  showReasoning?: boolean;
  /** Alterna la visibilidad del razonamiento (FR-002). */
  onToggleReasoning?: () => void;
  /**
   * Abre el histórico completo del agente (FR-008). Se reenvía a
   * `AnswersSection`, cuyo botón "Ver histórico completo" lo dispara; el
   * handler real vive en `WorkspacePage` (US2/T041). Sin handler, el botón
   * queda visible pero inerte.
   */
  onOpenHistory?: () => void;
}

/**
 * Orquestador puro del panel de detalles (FR-001/SC-003).
 *
 * Con un nodo seleccionado compone las secciones de datos en el orden exacto
 * identidad → Modelo → Métricas → Recursos → Duración mediana por herramienta →
 * Subagentes → Archivos. El contenido técnico (Herramientas, Respuestas,
 * Preguntas y permisos, Errores) se reintroduce dentro del desplegable
 * "Avanzado" en US2 (FR-010..FR-015); el bloque `Subagentes` se compone con
 * `SubagentsSection` (US3, FR-007/FR-008).
 */
export const InspectorPanel = ({
  node,
  parallelPeers = [],
  invokedBy = null,
  showReasoning,
  onToggleReasoning,
  onOpenHistory,
}: InspectorPanelProps) => {
  // Modo no controlado por defecto (US1); US2 puede imponer la visibilidad
  // compartida con el overlay pasando `showReasoning`/`onToggleReasoning`.
  const localReasoning = useReasoningVisibility(false);
  const reasoningVisible = showReasoning ?? localReasoning.visible;
  const toggleReasoning = onToggleReasoning ?? localReasoning.toggle;

  const {
    tools,
    errors,
    tasks,
    resources,
    entries,
    diff,
    forms,
    permissions,
    inbox,
    context,
  } = useInspectorData(node);

  if (!node) {
    return (
      <Container space="small" className="p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Inspector
        </span>
        <p className="text-xs text-muted-foreground">
          Selecciona un nodo del grafo para ver su detalle.
        </p>
      </Container>
    );
  }

  const { metrics, model } = node.data;

  return (
    <Container space="medium" className="overflow-auto p-4">
      {/* Identidad: título completo (sin cortar) + agente + estado + directorio */}
      <Container space="small">
        <span className="text-sm font-semibold leading-snug text-foreground">
          {node.data.title ?? node.data.agentName}
        </span>
        <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <StatusDot status={node.data.status} />
          <span className="text-foreground">{node.data.agentName}</span>
          <span aria-hidden>·</span>
          <span>{NODE_STATUS_LABEL[node.data.status]}</span>
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

      {/* Modelo: nombre y razonamiento (variante del modelo) (FR-003) */}
      <ModelSection model={model} />

      {/* Métricas: duración, costo, invocaciones, tokens y aviso de loop (FR-004) */}
      <MetricsSection metrics={metrics} />

      {/* Recursos configurados para el agente (FR-005) */}
      <ResourceList resources={resources} />

      {/* Duración mediana por herramienta (FR-006) */}
      <ToolStats tools={tools} />

      {/* Subagentes: tareas delegadas y agentes en paralelo (FR-007/FR-008) */}
      <SubagentsSection tasks={tasks} parallelPeers={parallelPeers} />

      {/* Impacto del agente en el repositorio (FR-009) */}
      <FileChanges
        changes={diff.changes}
        isError={diff.isError}
        isLoading={diff.isLoading}
      />

      {/*
        Contenido técnico agrupado bajo el desplegable "Avanzado" (FR-010..FR-015),
        colapsado por defecto. Orden interno: Herramientas → Respuestas →
        Preguntas y permisos → Errores (FR-011).
      */}
      <AdvancedSection>
        <ToolHistory tools={tools} />

        <AnswersSection
          entries={entries}
          showReasoning={reasoningVisible}
          onToggleReasoning={toggleReasoning}
          onOpenHistory={onOpenHistory}
          sessionId={node.data.sessionId}
          renderCompactionContext={() => (
            <CompactionContext
              messages={context.messages}
              isError={context.isError}
              isLoading={context.isLoading}
            />
          )}
        />

        <QuestionsSection
          permissions={permissions.permissions}
          questions={forms.questions}
          queuedTurns={inbox.queuedTurns}
          isError={forms.isError || permissions.isError || inbox.isError}
          isLoading={
            forms.isLoading || permissions.isLoading || inbox.isLoading
          }
        />

        <ErrorsSection errors={errors} />
      </AdvancedSection>
    </Container>
  );
};
