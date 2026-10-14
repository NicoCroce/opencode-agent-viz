import type { ReactNode } from 'react';
import { CompactionContext, Container } from '@app/Application/Components';
import { useAnomalyThreshold } from '@app/Application/Hooks';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { TInspectorSectionTab } from '../Hooks/useInspectorSectionTabs';
import { useControlledReasoning } from '../Hooks/useControlledReasoning';
import { useContextMetrics } from '../Hooks/useContextMetrics';
import { useInspectorData } from '../Hooks/useInspectorData';
import { AnswersSection } from './AnswersSection';
import { ContextSection } from './ContextSection';
import { ErrorsSection } from './ErrorsSection';
import { FileChanges } from './FileChanges';
import { InspectorEmptyPrompt } from './InspectorEmptyPrompt';
import { InspectorIdentity } from './InspectorIdentity';
import { InspectorSectionTabs } from './InspectorSectionTabs';
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
 * Con un nodo seleccionado compone el **resumen continuo** —identidad → Modelo →
 * Métricas → Contexto (Paralelismo + Aporte al padre) → Recursos → Duración
 * mediana por herramienta— y cierra el eje vertical con el **tablist de
 * secciones técnicas** (`InspectorSectionTabs`, FR-001/FR-002): Subagentes,
 * Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores y Latencia.
 * El tablist es el último bloque del `Container`, sin `sticky`, sin `key` y sin
 * efectos de reset (research R1): su estado es efímero y vive en
 * `InspectorSectionTabs`.
 *
 * Las siete secciones llegan ya construidas en un `Record` **exhaustivo por
 * tipo** (TS estricto obliga a aportar una sección por pestaña) y conservan
 * literalmente sus props; cada sección resuelve sus propios estados
 * (error → carga → vacío → datos, Principio VI). Presentación pura: la lógica
 * de datos vive en los hooks del dominio.
 *
 * Las cuatro secciones sin estado propio (Subagentes, Herramientas, Respuestas
 * y Errores) reciben `isError`/`isLoading` de la consulta de mensajes de
 * `useInspectorData` (FR-008/SC-005): nunca muestran su vacío mientras la
 * fuente está en carga o en error. Archivos, Preguntas y permisos y Latencia
 * conservan sus fuentes actuales.
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

  // Una entrada por pestaña, exhaustiva por tipo (contrato §3): añadir una
  // pestaña obliga a aportar aquí su sección.
  const sections: Record<TInspectorSectionTab, ReactNode> = {
    subagents: (
      <SubagentsSection
        tasks={tasks}
        parallelPeers={parallelPeers}
        isError={isError}
        isLoading={isLoading}
      />
    ),
    files: (
      <FileChanges
        changes={diff.changes}
        isError={diff.isError}
        isLoading={diff.isLoading}
      />
    ),
    tools: (
      <ToolHistory tools={tools} isError={isError} isLoading={isLoading} />
    ),
    answers: (
      <AnswersSection
        entries={entries}
        showReasoning={reasoningVisible}
        onToggleReasoning={toggleReasoning}
        onOpenHistory={onOpenHistory}
        sessionId={node.data.sessionId}
        isError={isError}
        isLoading={isLoading}
        renderCompactionContext={() => (
          <CompactionContext
            messages={context.messages}
            isError={context.isError}
            isLoading={context.isLoading}
          />
        )}
      />
    ),
    questions: (
      <QuestionsSection
        permissions={permissions.permissions}
        questions={forms.questions}
        queuedTurns={inbox.queuedTurns}
        isError={forms.isError || permissions.isError || inbox.isError}
        isLoading={
          forms.isLoading || permissions.isLoading || inbox.isLoading
        }
      />
    ),
    errors: (
      <ErrorsSection errors={errors} isError={isError} isLoading={isLoading} />
    ),
    latency: (
      <LatencySection
        latency={contextMetrics.context?.latency ?? null}
        threshold={threshold}
        onThresholdChange={setThreshold}
        isError={contextMetrics.isError}
        isLoading={contextMetrics.isLoading}
      />
    ),
  };

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

      {/* Contexto: composición, ventana/caché, paralelismo y aporte al padre
          (FR-015..FR-017). Permanece en el resumen continuo, sin pestañas
          intercaladas; la latencia (respuestas y anomalías) vive en la pestaña
          Latencia. */}
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

      {/*
        Tablist de secciones técnicas (FR-001/FR-002): último bloque del eje
        vertical, sin `sticky`, `key` ni efectos de reset (research R1). El
        estado activo es efímero y lo posee `InspectorSectionTabs`; al cerrar el
        detalle (`node = null`) se desmonta y reabrir vuelve a `Subagentes`.
      */}
      <InspectorSectionTabs sections={sections} />
    </Container>
  );
};
