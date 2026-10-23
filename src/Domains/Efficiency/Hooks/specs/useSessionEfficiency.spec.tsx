import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { act, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@app/Domains/queryKeys';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@app/test/renderWithProviders';
import type {
  TSessionEfficiencyResult,
  TUseSessionEfficiencyParams,
} from '../../Efficiency.entity';
import { useSessionEfficiency } from '../useSessionEfficiency';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '../../lib/specs/fixtures';

/**
 * `useSessionEfficiency` es un **observador de caché** (research R2/R9): se
 * suscribe a `sessions.messages(id)` de la raíz y su subárbol sin fetch propio.
 * El spec fija los estados de pantalla del overlay (overlay §4), la distinción
 * entre raíz ausente y raíz vacía, la parcialidad por hijos sin datos, la
 * estabilidad de referencias y que abrir el panel no dispara red.
 */

const ROOT = 'root';
const CHILD = 'child';

/** Resultado del hook capturado por la sonda de render. */
let latest: TSessionEfficiencyResult | null = null;

/** Sonda mínima: el hook se consume como en `WorkspacePage`, sin UI. */
const Probe = (params: TUseSessionEfficiencyParams) => {
  const efficiency = useSessionEfficiency(params);
  useEffect(() => {
    latest = efficiency;
  });
  return null;
};

/** Último resultado; falla claro si la sonda no llegó a renderizar. */
const current = (): TSessionEfficiencyResult => {
  if (latest === null) throw new Error('useSessionEfficiency no renderizó');
  return latest;
};

const efficiencyParams = (
  overrides: Partial<TUseSessionEfficiencyParams> = {},
): TUseSessionEfficiencyParams => ({
  rootSessionId: ROOT,
  sessions: { [ROOT]: {} },
  rootReady: true,
  enabled: true,
  ...overrides,
});

/** Un turno cerrado (user + assistant + idle) para la raíz o un hijo. */
const sessionMessages = () => [
  buildUser(),
  buildAssistant(),
  buildIdle('succeeded'),
];

const seedRoot = (queryClient: QueryClient): void => {
  queryClient.setQueryData(queryKeys.sessions.messages(ROOT), sessionMessages());
};

/** Prompts distintos: 7 turnos dan 6 pares elegibles (doble muestra de Entrada). */
const HIGH_COVERAGE_PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
  'Optimiza el renderizado de turnos largos sin cambiar la presentación',
  'Extrae la tabla de totales a un componente con valores no disponibles',
  'Valida la proyección de sesiones desde las aristas del grafo truncado',
];

/**
 * Sesión de cobertura completa: 7 turnos × 3 pasos con tool dan 21 llamadas y
 * 21 pasos, doble muestra de Entrada y Ejecución; caché reportada. Es el caso
 * que alcanza `confidence: 'alta'` si el subárbol no es parcial.
 */
const highCoverageMessages = (): TSessionMessage[] =>
  HIGH_COVERAGE_PROMPTS.flatMap((prompt, index) => {
    const start = 1_700_000_000_000 + index * 10_000;
    const assistants = [0, 1, 2].map((step) => {
      const created = start + 100 + step * 500;
      return buildAssistant({
        id: `assistant-${index}-${step}`,
        time: { created, completed: created + 200 },
        content: [
          buildToolPart({
            id: `tool-${index}-${step}`,
            input: { filePath: `/repo/src/modulo-${index}-${step}.ts` },
            created: created + 10,
            ran: created + 20,
            completed: created + 100,
          }),
        ],
      });
    });
    return [
      buildUser({
        id: `user-${index}`,
        time: { created: start },
        text: prompt,
      }),
      ...assistants,
      buildIdle('succeeded', {
        id: `idle-${index}`,
        time: { created: start + 3_000 },
      }),
    ];
  });

const seedHighCoverage = (queryClient: QueryClient): void => {
  queryClient.setQueryData(
    queryKeys.sessions.messages(ROOT),
    highCoverageMessages(),
  );
};

interface RenderOptions {
  seed?: (queryClient: QueryClient) => void;
  queryClient?: QueryClient;
}

