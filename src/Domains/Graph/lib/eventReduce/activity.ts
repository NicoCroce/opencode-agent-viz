import type { TActivityMap } from '../../Graph.entity';
import { queryKeys } from '../../../queryKeys';
import { setActivity } from './cache';
import type { TReducibleEvent } from './eventTypes';
import { set } from './queryUpdates';
import type { TQueryUpdate } from './queryUpdates';

/**
 * Extrae el `sessionID` del evento sin importar su familia (contract
 * session-activity §2): `form.created` lo anida en `data.form`, el resto lo
 * expone en `data.sessionID`. Devuelve `null` para eventos sin sesión
 * (`server.connected` y afines).
 */
const sessionIdOf = (event: TReducibleEvent): string | null => {
  if (event.type === 'form.created') return event.data.form.sessionID;

  const data = event.data as { sessionID?: unknown };
  return typeof data.sessionID === 'string' ? data.sessionID : null;
};

/**
 * Marca de actividad (FR-009, contract session-activity §2): devuelve un
 * `TQueryUpdate` que patchea `queryKeys.sessions.activity()` con el
 * `event.created` para **todo** evento con `sessionID` —incluidos los deltas,
 * de los que solo se toma su marca temporal— y `null` para eventos sin sesión
 * (`server.connected`). El `max` acumulado (via `setActivity`) mantiene la
 * marca monótona: nunca retrocede ni se adelanta al evento.
 */
export const reduceActivity = (event: TReducibleEvent): TQueryUpdate | null => {
  if (!('created' in event) || typeof event.created !== 'number') return null;

  const sessionID = sessionIdOf(event);
  if (sessionID === null) return null;

  return set(queryKeys.sessions.activity(), (prev) =>
    setActivity(prev as TActivityMap, sessionID, event.created),
  );
};
