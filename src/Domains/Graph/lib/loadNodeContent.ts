import type { QueryClient } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import type { TExecutionSignal } from '../Graph.entity';
import { deriveExecutionSignals } from './deriveExecutionSignals';
import { mergeExecutionSignals, sameExecutionSignal } from './executionSignal';

/**
 * Carga el contenido de una sesión, lo escribe en las claves compartidas con
 * `eventReducer` (R6) y siembra la señal de ejecución sin pisar lo que ya haya
 * reportado un evento en vivo (frescura, FR-009).
 */
export const loadNodeContent = async (
  queryClient: QueryClient,
  id: string,
): Promise<void> => {
  const [messages, permissions, log, formList, inbox] = await Promise.all([
    opencodeService.getSessionMessages(id),
    opencodeService.getSessionPermissions(id),
    opencodeService.getSessionLog(id),
    opencodeService.listSessionForms(id),
    opencodeService.listSessionInbox(id),
  ]);

  const formDetails = await Promise.all(
    formList.map((form) => opencodeService.getSessionForm(id, form.id)),
  );

  queryClient.setQueryData(queryKeys.sessions.messages(id), messages);
  queryClient.setQueryData(queryKeys.permissions.for(id), permissions);
  queryClient.setQueryData(queryKeys.sessions.log(id), log);
  queryClient.setQueryData(queryKeys.sessions.forms(id), formList);
  for (const detail of formDetails) {
    queryClient.setQueryData(
      [...queryKeys.sessions.forms(id), detail.id],
      detail,
    );
  }
  queryClient.setQueryData(queryKeys.sessions.inbox(id), inbox);

  // La siembra durable completa la señal; los campos ya reportados en vivo
  // ganan (misma precedencia que `useGraphModel`/`useExecutionSignals`).
  const seed = deriveExecutionSignals(log, id);
  queryClient.setQueryData<Record<string, TExecutionSignal>>(
    queryKeys.sessions.execution(id),
    (prev) => {
      const current = prev?.[id];
      const merged = mergeExecutionSignals(seed, current);
      if (current && sameExecutionSignal(current, merged)) return prev;
      return { ...(prev ?? {}), [id]: merged };
    },
  );
};
