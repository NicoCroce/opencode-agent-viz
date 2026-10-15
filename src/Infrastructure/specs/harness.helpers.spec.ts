// @vitest-environment jsdom
/**
 * Reglas de los helpers nuevos del arnés de integración
 * (`src/Infrastructure/specs/integration/harness.tsx`, U02 del chore de
 * tooling): `buildGraphNode` (+`TBuildGraphNodeOverrides`),
 * `renderInspectorPanel` (+`TRenderInspectorPanelOptions`), `getInspectorPanelRoot`,
 * `INSPECTOR_PANEL_COLUMN_TEST_ID`, `TRUNCATION_UTILITIES` /
 * `TRUNCATION_UTILITIES_PATTERN`, `expectNoTruncation` y la regresión de
 * `resetServiceMock` (`getSessionDiff` deja de quedarse sin valor).
 *
 * El SDK se mockea en su frontera (`@app/Infrastructure/Services/opencodeClient`)
 * con el `serviceMock` del propio arnés, igual que los specs de `integration/`:
 * `renderInspectorPanel` monta el `InspectorPanel` **real**, así que sus hooks
 * tienen que resolver contra el doble y no contra la red.
 *
 * Lo que estos casos garantizan es la **regla del helper**, no una medición de
 * layout: jsdom no implementa cajas (`getBoundingClientRect` devuelve ceros), de
 * modo que "la etiqueta no se recorta" se asegura por clases
 * (`expectNoTruncation`) y el ancho del panel se simula con la columna que monta
 * `renderInspectorPanel`.
 */
import { createElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INSPECTOR_MIN_WIDTH } from '@app/Application/Helpers/panelWidth';
import { INSPECTOR_SECTION_TAB_ITEMS } from '@app/Domains/Inspector/Hooks/useInspectorSectionTabs';
import { queryKeys } from '@app/Domains/queryKeys';
import { setupRadixUser } from '@app/test/radix';
import {
  buildGraphNode,
  createIntegrationQueryClient,
  expectNoTruncation,
  getInspectorPanelRoot,
  INSPECTOR_PANEL_COLUMN_TEST_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  renderInspectorPanel,
  resetServiceMock,
  seedMessages,
  serviceMock,
  TRUNCATION_UTILITIES,
  TRUNCATION_UTILITIES_PATTERN,
} from './integration/harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./integration/harness');
  return { opencodeService: mock };
});

/** Claves exactas de `TGraphNodeData`: el helper no inventa señales opcionales. */
const GRAPH_NODE_DATA_KEYS = [
  'agentName',
  'createdAt',
  'currentTool',
  'directory',
  'interruptReason',
  'isRoot',
  'metrics',
  'model',
  'parallel',
  'retry',
  'sessionId',
  'status',
  'title',
  'updatedAt',
];

const filesTab = INSPECTOR_SECTION_TAB_ITEMS.find((item) => item.id === 'files');

/**
 * Abre la pestaña Archivos del panel ya montado (Radix necesita el `user` con
 * los polyfills de `src/test/radix.ts`) y espera a que quede activa.
 */
const openFilesTab = async (): Promise<void> => {
  expect(filesTab).toBeDefined();
  const user = setupRadixUser();
  await user.click(screen.getByRole('tab', { name: filesTab?.label }));
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: filesTab?.label })).toHaveAttribute(
      'aria-selected',
      'true',
    ),
  );
};

beforeEach(() => {
  resetServiceMock(serviceMock);
});

