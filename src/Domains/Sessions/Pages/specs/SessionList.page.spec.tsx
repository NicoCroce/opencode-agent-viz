import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Project, SessionInfo } from '@opencode/client';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { SessionListPage } from '../SessionList.page';
import { FILTER_PARAM_KEYS } from '../../lib/sessionFilters';
import { buildSession } from '../../specs/fixtures';

/**
 * Spec de integración de la página del listado (feature 005).
 *
 * Contrato congelado:
 * `specs/005-session-filters/contracts/session-filters-contract.md` §1 y §7.
 *
 * Se monta la página completa con las **dependencias reales** (`useRootSessions`,
 * `useSessionFilters`, `SessionFilterBar`, `SessionList`) y solo se sustituye el
 * origen de datos (`opencodeService`), de modo que el test verifica la
 * integración de verdad: el orden de estados error→carga→vacío→datos (FR-019),
 * la barra visible en "datos" (FR-024), el filtrado por proyecto (FR-005) y el
 * estado vacío de filtros accionable (FR-011, SC-005).
 *
 * Bloques posteriores amplían el mismo fichero: el cableado del rango y la
 * recomposición en vivo (T020), la restauración/degradación desde la URL (T026)
 * y el ida-y-vuelta al detalle (T033).
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    listProjects: vi.fn(),
    listSessions: vi.fn(),
  },
}));

const PROJ_A = '/repo/alpha';
const PROJ_B = '/repo/beta';
const PROJ_C = '/repo/gamma';
const DAY_MS = 86_400_000;

const listProjects = vi.mocked(opencodeService.listProjects);
const listSessions = vi.mocked(opencodeService.listSessions);

const buildProject = (canonical: string): Project => ({
  id: canonical,
  canonical,
  time: { created: 1, updated: 1, active: 1 },
  sandboxes: [],
});

/** Proyectos descubiertos por `/project`; dirigen las queries de sesiones. */
const mockProjects = (...canonicals: string[]): void => {
  listProjects.mockResolvedValue(canonicals.map(buildProject));
};

/** Sesiones por directorio, tal como las devuelve el endpoint scopeado. */
const mockSessions = (byDirectory: Record<string, SessionInfo[]>): void => {
  listSessions.mockImplementation((directory) =>
    Promise.resolve(byDirectory[directory ?? ''] ?? []),
  );
};

const session = (
  id: string,
  directory: string,
  updated = Date.now(),
): SessionInfo =>
  buildSession({ id, directory, title: `session ${id}`, updated });

const urlWith = (params: Record<string, string>): string =>
  `/sessions?${new URLSearchParams(params).toString()}`;

const getBar = (): HTMLElement | null =>
  screen.queryByTestId('session-filter-bar');

const getProjectTrigger = (): HTMLElement =>
  screen.getByRole('button', { name: /filtrar por proyecto/i });

describe('SessionListPage — orden de estados (FR-019)', () => {
  it('renders the error state when the projects query fails', async () => {
    listProjects.mockRejectedValue(new Error('sin conexión'));

    renderWithProviders(<SessionListPage />, { initialEntries: ['/sessions'] });

    expect(await screen.findByText('sin conexión')).toBeInTheDocument();
    expect(getBar()).not.toBeInTheDocument();
  });

  it('renders the loading skeleton before any data arrives', () => {
    listProjects.mockReturnValue(
      new Promise<Project[]>(() => {
        /* nunca resuelve: mantiene el estado de carga */
      }),
    );

    const { container } = renderWithProviders(<SessionListPage />, {
      initialEntries: ['/sessions'],
    });

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
    expect(screen.queryByText('Sin sesiones')).not.toBeInTheDocument();
    expect(getBar()).not.toBeInTheDocument();
  });

  it('renders "Sin sesiones" (without filter bar) when there are no sessions at all', async () => {
    mockProjects(PROJ_A);
    mockSessions({ [PROJ_A]: [] });

    renderWithProviders(<SessionListPage />, { initialEntries: ['/sessions'] });

    expect(await screen.findByText('Sin sesiones')).toBeInTheDocument();
    expect(getBar()).not.toBeInTheDocument();
  });

  it('renders the always-visible filter bar above the list when there are sessions (FR-024)', async () => {
    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [session('a1', PROJ_A)],
      [PROJ_B]: [session('b1', PROJ_B)],
    });

    renderWithProviders(<SessionListPage />, { initialEntries: ['/sessions'] });

    expect(await screen.findByTestId('session-filter-bar')).toBeVisible();
    expect(screen.getByText('session a1')).toBeInTheDocument();
    expect(screen.getByText('session b1')).toBeInTheDocument();
  });
});