const renderEfficiency = (
  params: TUseSessionEfficiencyParams,
  { seed, queryClient }: RenderOptions = {},
) => {
  latest = null;
  return renderWithProviders(<Probe {...params} />, {
    queryClient:
      queryClient ?? createTestQueryClient({ gcTime: Infinity }),
    seed,
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSessionEfficiency — observador de caché (FR-004/FR-037)', () => {
  it('con enabled:false no monta observadores ni pide datos', () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { queryClient: client } = renderEfficiency(
      efficiencyParams({ enabled: false }),
      { queryClient, seed: seedRoot },
    );

    expect(current().report).toBeNull();
    const cached = client
      .getQueryCache()
      .find({ queryKey: queryKeys.sessions.messages(ROOT) });
    expect(cached?.getObserversCount()).toBe(0);
  });

  it('con la raíz cacheada devuelve un informe', () => {
    renderEfficiency(efficiencyParams(), { seed: seedRoot });

    expect(current().report).not.toBeNull();
    expect(current().isLoading).toBe(false);
    expect(current().isError).toBe(false);
  });

  it('con la raíz ausente y rootReady:false está cargando', () => {
    renderEfficiency(efficiencyParams({ rootReady: false }));

    expect(current().report).toBeNull();
    expect(current().isLoading).toBe(true);
    expect(current().isError).toBe(false);
  });

  it('con la raíz ausente y rootReady:true devuelve no_data', () => {
    renderEfficiency(efficiencyParams({ rootReady: true }));

    expect(current().report?.status).toBe('no_data');
    expect(current().isLoading).toBe(false);
  });

  it('marca la parcialidad cuando falta un hijo del subárbol', () => {
    renderEfficiency(
      efficiencyParams({ sessions: { [ROOT]: {}, [CHILD]: {} } }),
      { seed: seedRoot },
    );

    expect(current().report).not.toBeNull();
    expect(current().isPartial).toBe(true);
    expect(current().missingSessionIds).toEqual([CHILD]);
  });

  it('un setQueryData del hijo produce un informe nuevo y deja de ser parcial', async () => {
    const { queryClient } = renderEfficiency(
      efficiencyParams({ sessions: { [ROOT]: {}, [CHILD]: {} } }),
      { seed: seedRoot },
    );
    const before = current().report;

    act(() => {
      queryClient.setQueryData(
        queryKeys.sessions.messages(CHILD),
        sessionMessages(),
      );
    });

    await waitFor(() => {
      expect(current().isPartial).toBe(false);
    });

    const after = current();
    expect(after.report).not.toBe(before);
    expect(after.report).not.toBeNull();
    expect(after.missingSessionIds).toEqual([]);
  });

  it('conserva la referencia del informe al re-renderizar con las mismas entradas', () => {
    const params = efficiencyParams();
    const { rerender } = renderEfficiency(params, { seed: seedRoot });
    const first = current().report;

    rerender(<Probe {...params} />);

    expect(current().report).toBe(first);
  });

  it('propaga truncated al motor: grafo truncado ⇒ confianza baja', () => {
    renderEfficiency(efficiencyParams({ truncated: true }), {
      seed: seedHighCoverage,
    });

    const result = current();
    expect(result.report?.status).toBe('ok');
    expect(result.report?.coverage).toBeGreaterThanOrEqual(85);
    expect(result.report?.confidence).toBe('baja');
    expect(result.isPartial).toBe(true);
    expect(result.missingSessionIds).toEqual([]);
  });

  it('sin truncamiento, la misma caché declara confianza alta', () => {
    renderEfficiency(efficiencyParams({ truncated: false }), {
      seed: seedHighCoverage,
    });

    const result = current();
    expect(result.report?.status).toBe('ok');
    expect(result.report?.confidence).toBe('alta');
    expect(result.isPartial).toBe(false);
  });

  it('con una sesión activa devuelve in_progress y sin nota', () => {
    renderEfficiency(
      efficiencyParams({ sessions: { [ROOT]: { status: 'active' } } }),
      { seed: seedRoot },
    );

    expect(current().report?.status).toBe('in_progress');
    expect(current().report?.score).toBeNull();
  });

  it('con graphError y sin datos devuelve error, no carga', () => {
    renderEfficiency(
      efficiencyParams({ rootReady: false, graphError: true }),
    );

    expect(current().report).toBeNull();
    expect(current().isError).toBe(true);
    expect(current().isLoading).toBe(false);
  });

  it('no hace peticiones de red: solo observa la caché existente', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { queryClient } = renderEfficiency(
      efficiencyParams({ sessions: { [ROOT]: {}, [CHILD]: {} } }),
      { seed: seedRoot },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .every((query) => query.state.fetchStatus === 'idle'),
    ).toBe(true);
  });
});