describe('buildGraphNode — nodo determinista y overrides', () => {
  it('construye la identidad por defecto con valores propios de cada llamada', () => {
    const node = buildGraphNode();
    const other = buildGraphNode();

    // Determinista: mismo contenido…
    expect(node).toEqual(other);
    // …y sin estado compartido entre llamadas.
    expect(node).not.toBe(other);
    expect(node.data.metrics).not.toBe(other.data.metrics);
    expect(node.data.metrics.loopEvidence).not.toBe(
      other.data.metrics.loopEvidence,
    );

    expect(node.id).toBe(INTEGRATION_SESSION_ID);
    expect(node.type).toBe('agent');
    expect(node.position).toEqual({ x: 0, y: 0 });
    expect(node.data.sessionId).toBe(INTEGRATION_SESSION_ID);
    expect(node.data.directory).toBe(INTEGRATION_DIRECTORY);
    expect(node.data.status).toBe('succeeded');
    expect(node.data.isRoot).toBe(true);
    expect(node.data.retry).toBeNull();
    expect(node.data.interruptReason).toBeNull();
    expect(node.data.currentTool).toBeNull();
    expect(node.data.parallel).toBeNull();
    expect(node.data.metrics).toEqual({
      durationMs: 0,
      startedAt: 0,
      endedAt: 0,
      cost: 0,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    });

    // No se añaden `enrichment`/`context`/`effort`/`speedup` inventados.
    expect(Object.keys(node.data).sort()).toEqual(GRAPH_NODE_DATA_KEYS);
    expect(node.data.enrichment).toBeUndefined();
  });

  it('parchea data, id y position sin tocar el resto de los valores por defecto', () => {
    const node = buildGraphNode({
      id: 'nodo-hijo',
      sessionId: 'ses_hija',
      title: 'Subagente',
      status: 'running',
      position: { x: 120, y: -8 },
      metrics: {
        ...buildGraphNode().data.metrics,
        durationMs: 4200,
        invocations: 3,
        hasLoop: true,
      },
    });

    expect(node.id).toBe('nodo-hijo');
    expect(node.position).toEqual({ x: 120, y: -8 });
    expect(node.data.sessionId).toBe('ses_hija');
    expect(node.data.title).toBe('Subagente');
    expect(node.data.status).toBe('running');
    expect(node.data.metrics.durationMs).toBe(4200);
    expect(node.data.metrics.invocations).toBe(3);
    expect(node.data.metrics.hasLoop).toBe(true);

    // Lo no parcheado sigue en el valor por defecto.
    expect(node.data.agentName).toBe('develop');
    expect(node.data.directory).toBe(INTEGRATION_DIRECTORY);
    expect(node.data.metrics.cost).toBe(0);
  });

  it('sin id explícito, el id sigue al sessionId del override', () => {
    expect(buildGraphNode({ sessionId: 'ses_otra' }).id).toBe('ses_otra');
    expect(buildGraphNode({ sessionId: 'ses_otra' }).data.sessionId).toBe(
      'ses_otra',
    );
  });
});

describe('expectNoTruncation — garantía por clases', () => {
  it('pasa con un className que no recorta la etiqueta', () => {
    expect(() =>
      expectNoTruncation('whitespace-nowrap text-sm font-medium'),
    ).not.toThrow();
    expect(
      TRUNCATION_UTILITIES_PATTERN.test('whitespace-nowrap text-sm'),
    ).toBe(false);
  });

  it('falla con cada utilidad de recorte de TRUNCATION_UTILITIES', () => {
    for (const utility of TRUNCATION_UTILITIES) {
      // `line-clamp-N` es el marcador de cualquier `line-clamp-\d`.
      const className = utility === 'line-clamp-N' ? 'line-clamp-2' : utility;

      expect(
        TRUNCATION_UTILITIES_PATTERN.test(className),
        `${className} debe estar reconocida por TRUNCATION_UTILITIES_PATTERN`,
      ).toBe(true);
      expect(
        () => expectNoTruncation(`text-sm ${className}`),
        `${className} debe hacer fallar expectNoTruncation`,
      ).toThrow(/no debe usar utilidades de recorte/);
    }
  });

  it('nombra la etiqueta en el mensaje de fallo', () => {
    expect(() => expectNoTruncation('truncate', 'la etiqueta del caso')).toThrow(
      'la etiqueta del caso',
    );
  });
});

describe('getInspectorPanelRoot — raíz del panel', () => {
  it('devuelve el primer hijo HTMLElement de la columna', async () => {
    await renderInspectorPanel(buildGraphNode());

    const column = screen.getByTestId(INSPECTOR_PANEL_COLUMN_TEST_ID);
    const root = getInspectorPanelRoot();

    expect(root).toBe(column.firstElementChild);
    expect(column).toContainElement(root);
    expect(root.childElementCount).toBeGreaterThan(0);
  });

  it('falla con un mensaje propio si la columna no tiene hijo HTMLElement', () => {
    render(
      createElement(
        'div',
        { 'data-testid': INSPECTOR_PANEL_COLUMN_TEST_ID },
        'solo texto',
      ),
    );

    expect(() => getInspectorPanelRoot()).toThrow(
      /no tiene un hijo HTMLElement/,
    );
  });
});

