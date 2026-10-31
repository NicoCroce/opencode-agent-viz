import { useMemo } from 'react';
import type { TSessionStatus } from '../Session.entity';
import { buildSessionsEyebrow, countRunningSessions } from '../lib/sessionRow';
import type { TRootSessionItem } from './useRootSessions';

/**
 * Antetítulo de la página del listado (`N en curso · M sesiones`), derivado de
 * las sesiones raíz sin filtrar y del mapa de estados en vivo.
 */
export const useSessionsEyebrow = (
  items: readonly TRootSessionItem[],
  statuses: Record<string, TSessionStatus> | undefined,
): string =>
  useMemo(
    () =>
      buildSessionsEyebrow({
        running: countRunningSessions(
          items.map((item) => item.session.id),
          statuses,
        ),
        total: items.length,
      }),
    [items, statuses],
  );
