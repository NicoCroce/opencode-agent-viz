import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDevice, useEscapeKey, useReasoningVisibility } from '@app/Application/Hooks';
import {
  useChainSelection,
  useFollowMode,
  useGraphModel,
} from '@app/Domains/Graph';
import {
  sessionDetailPath,
  useGetSessionStatus,
  useRootSessions,
} from '@app/Domains/Sessions';
import { useSessionContext, useSessionForms } from '@app/Domains/Inspector';
import { useHistory } from '@app/Domains/History';
import { GraphPane } from './Components/GraphPane';
import { HistoryOverlay } from './Components/HistoryOverlay';
import { InspectorPane } from './Components/InspectorPane';
import { SessionsRail } from './Components/SessionsRail';
import { WorkspaceLayout } from './Components/WorkspaceLayout';
import { useHistoryOverlay } from './Hooks/useHistoryOverlay';
import { useSessionOpenPerf } from './Hooks/useSessionOpenPerf';
import { useWorkspaceSummary } from './Hooks/useWorkspaceSummary';
import type { TWorkspaceTab } from './WorkspacePage.constants';

export const WorkspacePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const [tab, setTab] = useState<TWorkspaceTab>('graph');

  const { groups, items, isLoading: sessionsLoading } = useRootSessions();
  const statusQuery = useGetSessionStatus();
  const directory = useMemo(
    () =>
      items.find((item) => item.session.id === id)?.session.location.directory ??
      null,
    [items, id],
  );
  const graph = useGraphModel(id ?? null, directory);
  const follow = useFollowMode(graph.activeNodeId);

  useSessionOpenPerf({
    id: id ?? null,
    directory,
    isLoading: graph.isLoading,
    isError: graph.isError,
    nodeCount: graph.graph.nodes.length,
  });

  const { summary } = useWorkspaceSummary({
    items,
    id: id ?? null,
    graph: graph.graph,
  });

  const rootId = id ?? null;
  const { selectedNodeId, inspectedNodeId, selectNode, clearSelection } =
    useChainSelection(rootId);

  // Overlay del histórico (FR-008/012/014) y razonamiento compartido (FR-002).
  const { targetId, open, close, navigateTo } = useHistory();
  const reasoning = useReasoningVisibility();

  const {
    node: historyNode,
    lineage: historyLineage,
    missingId,
    clearMissing,
  } = useHistoryOverlay({
    graph: graph.graph,
    targetId,
    rootId,
    isLoading: graph.isLoading,
    isError: graph.isError,
    onClose: close,
  });

  useEscapeKey(clearSelection, selectedNodeId !== null);

  // Preguntas (FR-033) y contexto de compactación (FR-035) del histórico:
  // Infrastructure pide los datos al dominio Inspector y los inyecta por props.
  const historySessionId = historyNode?.data.sessionId ?? null;
  const historyForms = useSessionForms(historySessionId);
  const historyContext = useSessionContext(historySessionId);

  const rail = (
    <SessionsRail
      groups={groups}
      statuses={statusQuery.data}
      selectedId={id ?? null}
      isLoading={sessionsLoading}
      onSelect={(sessionId) => {
        void navigate(sessionDetailPath(sessionId));
      }}
    />
  );

  const graphPane = (
    <GraphPane
      graph={graph}
      summary={summary}
      follow={follow}
      selectedNodeId={selectedNodeId}
      onSelectNode={selectNode}
      onClearSelection={clearSelection}
      onOpenHistory={open}
      rootId={rootId}
    />
  );

  const inspectorPane = (
    <InspectorPane
      graph={graph.graph}
      parallelGroups={graph.parallelGroups}
      inspectedNodeId={inspectedNodeId}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onOpenHistory={open}
    />
  );

  const historyOverlay = (
    <HistoryOverlay
      node={historyNode}
      lineage={historyLineage}
      missingId={missingId}
      onClearMissing={clearMissing}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onNavigate={navigateTo}
      onClose={close}
      questions={historyForms.questions}
      context={historyContext}
    />
  );

  return (
    <WorkspaceLayout
      isMobile={Boolean(isMobile)}
      tab={tab}
      onChangeTab={setTab}
      sessions={rail}
      graph={graphPane}
      inspector={inspectorPane}
      history={historyOverlay}
    />
  );
};
