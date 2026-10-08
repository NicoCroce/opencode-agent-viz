import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useEffect } from 'react';
import { renderWithProviders } from '@app/test/renderWithProviders';
import type { TGraphModel } from '../../Graph.entity';
import { buildGraph } from '../../lib/buildGraph';
import { LOAD_CHUNK_SIZE } from '../../lib/loadPriority';
import { session } from '../../lib/specs/fixtures';
import { useGraphEnrichment } from '../useGraphEnrichment';

/**
 * Spec de contrato del enriquecimiento progresivo (criterios L5..L6 del
 * `contracts/graph-loading-contract.md`, §2-§3):
 *
 * - L5: `useGraphEnrichment(ids, structure)` procesa el subárbol **por lotes**
 *   (un lote por turno de idle) y transiciona cada nodo `pending → ready` al
 *   completar su lote.
 * - L6: al cambiar de sesión (cambian `ids`/`structure`) el plan en vuelo se
 *   reinicia y el nuevo subárbol se completa sin quedar bloqueado por el trabajo
 *   abandonado.
 *
 * Se usan temporizadores falsos con un shim de `requestIdleCallback` apoyado en
 * `setTimeout` (jsdom no lo implementa), de modo que avanzar los timers controla
 * los turnos de idle de forma determinista (contrato de carga §3). El observable
 * es el `TGraphModel` que devuelve el hook: la estructura se pinta primero con
 * `enrichment: 'pending'` y se completa por lotes.
 *
 * Escrito contra el contrato congelado: es la red de seguridad de
 * `useGraphEnrichment` (T018) y se espera **en rojo** hasta que exista el hook.
 */

const service = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listAgents: vi.fn(),
  getSessionMessages: vi.fn(),
  getSessionPermissions: vi.fn(),
  getSessionLog: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  listSessionInbox: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: service,
}));

/** Última salida del hook bajo prueba (mismo patrón que `useGraphStructure.spec.tsx`). */
let latest: TGraphModel | null = null;

const EnrichmentProbe = ({
  ids,
  structure,
}: {
  ids: string[];
  structure: TGraphModel;
}) => {
  const model = useGraphEnrichment(ids, structure);
  // Captura el modelo tras cada render (los efectos son el lugar canónico para
  // las mutaciones externas; evita reasignar en fase de render).
  useEffect(() => {
    latest = model;
  });
  return null;
};

/**
 * `TGraphModel` estructural (todos `pending`, sin métricas) de un subárbol:
 * una raíz (`prefix-0`) con `count - 1` hijos directos.
 */
const makeStructure = (prefix: string, count: number): TGraphModel =>
  buildGraph({
    sessions: Array.from({ length: count }, (_, index) =>
      session(`${prefix}-${index}`, {
        parentID: index === 0 ? undefined : `${prefix}-0`,
        time: { created: index + 1, updated: index + 2 },
      }),
    ),
    statuses: {},
    agents: [],
    messages: {},
    permissions: [],
    signals: {},
    forms: [],
    inbox: [],
    enrichment: 'pending',
    now: 0,
  });

const readyCount = (): number =>
  latest?.nodes.filter((node) => node.data.enrichment === 'ready').length ?? 0;

const pendingCount = (): number =>
  latest?.nodes.filter((node) => node.data.enrichment === 'pending').length ?? 0;

/** Ejecuta un turno de idle (un lote) y deja asentar los efectos de React. */
const runIdleTurn = async (): Promise<void> => {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
};

/**
 * Avanza turnos de idle hasta completar el subárbol y devuelve la cuenta de
 * nodos `ready` tras cada turno (incluido el estado inicial).
 */
const drain = async (maxTurns = 12): Promise<number[]> => {
  const counts = [readyCount()];
  for (let turn = 0; turn < maxTurns && pendingCount() > 0; turn += 1) {
    await runIdleTurn();
    counts.push(readyCount());
  }
  return counts;
};

describe('useGraphEnrichment — carga progresiva (L5..L6)', () => {
  beforeEach(() => {
    latest = null;
    vi.useFakeTimers();
    // jsdom no implementa `requestIdleCallback`: se provee un shim que agenda el
    // callback en el `setTimeout` falso, de modo que `runOnlyPendingTimersAsync`
    // ejecute exactamente un lote por turno (contrato de carga §3).
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) =>
      setTimeout(
        () =>
          callback({
            didTimeout: false,
            timeRemaining: () => 50,
          }),
        0,
      ),
    );
    vi.stubGlobal('cancelIdleCallback', (handle: number) =>
      clearTimeout(handle),
    );

    service.listSessions.mockReset().mockResolvedValue([]);
    service.listAgents.mockReset().mockResolvedValue([]);
    service.getSessionMessages.mockReset().mockResolvedValue([]);
    service.getSessionPermissions.mockReset().mockResolvedValue([]);
    service.getSessionLog.mockReset().mockResolvedValue([]);
    service.listSessionForms.mockReset().mockResolvedValue([]);
    service.getSessionForm.mockReset().mockResolvedValue(undefined);
    service.listSessionInbox.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('procesa el subárbol por lotes y transiciona pending → ready (L5)', async () => {
    const structure = makeStructure('a', 20);
    const ids = structure.nodes.map((node) => node.id);

    renderWithProviders(<EnrichmentProbe ids={ids} structure={structure} />);

    // La estructura ya está pintada con el detalle pendiente: el enriquecimiento
    // no bloquea el primer render (SC-007).
    expect(latest?.nodes).toHaveLength(20);
    expect(pendingCount()).toBeGreaterThan(0);

    const counts = await drain();

    // Un estado intermedio (0 < ready < total) demuestra que no se cargó todo de
    // golpe; cada turno avanza como mucho un lote (contrato de carga §3).
    expect(counts.some((count) => count > 0 && count < 20)).toBe(true);
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index] - counts[index - 1]).toBeLessThanOrEqual(
        LOAD_CHUNK_SIZE,
      );
    }

    // Transición completa pending → ready.
    expect(readyCount()).toBe(20);
    expect(pendingCount()).toBe(0);
  });

  it('reinicia el plan al cambiar de sesión sin bloquear la nueva (L6)', async () => {
    const structureA = makeStructure('a', 20);
    const idsA = structureA.nodes.map((node) => node.id);
    const { rerender } = renderWithProviders(
      <EnrichmentProbe ids={idsA} structure={structureA} />,
    );

    // La sesión A empieza a cargar y se abandona a mitad del plan.
    await runIdleTurn();
    expect(service.getSessionMessages).toHaveBeenCalledWith('a-0');

    const structureB = makeStructure('b', 20);
    const idsB = structureB.nodes.map((node) => node.id);
    rerender(<EnrichmentProbe ids={idsB} structure={structureB} />);

    // El modelo pasa a describir B y su plan arranca de cero (pending): no
    // hereda el progreso de A.
    expect(latest?.nodes.map((node) => node.id).sort()).toEqual(
      [...idsB].sort(),
    );
    expect(pendingCount()).toBeGreaterThan(0);

    // La nueva sesión se completa sin quedar bloqueada por el trabajo abandonado.
    const counts = await drain();
    expect(counts[counts.length - 1]).toBe(20);
    expect(pendingCount()).toBe(0);
    expect(service.getSessionMessages).toHaveBeenCalledWith('b-0');
  });
});
