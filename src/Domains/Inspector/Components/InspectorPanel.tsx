import { CompactionContext, Container } from '@app/Application/Components';
import { useAnomalyThreshold } from '@app/Application/Hooks';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { useControlledReasoning } from '../Hooks/useControlledReasoning';
import { useContextMetrics } from '../Hooks/useContextMetrics';
import { useInspectorData } from '../Hooks/useInspectorData';
import { AdvancedSection } from './AdvancedSection';
import { AnswersSection } from './AnswersSection';
import { ContextSection } from './ContextSection';
import { ErrorsSection } from './ErrorsSection';
import { FileChanges } from './FileChanges';
import { InspectorEmptyPrompt } from './InspectorEmptyPrompt';
import { InspectorIdentity } from './InspectorIdentity';
import { LatencySection } from './LatencySection';
import { MetricsSection } from './MetricsSection';
import { ModelSection } from './ModelSection';
import { ParallelismSection } from './ParallelismSection';
import { ParentImpactRow } from './ParentImpactRow';
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
   * con `useControlledReasoning`; US2 la controla desde `WorkspacePage` para
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
  /**
   * Navega a otro nodo del grafo por su id de sesión (FR-014). Lo usa el
   * apartado "Aporte al padre" para saltar al agente que invocó al nodo
   * seleccionado. Sin handler, el control queda visible pero inerte.
   */
  onNavigateToNode?: (nodeId: string) => void;
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
  onNavigateToNode,
}: InspectorPanelProps) => {
  // Modo no controlado por defecto (US1); US2 puede imponer la visibilidad
  // compartida con el overlay pasando `showReasoning`/`onToggleReasoning`.
  const { visible: reasoningVisible, toggle: toggleReasoning } =
    useControlledReasoning(showReasoning, onToggleReasoning);

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
    isError,
    isLoading,
  } = useInspectorData(node);

  const contextMetrics = useContextMetrics(node, invokedBy);

  // Umbral de anomalía de latencia (FR-022): preferencia compartida con el
  // grafo; el control vive en `LatencySection` y lo lee el enriquecimiento.
  const { threshold, setThreshold } = useAnomalyThreshold();

  if (!node) {
    return <InspectorEmptyPrompt />;
  }

  const { metrics, model } = node.data;

  return (
    <Container space="medium" className="overflow-auto p-4">
      {/*
        Identidad del nodo: título completo (sin cortar) + agente + estado +
        directorio. El control de pantalla completa vive en la cabecera
        compartida de `InspectorPane`, visible en `Detalle` y `Chat` (U6).
      */}
      <Container space="small" align="start" className="min-w-0">
        <InspectorIdentity node={node} invokedBy={invokedBy} />
      </Container>

      {/* Modelo: nombre y razonamiento (variante del modelo) (FR-003) */}
      <ModelSection model={model} />

      {/* Métricas: duración, costo, invocaciones, tokens y aviso de loop (FR-004) */}
      <MetricsSection metrics={metrics} />

      {/* Contexto: composición, ventana/caché y, más adelante, paralelismo y
          aporte al padre (FR-015..FR-017). La latencia (respuestas y anomalías)
          vive dentro del desplegable "Avanzado". */}
      <ContextSection
        context={contextMetrics.context}
        tokens={metrics.tokens}
        compactionEffect={contextMetrics.compactionEffect}
        isError={isError}
        isLoading={isLoading}
      >
        <ParallelismSection speedup={node.data.speedup ?? null} />
        <ParentImpactRow
          impact={contextMetrics.parentImpact}
          parentTitle={
            invokedBy
              ? (invokedBy.data.title ?? invokedBy.data.agentName)
              : null
          }
          onNavigate={onNavigateToNode}
          isError={contextMetrics.isError}
          isLoading={contextMetrics.isLoading}
        />
      </ContextSection>

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
        Preguntas y permisos → Errores → Latencia (FR-011; la latencia incluye
        el listado de respuestas medidas y las anomalías, FR-018..FR-023).
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

        {/*
          Latencia: listado de respuestas medidas (TTFT y total) y anomalías
          bidireccionales, con la referencia y el control de umbral (FR-018..FR-023).
          Se coloca dentro de "Avanzado" para no saturar el panel principal.
        */}
        <LatencySection
          latency={contextMetrics.context?.latency ?? null}
          threshold={threshold}
          onThresholdChange={setThreshold}
        />
      </AdvancedSection>
    </Container>
  );
};
