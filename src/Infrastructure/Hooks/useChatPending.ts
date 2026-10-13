import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  FormDetail,
  FormInfo,
  PermissionRequest,
} from '@opencode/client';
import type { TAttentionItem, TChatPendingItem } from '@app/Domains/Chat';
import type { TGraphNode } from '@app/Domains/Graph';
import { queryKeys } from '@app/Domains/queryKeys';
import { toPendingQuestionEntry } from '../lib/toPendingQuestionEntry';

/**
 * Bandeja de pendientes del chat (T008/US3, FR-006): permisos y preguntas
 * accionables del subárbol abierto, con la etiqueta de su sesión de origen.
 *
 * El data-fetching cross-domain vive aquí, en Infrastructure (Principio II).
 * Los pendientes de permiso se leen de la lista global **ya observada por el
 * llamador** (`listedPermissions`, dueño de la suscripción a
 * `permissions.list()`; incluye hijas porque `permission.asked` trae su
 * `sessionID`) y, como respaldo en frío, de `permissions.for(sessionId)` que
 * siembra el enriquecimiento del grafo. Las preguntas accionables del subárbol
 * se derivan de `attention` (única fuente) y sus campos se leen de la caché
 * `sessions.forms(sessionId)`; el dedupe usa `permission:<id>` /
 * `question:<formId>`.
 *
 * Es la extracción del `useMemo chatPending` de `WorkspacePage.tsx`: mismas
 * claves de caché, mismo dedupe y mismas claves de dependencia (identidad de
 * `nodes`, `attention`, `listedPermissions` y `queryClient`).
 *
 * **Una sola suscripción por clave**: el hook **no** abre observadores propios
 * sobre `permissions.list()`; recibe la lista del llamador. Antes abría su
 * propio `useQuery` con `initialData` de identidad nueva en cada render, lo que
 * duplicaba el observador de la página y realimentaba el ciclo
 * `observerOptionsUpdated` → `read()` → render (bucle infinito al abrir el
 * overlay del histórico). La reactividad es **por props**.
 */
export const useChatPending = (
  attention: TAttentionItem[],
  nodes: TGraphNode[],
  listedPermissions: PermissionRequest[],
): TChatPendingItem[] => {
  const queryClient = useQueryClient();

  return useMemo<TChatPendingItem[]>(() => {
    const subtreeIds = new Set(nodes.map((node) => node.data.sessionId));
    const labelFor = (sessionId: string): string =>
      nodes.find((node) => node.data.sessionId === sessionId)?.data.agentName ??
      sessionId;

    const items: TChatPendingItem[] = [];
    const seen = new Set<string>();

    const addPermission = (permission: PermissionRequest) => {
      if (!subtreeIds.has(permission.sessionID) || seen.has(permission.id)) {
        return;
      }
      seen.add(permission.id);
      items.push({
        kind: 'permission',
        originSessionId: permission.sessionID,
        originLabel: labelFor(permission.sessionID),
        permission: {
          id: permission.id,
          action: permission.action,
          resources: permission.resources,
          message: permission.message ?? null,
        },
      });
    };

    for (const permission of listedPermissions) addPermission(permission);
    for (const sessionId of subtreeIds) {
      const seeded =
        queryClient.getQueryData<PermissionRequest[]>(
          queryKeys.permissions.for(sessionId),
        ) ?? [];
      for (const permission of seeded) addPermission(permission);
    }

    // Preguntas accionables del subárbol (T074, FR-007): `attention` ya acota el
    // subárbol y marca las sesiones en `waiting-input`; los campos se leen de la
    // caché `sessions.forms(id)` que siembra el enriquecimiento del grafo. Así
    // una pregunta de una **sesión hija** se compone con su propio
    // `originSessionId` y `useReplyForm` responde al origen correcto.
    const pendingQuestionSessions = new Set(
      attention
        .filter((item) => item.kind === 'question')
        .map((item) => item.sessionId),
    );
    for (const sessionId of pendingQuestionSessions) {
      const forms =
        queryClient.getQueryData<FormInfo[]>(
          queryKeys.sessions.forms(sessionId),
        ) ?? [];
      for (const form of forms) {
        const key = `question:${form.id}`;
        if (seen.has(key)) continue;
        // Si el detalle ya está cacheado, se respeta su estado: una pregunta
        // resuelta no vuelve a la bandeja (FR-006/FR-011).
        const detail = queryClient.getQueryData<FormDetail>([
          ...queryKeys.sessions.forms(sessionId),
          form.id,
        ]);
        if (detail && detail.state.status !== 'pending') continue;
        seen.add(key);
        items.push({
          kind: 'question',
          originSessionId: sessionId,
          originLabel: labelFor(sessionId),
          question: toPendingQuestionEntry(form),
        });
      }
    }

    return items;
  }, [nodes, listedPermissions, attention, queryClient]);
};