describe('renderInspectorPanel — panel real en una columna de ancho simulado', () => {
  it('monta el panel real con el ancho pedido, siembra antes de renderizar y devuelve el queryClient', async () => {
    const sessionId = 'ses_panel';
    const node = buildGraphNode({
      id: sessionId,
      sessionId,
      title: 'Panel real',
    });
    const client = createIntegrationQueryClient();

    const result = await renderInspectorPanel(node, {
      width: 480,
      queryClient: client,
      seed: (seeded) => seedMessages(seeded, { [sessionId]: [] }),
    });

    // Devuelve el cliente con el que montó (contrato del helper).
    expect(result.queryClient).toBe(client);
    // El seed se aplicó ANTES del render.
    expect(client.getQueryData(queryKeys.sessions.messages(sessionId))).toEqual(
      [],
    );

    // La columna simula el ancho de producción y es el ancla del helper.
    const column = screen.getByTestId(INSPECTOR_PANEL_COLUMN_TEST_ID);
    expect(column.style.width).toBe('480px');
    expect(getInspectorPanelRoot()).toBe(column.firstElementChild);

    // Es el panel real (no el marcador del arnés): su tablist de secciones.
    expect(
      screen.getByRole('tablist', { name: 'Secciones técnicas del nodo' }),
    ).toBeInTheDocument();
  });

  it('usa el ancho mínimo del panel y un queryClient propio por defecto', async () => {
    const pending = renderInspectorPanel(buildGraphNode());
    // El helper es asíncrono a propósito (import diferido del panel).
    expect(pending).toBeInstanceOf(Promise);

    const { queryClient } = await pending;

    expect(
      screen.getByTestId(INSPECTOR_PANEL_COLUMN_TEST_ID).style.width,
    ).toBe(`${INSPECTOR_MIN_WIDTH}px`);

    // El cliente devuelto es el que usó el panel: su consulta de mensajes
    // acaba cacheada en él.
    await waitFor(() =>
      expect(
        queryClient.getQueryData(
          queryKeys.sessions.messages(INTEGRATION_SESSION_ID),
        ),
      ).toEqual([]),
    );
  });

  it('con el diff vacío por defecto (resetServiceMock) el panel no cae en error', async () => {
    await renderInspectorPanel(buildGraphNode());
    await openFilesTab();

    expect(
      within(screen.getByRole('tabpanel')).getByText('Sin cambios de archivos'),
    ).toBeInTheDocument();
    expect(serviceMock.getSessionDiff).toHaveBeenCalledWith(
      INTEGRATION_SESSION_ID,
    );
  });

  it('con el diff en 404 el panel cae en error, nunca en vacío', async () => {
    // Caso negativo de la misma cadena: si la fuente falla, el estado vacío
    // legítimo («Sin cambios de archivos») no puede aparecer.
    serviceMock.getSessionDiff.mockRejectedValue(new Error('404 not found'));

    await renderInspectorPanel(buildGraphNode());
    await openFilesTab();

    await waitFor(() =>
      expect(
        within(screen.getByRole('tabpanel')).getByText(
          'Ocurrió un error al cargar los datos',
        ),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('tabpanel')).queryByText(
        'Sin cambios de archivos',
      ),
    ).toBeNull();
  });
});

describe('resetServiceMock — regresión de getSessionDiff', () => {
  it('deja getSessionDiff resolviendo [] y no sin valor', async () => {
    // Un caso anterior pudo dejar el doble con datos: el reset los limpia…
    serviceMock.getSessionDiff.mockResolvedValue([
      {
        file: 'src/Alpha.tsx',
        status: 'modified',
        additions: 2,
        deletions: 1,
        patch: '@@ -1 +1 @@\n-vieja\n+nueva\n',
      },
    ]);

    resetServiceMock(serviceMock);

    // …y vuelve a un valor por defecto **definido** (antes quedaba sin valor y
    // React Query avisaba «Query data cannot be undefined»).
    await expect(serviceMock.getSessionDiff('ses_root')).resolves.toEqual([]);
    expect(serviceMock.getSessionDiff).toHaveBeenCalledTimes(1);
  });
});
