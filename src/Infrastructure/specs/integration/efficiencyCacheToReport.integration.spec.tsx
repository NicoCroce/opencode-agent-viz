/**
 * U37 (T037) — E2E de la frontera U1↔U2: **motor §2/§3 + data-model §3/§5.4**.
 *
 * Monta el `EfficiencyOverlay` real (Radix Dialog) con la caché sembrada por el
 * arnés en `sessions.messages(root)`: el hook `useSessionEfficiency` es un
 * observador de caché (`skipToken`), así que el informe del motor llega al DOM
 * sin una sola petición de red. Un `setQueryData` posterior sobre la misma clave
 * re-analiza y sustituye el informe visible.
 *
 * Casos negativos: una raíz **sin** caché con `rootReady: true` es `no_data` y
 * pinta “Sin mensajes” (nunca turnos inventados); un `graphError` sin informe
 * previo deja el `EmptyScreenError` y jamás se confunde con el vacío.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionMessageAssistant, SessionMessageIdle } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { EfficiencyOverlay } from '@app/Infrastructure/Components/EfficiencyOverlay';
import type {
  TEfficiencyReport,
  TEfficiencySessionMeta,
} from '@app/Domains/Efficiency/Efficiency.entity';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import { BAND_LABEL } from '@app/Domains/Efficiency/lib/labels';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  INTEGRATION_SESSION_ID,
  createIntegrationQueryClient,
  seedMessages,
} from './harness';

const ROOT = INTEGRATION_SESSION_ID;
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const TOOLS_PER_TURN = 3;

/** Pedidos distintos (≥6 tokens) para no disparar INP-1 por similitud. */
const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
  'Documenta los totales del informe y contrasta la cabecera de la sesión',
];

const SESSIONS: Record<string, TEfficiencySessionMeta> = {
  [ROOT]: { status: 'idle' },
};

interface TTurnOptions {
  /** Todas las herramientas del turno terminan en error (RES-1). */
  failedTools?: boolean;
  outcome?: SessionMessageIdle['outcome'];
}

/** Turno cerrado de una sola respuesta assistant; el último puede fallar. */
const turnMessages = (
  index: number,
  prompt: string,
  { failedTools = false, outcome = 'succeeded' }: TTurnOptions = {},
): TSessionMessage[] => {
  const start = BASE + (index - 1) * TURN_MS;
  const content: SessionMessageAssistant['content'] = Array.from(
    { length: TOOLS_PER_TURN },
    (_, position) =>
      buildToolPart({
        id: `tool-${index}-${position}`,
        name: 'read',
        status: failedTools ? 'error' : 'completed',
        input: { filePath: `/repo/src/turno-${index}-${position}.ts` },
        created: start + 200 + position * 10,
        ran: start + 200 + position * 10,
        completed: start + 300 + position * 10,
      }),
  );

  return [
    buildUser({ id: `user-${index}`, text: prompt, time: { created: start } }),
    buildAssistant({
      id: `assistant-${index}`,
      time: { created: start + 100, completed: start + 2_000 },
      content,
    }),
    buildIdle(outcome, {
      id: `idle-${index}`,
      time: { created: start + 5_000 },
    }),
  ];
};

/** Cuatro turnos cerrados y limpios: informe `ok`. */
const cleanMessages = (): TSessionMessage[] =>
  [1, 2, 3, 4].flatMap((index) =>
    turnMessages(index, PROMPTS[index - 1]),
  );

/** Quinto turno con errores de herramienta: fuerza un informe nuevo. */
const extendedMessages = (): TSessionMessage[] => [
  ...cleanMessages(),
  ...turnMessages(5, PROMPTS[4], {
    failedTools: true,
    outcome: 'failed',
  }),
];

const analyze = (messages: TSessionMessage[]): TEfficiencyReport =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession: { [ROOT]: messages },
    sessions: SESSIONS,
  });

const scoreName = (report: TEfficiencyReport): string => {
  if (report.score === null || report.band === null) {
    throw new Error(`El fixture debe puntuar; recibido ${report.status}`);
  }
  return `${report.score} de 100, ${BAND_LABEL[report.band]}`;
};

interface TOverlayOverrides {
  rootReady?: boolean;
  graphError?: boolean;
}

const renderOverlay = (
  client: QueryClient,
  { rootReady = true, graphError = false }: TOverlayOverrides = {},
) =>
  renderWithProviders(
    <EfficiencyOverlay
      isOpen
      rootSessionId={ROOT}
      rootTitle="Sesión raíz"
      sessions={SESSIONS}
      rootReady={rootReady}
      truncated={false}
      graphError={graphError}
      now={BASE + 200_000}
      reference={null}
      onClose={() => undefined}
      onRestoreFocus={() => undefined}
    />,
    { queryClient: client },
  );

const openDialog = (): Promise<HTMLElement> =>
  screen.findByRole('dialog', { name: 'Eficiencia de la sesión' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EfficiencyOverlay · de la caché al informe (T037, U1↔U2)', () => {
  it('observa la caché sin fetch, pinta el informe y lo re-analiza al cambiar los datos', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const client = createIntegrationQueryClient();
    seedMessages(client, { [ROOT]: cleanMessages() });
    const before = analyze(cleanMessages());
    expect(before.status).toBe('ok');

    renderOverlay(client);
    await openDialog();

    const verdict = screen.getByRole('img', { name: scoreName(before) });
    expect(verdict).toHaveTextContent(String(before.score));
    expect(screen.getByText(PROMPTS[0])).toBeInTheDocument();

    // El hook se suscribe a la clave existente y no dispara ninguna petición.
    const query = client
      .getQueryCache()
      .find({ queryKey: queryKeys.sessions.messages(ROOT) });
    expect(query?.getObserversCount()).toBeGreaterThan(0);
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((candidate) => candidate.state.fetchStatus === 'idle'),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    const after = analyze(extendedMessages());
    expect(after.status).toBe('ok');
    expect(after.score).not.toBe(before.score);

    act(() => {
      client.setQueryData(
        queryKeys.sessions.messages(ROOT),
        extendedMessages(),
      );
    });

    expect(
      await screen.findByText(PROMPTS[4]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: scoreName(after) }),
    ).toHaveTextContent(String(after.score));
    expect(
      screen.queryByRole('img', { name: scoreName(before) }),
    ).not.toBeInTheDocument();

    // La actualización tampoco abre red ni refetch.
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((candidate) => candidate.state.fetchStatus === 'idle'),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con la raíz sin caché y rootReady:true pinta “Sin mensajes” sin inventar turnos', async () => {
    const client = createIntegrationQueryClient();

    renderOverlay(client, { rootReady: true });
    const dialog = await openDialog();

    expect(await screen.findByText('Sin mensajes')).toBeInTheDocument();
    expect(
      screen.getByText('Esta sesión todavía no reportó mensajes.'),
    ).toBeInTheDocument();
    expect(analyze([]).status).toBe('no_data');

    // Ni veredicto ni tabla de turnos: no se sustituye la ausencia por ceros.
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Turnos de la sesión' }),
    ).not.toBeInTheDocument();
    expect(dialog.textContent).not.toContain('Sin turnos');
    expect(dialog.textContent).not.toContain('Turno');
  });

  it('con graphError sin informe previo muestra el error y nunca el vacío', async () => {
    const client = createIntegrationQueryClient();

    renderOverlay(client, { rootReady: false, graphError: true });
    await openDialog();

    expect(
      await screen.findByText('No se pudo cargar la sesión.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Esta sesión todavía no reportó mensajes.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar análisis de eficiencia' }),
    ).toBeVisible();
  });
});