describe('SessionListPage — filtrado por proyecto (FR-005, FR-024)', () => {
  it('narrows the list to the selected project and hides the other groups', async () => {
    const user = userEvent.setup();
    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [session('a1', PROJ_A)],
      [PROJ_B]: [session('b1', PROJ_B)],
    });

    renderWithProviders(<SessionListPage />, { initialEntries: ['/sessions'] });
    await screen.findByText('session a1');

    await user.click(getProjectTrigger());
    await user.click(screen.getByRole('checkbox', { name: /beta/ }));

    await waitFor(() =>
      expect(screen.queryByText('session a1')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('session b1')).toBeInTheDocument();
    expect(getProjectTrigger()).toHaveTextContent('1 proyecto');
  });
});

describe('SessionListPage — intersección sin resultados (FR-011, SC-005)', () => {
  /** Sesión fuera de cualquier rango acotado: solo visible con "todo". */
  const oldSession = (): SessionInfo =>
    session('a1', PROJ_A, Date.now() - 10 * DAY_MS);

  const emptyIntersectionUrl = (): string =>
    urlWith({
      [FILTER_PARAM_KEYS.projects]: PROJ_A,
      [FILTER_PARAM_KEYS.range]: '1h',
    });

  it('shows the filter empty state with a clear action, never "Sin sesiones"', async () => {
    mockProjects(PROJ_A);
    mockSessions({ [PROJ_A]: [oldSession()] });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [emptyIntersectionUrl()],
    });

    expect(
      await screen.findByText('No se encontraron coincidencias'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sin sesiones')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpiar filtros' }),
    ).toBeInTheDocument();
  });

  it('restores the full list when the clear action is used (FR-012)', async () => {
    const user = userEvent.setup();
    mockProjects(PROJ_A);
    mockSessions({ [PROJ_A]: [oldSession()] });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [emptyIntersectionUrl()],
    });

    await user.click(
      await screen.findByRole('button', { name: 'Limpiar filtros' }),
    );

    await waitFor(() =>
      expect(screen.getByText('session a1')).toBeInTheDocument(),
    );
    expect(
      screen.queryByText('No se encontraron coincidencias'),
    ).not.toBeInTheDocument();
  });
});

describe('SessionListPage — filtro temporal cableado (FR-006..FR-009, T020)', () => {
  it('mounts the time control reflecting the range from the URL', async () => {
    mockProjects(PROJ_A);
    mockSessions({ [PROJ_A]: [session('a1', PROJ_A)] });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [urlWith({ [FILTER_PARAM_KEYS.range]: '24h' })],
    });

    await screen.findByText('session a1');
    expect(
      screen.getByRole('combobox', { name: 'Filtrar por recencia' }),
    ).toHaveTextContent('Últimas 24 horas');
  });
});

describe('SessionListPage — recomposición en vivo (FR-022, SC-007, T020)', () => {
  /** Instante congelado: la ventana rodante avanza con temporizadores falsos. */
  const FROZEN = new Date('2026-06-01T12:00:00.000Z').getTime();
  const HOUR_MS = 3_600_000;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FROZEN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops a session that crosses the 1h boundary as the live clock advances', async () => {
    mockProjects(PROJ_A);
    mockSessions({
      [PROJ_A]: [
        session('fresh', PROJ_A, FROZEN - 1_000),
        session('expiring', PROJ_A, FROZEN - HOUR_MS + 5_000),
      ],
    });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [urlWith({ [FILTER_PARAM_KEYS.range]: '1h' })],
    });

    // Al montar, ambas sesiones caen dentro de la última hora.
    expect(await screen.findByText('session expiring')).toBeInTheDocument();
    expect(screen.getByText('session fresh')).toBeInTheDocument();

    // El reloj en vivo cruza el límite: la sesión de borde desaparece sin recargar.
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.queryByText('session expiring')).not.toBeInTheDocument();
    expect(screen.getByText('session fresh')).toBeInTheDocument();
  });
});

