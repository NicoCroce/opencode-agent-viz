import { useCallback } from 'react';
import { useURLParams } from '@app/Application/Hooks';
import type { TSession } from '../Session.entity';

interface SessionParams extends Record<string, string | number> {
  session: string;
}

export const useSelectSession = (roots: TSession[]) => {
  const { getParam, updateParams } = useURLParams<SessionParams>();

  const selectedId = getParam('session') ?? roots[0]?.id ?? null;

  const select = useCallback(
    (id: string) => {
      updateParams({ session: id });
    },
    [updateParams],
  );

  return { selectedId, select };
};
