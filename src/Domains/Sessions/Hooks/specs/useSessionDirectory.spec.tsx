import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '@app/Domains/queryKeys';
import { useSessionDirectory } from '../useSessionDirectory';
import type { TRootSessionItem } from '../useRootSessions';
import { buildRootSessionItem, buildSession } from '../../specs/fixtures';

/**
 * Specs de `useSessionDirectory` (feature 011, T014 / US2).
 *
 * Contrato: `specs/011-fix-session-roots-subtree/contracts/session-roots-contract.md`
 * §5 (FR-003) y `research.md` R3 — la cadena de resolución del `directory` es
 * **`items` → `opencodeService.getSession(id)` → `null`**. El respaldo existe
 * porque la lista de raíces ya no garantiza que la sesión abierta esté en la
 * ventana: cuando no está en `items` (el caso que hoy deja la página en skeleton
 * infinito, `WorkspacePage.tsx:137-142`), el `directory` se resuelve con
 * `session.get`, cacheado por id en `sessions.directory(id)`.
 *
 * Se mockea solo la frontera del SDK (`opencodeClient`), nunca el hook.
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    // Respaldo del directorio cuando la sesión no está en `items`.
    getSession: vi.fn(),
  },
}));

/** Directorio del proyecto de la sesión de prueba. */
const DIRECTORY = '/repo/alpha';

const getSession = vi.mocked(opencodeService.getSession);

/**
 * Monta el hook con un `QueryClient` de test aislado y devuelve también el
 * cliente para poder inspeccionar la caché de la key de respaldo.
 */
const renderDirectory = (id: string | null, items: TRootSessionItem[]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(() => useSessionDirectory(id, items), { wrapper }),
    queryClient,
  };
};

describe('useSessionDirectory — directory con respaldo (FR-003, R3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the directory from items without touching the network', () => {
    const items = [
      buildRootSessionItem({ id: 'alpha-root', directory: DIRECTORY }),
      buildRootSessionItem({ id: 'beta-root', directory: '/repo/beta' }),
    ];

    const { result } = renderDirectory('alpha-root', items);

    expect(result.current.directory).toBe(DIRECTORY);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    // Remate: la sesión ya está en la lista, el respaldo no debe dispararse.
    expect(getSession).not.toHaveBeenCalled();
  });

  it('falls back to session.get when the session is outside items (no infinite loading)', async () => {
    const session = buildSession({ id: 'alpha-outside', directory: DIRECTORY });
    getSession.mockResolvedValue(session);
    // La sesión no está en la ventana que alimenta el listado: es el caso que
    // hoy resuelve `directory` a `null` y deja la pantalla en skeleton.
    const items: TRootSessionItem[] = [];

    const { result, queryClient } = renderDirectory('alpha-outside', items);

    await waitFor(() => expect(result.current.directory).toBe(DIRECTORY));
    // El respaldo se pide con el id exacto y una sola vez.
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledWith('alpha-outside');
    // No queda en loading: al resolver el respaldo el directorio está listo.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    // Se cachea por id (los eventos no siempre exponen el directory).
    expect(
      queryClient.getQueryData(queryKeys.sessions.directory('alpha-outside')),
    ).toEqual(session);
  });

  it('returns null and stops loading when the session cannot be resolved', async () => {
    getSession.mockRejectedValue(new Error('session not found'));
    const items: TRootSessionItem[] = [];

    const { result } = renderDirectory('alpha-missing', items);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.directory).toBeNull();
    // El fallo se declara (estados honestos, Principio VI): no se confunde con
    // "aún cargando".
    expect(result.current.isError).toBe(true);
  });

  it('short-circuits to null without loading when there is no id', () => {
    const items = [
      buildRootSessionItem({ id: 'alpha-root', directory: DIRECTORY }),
    ];

    const { result } = renderDirectory(null, items);

    expect(result.current.directory).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(getSession).not.toHaveBeenCalled();
  });
});