describe('SessionListPage — restauración desde la URL (FR-013, FR-014, SC-003, T026)', () => {
  it('restores the project selection from the URL and narrows the list', async () => {
    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [session('a1', PROJ_A)],
      [PROJ_B]: [session('b1', PROJ_B)],
    });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [urlWith({ [FILTER_PARAM_KEYS.projects]: PROJ_B })],
    });

    // Al abrir una URL con filtros, se restauran y aplican (FR-014): sin clics,
    // la vista queda acotada al proyecto del enlace (SC-003, "compartir").
    expect(await screen.findByText('session b1')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('session a1')).not.toBeInTheDocument(),
    );
    expect(getProjectTrigger()).toHaveTextContent('1 proyecto');
  });

  it('restores a multi-project selection from the URL (FR-002, FR-014)', async () => {
    mockProjects(PROJ_A, PROJ_B, PROJ_C);
    mockSessions({
      [PROJ_A]: [session('a1', PROJ_A)],
      [PROJ_B]: [session('b1', PROJ_B)],
      [PROJ_C]: [session('c1', PROJ_C)],
    });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [
        urlWith({ [FILTER_PARAM_KEYS.projects]: `${PROJ_A},${PROJ_B}` }),
      ],
    });

    expect(await screen.findByText('session a1')).toBeInTheDocument();
    expect(screen.getByText('session b1')).toBeInTheDocument();
    expect(screen.queryByText('session c1')).not.toBeInTheDocument();
    expect(getProjectTrigger()).toHaveTextContent('2 proyectos');
  });

  it('restores project and range together, applying their intersection (FR-010, FR-014)', async () => {
    const now = Date.now();
    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [
        session('a-recent', PROJ_A, now - 1_000),
        session('a-old', PROJ_A, now - 10 * DAY_MS),
      ],
      [PROJ_B]: [session('b-recent', PROJ_B, now - 1_000)],
    });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [
        urlWith({
          [FILTER_PARAM_KEYS.projects]: PROJ_A,
          [FILTER_PARAM_KEYS.range]: '24h',
        }),
      ],
    });

    // Recargar la URL reproduce la misma selección (US3 esc. 2) y ambos filtros
    // se combinan por intersección (FR-010): solo la sesión reciente de alpha.
    expect(await screen.findByText('session a-recent')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Filtrar por recencia' }),
    ).toHaveTextContent('Últimas 24 horas');
    expect(screen.queryByText('session a-old')).not.toBeInTheDocument();
    expect(screen.queryByText('session b-recent')).not.toBeInTheDocument();
    expect(getProjectTrigger()).toHaveTextContent('1 proyecto');
  });
});

