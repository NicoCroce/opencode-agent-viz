import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { useRootSessions } from '../useRootSessions';
import { buildSession } from '../../specs/fixtures';

/**
 * Specs del hook de raíces listables del listado de sesiones (feature 011, T008).
 *
 * Contrato congelado: `specs/011-fix-session-roots-subtree/contracts/session-roots-contract.md`
 * §3/§4 (R2). La fuente pasa de `listSessions` (ventana de 200 sin filtrar, que
 * dejaba hijas dentro y raíces fuera) a `listRootSessions` (`parentID: null` +
 * cursor), que devuelve `{ sessions, truncated }`.
 *
 * El server ya filtra las raíces, pero la respuesta puede traer hijas mezcladas
 * (defensa en profundidad, data-model §1): el hook debe descartarlas todas.
 * `truncated` se **agrega** sobre todos los proyectos para el aviso del listado
 * (data-model §7).
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    listProjects: vi.fn(),
    // Fuente nueva de la lista: raíces del proyecto, paginadas por cursor.
    listRootSessions: vi.fn(),
    // La ventana cruda de `/session` deja de alimentar el listado.
    listSessions: vi.fn(),
  },
}));

const DIRECTORY_A = '/repo-a';
const DIRECTORY_B = '/repo-b';

const listProjects = vi.mocked(opencodeService.listProjects);
const listRootSessions = vi.mocked(opencodeService.listRootSessions);
const listSessions = vi.mocked(opencodeService.listSessions);

/** Resultado de raíces por directorio, tal como lo devuelve el servicio. */
type RootsResponse = Awaited<ReturnType<typeof opencodeService.listRootSessions>>;

/** Proyectos descubiertos: un directorio consultable por cada uno. */
const mockProjects = (): void => {
  listProjects.mockResolvedValue([
    {
      id: 'p1',
      canonical: DIRECTORY_A,
      time: { created: 1, updated: 1, active: 1 },
      sandboxes: [],
    },
    {
      id: 'p2',
      canonical: DIRECTORY_B,
      time: { created: 1, updated: 1, active: 1 },
      sandboxes: [],
    },
  ]);
};

/** Responde `listRootSessions` con el payload indicado para cada directorio. */
const mockRoots = (byDirectory: Record<string, RootsResponse>): void => {
  listRootSessions.mockImplementation((directory = '') =>
    Promise.resolve(byDirectory[directory] ?? { sessions: [], truncated: false }),
  );
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

const renderRootSessions = () => renderHook(() => useRootSessions(), { wrapper });

/** Ids visibles de un proyecto, en el orden en que el listado los pinta. */
const idsIn = (
  groupList: { directory: string; items: { session: { id: string } }[] }[],
  directory: string,
): string[] =>
  groupList
    .find((group) => group.directory === directory)
    ?.items.map((item) => item.session.id) ?? [];

describe('useRootSessions — solo raíces (FR-001, FR-002; R2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects();
    listSessions.mockResolvedValue([]);
  });

  it('lists only the roots of every project when the response mixes children in', async () => {
    mockRoots({
      [DIRECTORY_A]: {
        // Hijas recientes intercaladas: si el filtro no se aplica, desplazan a
        // las raíces del listado (el bug de la ventana de 200).
        sessions: [
          buildSession({
            id: 'alpha-grandchild',
            parentID: 'alpha-child',
            directory: DIRECTORY_A,
            updated: 6_000,
          }),
          buildSession({
            id: 'alpha-child',
            parentID: 'alpha-root',
            directory: DIRECTORY_A,
            updated: 5_000,
          }),
          buildSession({
            id: 'alpha-root',
            directory: DIRECTORY_A,
            updated: 3_000,
          }),
          buildSession({
            id: 'alpha-old-root',
            directory: DIRECTORY_A,
            updated: 1_000,
          }),
        ],
        truncated: false,
      },
      [DIRECTORY_B]: {
        sessions: [
          buildSession({
            id: 'beta-child',
            parentID: 'beta-root',
            directory: DIRECTORY_B,
            updated: 4_000,
          }),
          buildSession({
            id: 'beta-root',
            directory: DIRECTORY_B,
            updated: 2_000,
          }),
        ],
        truncated: false,
      },
    });

    const { result } = renderRootSessions();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // La lista sale del servicio de raíces, una consulta por proyecto.
    expect(listRootSessions).toHaveBeenCalledWith(DIRECTORY_A);
    expect(listRootSessions).toHaveBeenCalledWith(DIRECTORY_B);
    expect(listSessions).not.toHaveBeenCalled();

    expect(result.current.items.map((item) => item.session.id)).toEqual([
      'alpha-root',
      'beta-root',
      'alpha-old-root',
    ]);
    expect(
      result.current.items.every((item) => item.session.parentID === undefined),
    ).toBe(true);

    expect(
      [...result.current.groups.map((group) => group.directory)].sort(),
    ).toEqual([DIRECTORY_A, DIRECTORY_B]);
    expect(idsIn(result.current.groups, DIRECTORY_A)).toEqual([
      'alpha-root',
      'alpha-old-root',
    ]);
    expect(idsIn(result.current.groups, DIRECTORY_B)).toEqual(['beta-root']);

    expect(result.current.truncated).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('drops every session when a project only returns children', async () => {
    mockRoots({
      [DIRECTORY_A]: {
        sessions: [
          buildSession({
            id: 'alpha-child',
            parentID: 'alpha-root',
            directory: DIRECTORY_A,
            updated: 5_000,
          }),
        ],
        truncated: false,
      },
    });

    const { result } = renderRootSessions();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listRootSessions).toHaveBeenCalledWith(DIRECTORY_A);
    expect(result.current.items).toEqual([]);
    expect(result.current.groups).toEqual([]);
  });
});

describe('useRootSessions — truncated agregado (data-model §7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects();
    listSessions.mockResolvedValue([]);
  });

  it('reports the truncation of any project, not just the first one', async () => {
    mockRoots({
      [DIRECTORY_A]: {
        sessions: [
          buildSession({
            id: 'alpha-root',
            directory: DIRECTORY_A,
            updated: 3_000,
          }),
        ],
        truncated: false,
      },
      [DIRECTORY_B]: {
        sessions: [
          buildSession({
            id: 'beta-root',
            directory: DIRECTORY_B,
            updated: 2_000,
          }),
        ],
        // El conjunto de este proyecto no está completo: el aviso debe verse.
        truncated: true,
      },
    });

    const { result } = renderRootSessions();

    await waitFor(() => expect(result.current.truncated).toBe(true));

    expect(result.current.items.map((item) => item.session.id)).toEqual([
      'alpha-root',
      'beta-root',
    ]);
  });
});
