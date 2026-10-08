import { useMemo } from 'react';
import type { TGraphNode } from '../../Graph/Graph.entity';
import type { THistoryEntry } from '../../History/History.entity';
import type {
  TResourceUsage,
  TSessionContextResult,
  TSessionDiffResult,
  TSessionFormsResult,
  TSessionInboxResult,
  TSessionPermissionsResult,
  TTaskEntry,
  TToolHistoryEntry,
} from '../Inspector.entity';
import { deriveResources } from '../lib/deriveResources';
import {
  useGetInstructions,
  useGetMcpServers,
  useSessionContext,
  useSessionDiff,
  useSessionForms,
  useSessionInbox,
  useSessionMessages,
  useSessionPermissions,
} from '../Inspector.service';
import { useInspectorDerivations } from './useInspectorDerivations';

export interface InspectorData {
  tools: TToolHistoryEntry[];
  tasks: TTaskEntry[];
  errors: { message: string; at: number }[];
  resources: TResourceUsage;
  /** Entradas del histórico (respuestas, razonamiento, herramientas, …) en orden. */
  entries: THistoryEntry[];
  /** Impacto del agente en el repositorio (archivos + parches, FR-028..FR-030). */
  diff: TSessionDiffResult;
  /** Preguntas dirigidas al usuario y su estado (FR-032/FR-033). */
  forms: TSessionFormsResult;
  /** Permisos que la sesión está esperando (FR-031). */
  permissions: TSessionPermissionsResult;
  /** Cola de turnos pendientes (FR-034). */
  inbox: TSessionInboxResult;
  /** Contexto resultante de una compactación (FR-035), bajo demanda. */
  context: TSessionContextResult;
  /** Estado de la consulta de mensajes de la sesión. */
  isError: boolean;
  isLoading: boolean;
}

export const useInspectorData = (node: TGraphNode | null): InspectorData => {
  const sessionId = node?.data.sessionId ?? null;
  const directory = node?.data.directory ?? null;

  const messagesQuery = useSessionMessages(sessionId);

  const mcpQuery = useGetMcpServers(directory);
  const instructionsQuery = useGetInstructions(sessionId);
  const diff = useSessionDiff(sessionId);
  const forms = useSessionForms(sessionId);
  const permissions = useSessionPermissions(sessionId);
  const inbox = useSessionInbox(sessionId);
  const context = useSessionContext(sessionId);

  const { tools, tasks, errors, toolsUsed, entries } = useInspectorDerivations(
    messagesQuery.messages,
    forms.questions,
  );

  const resources: TResourceUsage = useMemo(
    () =>
      deriveResources({
        mcpServers: mcpQuery.data ?? [],
        instructions: instructionsQuery.data ?? [],
        tools: toolsUsed,
      }),
    [mcpQuery.data, instructionsQuery.data, toolsUsed],
  );

  return {
    tools,
    tasks,
    errors,
    resources,
    entries,
    diff,
    forms,
    permissions,
    inbox,
    context,
    isError: messagesQuery.isError,
    isLoading: messagesQuery.isLoading,
  };
};