describe('SessionListPage — degradación de la URL (FR-015, SC-003, T026)', () => {
  it('ignores a project that no longer exists without error (FR-015)', async () => {
    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [session('a1', PROJ_A)],
      [PROJ_B]: [session('b1', PROJ_B)],
    });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [urlWith({ [FILTER_PARAM_KEYS.projects]: '/repo/ghost' })],
    });

    // El proyecto desconocido se ignora: se muestran todos, sin error visible ni
    // estado vacío (edge case "Dirección con un proyecto inexistente").
    expect(await screen.findByText('session a1')).toBeInTheDocument();
    expect(screen.getByText('session b1')).toBeInTheDocument();
    expect(getBar()).toBeVisible();
    expect(
      screen.queryByText('No se encontraron coincidencias'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Sin sesiones')).not.toBeInTheDocument();
    // Al quedar la intersección vacía se comporta como "todos": sin filtro activo,
    // no se ofrece la acción de limpiar.
    expect(
      screen.queryByRole('button', { name: 'Limpiar filtros de la barra' }),
    ).not.toBeInTheDocument();
  });

  it('falls back to "Todo" for an unknown range without emptying the list (FR-015)', async () => {
    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [session('a1', PROJ_A)],
      [PROJ_B]: [session('b1', PROJ_B)],
    });

    renderWithProviders(<SessionListPage />, {
      initialEntries: [urlWith({ [FILTER_PARAM_KEYS.range]: 'banana' })],
    });

    // Un rango desconocido cae al valor por defecto "Todo", sin lista vacía ni
    // error (edge case "Dirección con un rango inválido o desconocido").
    expect(await screen.findByText('session a1')).toBeInTheDocument();
    expect(screen.getByText('session b1')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Filtrar por recencia' }),
    ).toHaveTextContent('Todo');
    expect(
      screen.queryByText('No se encontraron coincidencias'),
    ).not.toBeInTheDocument();
  });
});

/**
 * Harness de rutas para el ida-y-vuelta (T033).
 *
 * La ruta real de detalle (`GRAPH_VIEW_ROUTE = '/sessions/:id'`) monta
 * `WorkspacePage`, que arrastra Graph/Inspector/History; para aislar la
 * persistencia de filtros del **listado** basta un doble de la vista de detalle
 * que ofrezca volver por el historial (`navigate(-1)`), que es como el usuario
 * regresa al listado en la app. `LocationProbe` expone la dirección activa: es
 * la evidencia de que la URL sigue siendo la única fuente de estado (R1).
 */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
};

const DetailStub = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      Volver al listado
    </button>
  );
};

const renderRoundTrip = (initialEntries: string[]) =>
  renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/sessions" element={<SessionListPage />} />
        <Route path="/sessions/:id" element={<DetailStub />} />
      </Routes>
    </>,
    { initialEntries },
  );

describe('SessionListPage — ida y vuelta al detalle (FR-026, SC-003, T033)', () => {
  it('keeps the filters applied after opening a session and coming back', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const filteredUrl = urlWith({
      [FILTER_PARAM_KEYS.projects]: PROJ_A,
      [FILTER_PARAM_KEYS.range]: '24h',
    });

    mockProjects(PROJ_A, PROJ_B);
    mockSessions({
      [PROJ_A]: [session('a-recent', PROJ_A, now - 1_000)],
      [PROJ_B]: [session('b-recent', PROJ_B, now - 1_000)],
    });

    renderRoundTrip([filteredUrl]);

    // Punto de partida: la URL con filtros acota la vista al proyecto alpha.
    const card = await screen.findByRole('button', {
      name: /session a-recent/,
    });
    expect(screen.queryByText('session b-recent')).not.toBeInTheDocument();
    expect(getProjectTrigger()).toHaveTextContent('1 proyecto');

    // Abrir la sesión: el listado se desmonta y se entra al detalle.
    await user.click(card);
    await screen.findByRole('button', { name: 'Volver al listado' });
    expect(getBar()).not.toBeInTheDocument();

    // Volver al listado (historial): la dirección conserva los filtros y se
    // reaplican sin ningún paso manual (FR-026, SC-003).
    await user.click(screen.getByRole('button', { name: 'Volver al listado' }));

    expect(await screen.findByTestId('session-filter-bar')).toBeVisible();
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      new URLSearchParams({
        [FILTER_PARAM_KEYS.projects]: PROJ_A,
        [FILTER_PARAM_KEYS.range]: '24h',
      }).toString(),
    );
    expect(getProjectTrigger()).toHaveTextContent('1 proyecto');
    expect(
      screen.getByRole('combobox', { name: 'Filtrar por recencia' }),
    ).toHaveTextContent('Últimas 24 horas');
    expect(screen.getByText('session a-recent')).toBeInTheDocument();
    expect(screen.queryByText('session b-recent')).not.toBeInTheDocument();
  });
});
