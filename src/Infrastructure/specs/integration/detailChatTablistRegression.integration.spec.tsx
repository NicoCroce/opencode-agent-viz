import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { TGraphModel } from '@app/Domains/Graph';
import { permissionRequest } from '../../lib/specs/fixtures';
import { InspectorPane } from '../../Components/InspectorPane';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedPermissions,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * E2E frontera **U1↔U5** (T034, contract §6/§7/§8, FR-011/SC-004) — regresión
 * del tablist externo `Detalle | Chat` (unidad U1: `InspectorPane`) frente al
 * primitivo compartido (unidad U5: `ui/tabs.tsx`, T032).
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido)
 * y la caché sembrada: el tablist externo lo rinde el `InspectorPane` real (el
 * arnés solo sustituye `InspectorPanel` por un marcador), así que se puede
 * afirmar que `Detalle | Chat` conserva etiqueta, orden, `aria-label`, roving
 * tabindex y el `ChatAttentionBadge` cuando hay pendientes.
 *
 * Caso negativo (dato inexistente): sin pendientes la lista de **dos** pestañas
 * no recibe restricción de ancho y conserva el **alto de control** (jsdom no
 * mide layout, así que se guarda por clases: `min-h-control` presente y
 * `h-control`/`w-full`/`flex-col` ausentes), ninguna pestaña pierde su etiqueta
 * y —fuera del tablist— el control de pantalla completa **no** se monta cuando
 * el llamador no aporta `onToggleFullscreen` (contrato de `InspectorPane`), cosa
 * que `WorkspacePage` siempre cablea.
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock } = await import('./harness');
  return { opencodeService: serviceMock };
});

vi.mock('@app/Domains/Graph', async () => {
  const { mockGraphBarrel } = await import('./harness');
  return mockGraphBarrel();
});

vi.mock('@app/Domains/Sessions', async () => {
  const { mockSessionsBarrel } = await import('./harness');
  return mockSessionsBarrel();
});

vi.mock('@app/Domains/Chat', async () => {
  const { mockChatBarrel } = await import('./harness');
  return mockChatBarrel();
});

vi.mock('@app/Domains/Inspector', async () => {
  const { mockInspectorBarrel } = await import('./harness');
  return mockInspectorBarrel();
});

vi.mock('@app/Domains/History', async () => {
  const { mockHistoryBarrel } = await import('./harness');
  return mockHistoryBarrel();
});

const ROOT_ID = INTEGRATION_SESSION_ID;
const CHILD_ID = INTEGRATION_CHILD_SESSION_ID;

const PERMISSION_ID = 'perm_root';
const PERMISSION_ACTION = 'write';

/** `aria-label` congelado del tablist externo (contract §2/§7). */
const DETAIL_TABLIST_LABEL = 'Vistas del panel de detalle';

const rootSession = () => buildSessionInfo();
const childSession = () => buildSessionInfo({ id: CHILD_ID, parentID: ROOT_ID });

const getDetailTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: DETAIL_TABLIST_LABEL });

const getDetailTabs = (): HTMLElement[] =>
  within(getDetailTablist()).getAllByRole('tab');

/**
 * Siembra mínima del workspace abierto en escritorio: la raíz abierta y una
 * hija en el subárbol, con sus mensajes cacheados para que el enriquecimiento
 * marque los nodos sin red. Sin permisos ni formularios ⇒ sin pendientes.
 */
const seedWorkspace = (client: QueryClient): void => {
  seedSessions(client, [rootSession(), childSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedMessages(client, { [ROOT_ID]: [], [CHILD_ID]: [] });
  seedDevice(client, false);
};

/**
 * El mismo workspace con un permiso abierto de la raíz (en la lista global, que
 * alimenta la atención de U4, y por sesión, que enriquece el nodo a
 * `waiting-permission`) ⇒ `attentionCount > 0` en `InspectorPane`.
 */
const seedWorkspaceWithPending = (client: QueryClient): void => {
  seedWorkspace(client);

  const permission = permissionRequest({
    id: PERMISSION_ID,
    sessionID: ROOT_ID,
    action: PERMISSION_ACTION,
  });
  seedPermissions(client, [permission], { bySession: { [ROOT_ID]: [permission] } });
};

const emptyGraph = { nodes: [], edges: [] } as unknown as TGraphModel;

beforeEach(() => {
  resetServiceMock();
});

describe('integración U1↔U5 — regresión del tablist Detalle | Chat (T034)', () => {
  it(
    'conserva etiqueta, orden, aria-label, roving tabindex y el badge de la pestaña Chat',
    async () => {
      const client = createIntegrationQueryClient();
      seedWorkspaceWithPending(client);

      await renderWorkspace(client);
      await screen.findByTestId(TESTID.agentGraph);
      await flushIdle();

      const tablist = getDetailTablist();
      const tabs = getDetailTabs();
      expect(tabs).toHaveLength(2);

      // Orden del DOM y etiquetas íntegras (`Detalle` primero).
      expect(tabs[0]).toHaveAccessibleName('Detalle');
      expect(tabs[1]).toHaveAccessibleName(/^Chat\b/);

      // Roving tabindex: el tablist es el punto de tabulación y los tabs rovan
      // hasta que entra el foco (patrón APG, contract §2).
      expect(tablist).toHaveAttribute('tabindex', '0');
      expect(tabs.every((tab) => tab.getAttribute('tabindex') === '-1')).toBe(true);

      act(() => {
        tabs[0].focus();
      });
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
      expect(tabs[1]).toHaveAttribute('tabindex', '-1');

      // Con pendientes, el badge sigue montado **dentro** del trigger `Chat` y
      // con su etiqueta textual (no-color); sin pendientes no renderiza.
      const badge = await screen.findByTestId('chat-attention-badge');
      expect(within(getDetailTabs()[1]).getByTestId('chat-attention-badge')).toBe(
        badge,
      );
      expect(badge).toHaveAccessibleName('1 pendiente por atender');

      // El resto del workspace sigue sano.
      expect(screen.getByTestId(TESTID.inspectorPanel)).toBeInTheDocument();
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    },
    { timeout: 15_000 },
  );

  it(
    'sin pendientes la lista de dos pestañas no restringe su ancho ni cambia el alto de control',
    async () => {
      const client = createIntegrationQueryClient();
      seedWorkspace(client);

      await renderWorkspace(client);
      await screen.findByTestId(TESTID.agentGraph);
      await flushIdle();

      const tablist = getDetailTablist();

      // Alto: `min-h-control` (no `h-control`), el mismo alto de control que una
      // lista de una fila. Ancho: el tablist externo no lleva `w-full` (hug al
      // contenido) ni `flex-col`: los dos triggers caben en la misma fila, así
      // que `flex-wrap` no envuelve (jsdom no mide layout; se guarda la clase).
      expect(tablist).toHaveClass('min-h-control');
      expect(tablist).toHaveClass('flex-wrap');
      expect(tablist).not.toHaveClass('h-control');
      expect(tablist).not.toHaveClass('w-full');
      expect(tablist.className).not.toMatch(/\bflex-col\b/);

      // Ninguna pestaña pierde su etiqueta; sin pendientes no hay badge.
      const tabs = getDetailTabs();
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Detalle', 'Chat']);
      expect(tabs.every((tab) => tab.className.includes('whitespace-nowrap'))).toBe(
        true,
      );
      expect(screen.queryByTestId('chat-attention-badge')).toBeNull();

      // No vacuidad del caso negativo: `WorkspacePage` sí aporta
      // `onToggleFullscreen`, así que el control de pantalla completa se monta.
      const pane = screen.getByTestId('inspector-pane');
      expect(
        within(pane).getByRole('button', { name: 'Pantalla completa' }),
      ).toBeInTheDocument();
    },
    { timeout: 15_000 },
  );

  it('sin onToggleFullscreen no monta el control de pantalla completa ni pierde etiquetas', () => {
    // `InspectorPane` es consumidor externo del primitivo: se rinde directo
    // (mismos mocks de barrel) para ejercer la rama en la que el llamador no
    // aporta el handler de pantalla completa (contract §7: el tablist no cambia).
    render(
      <InspectorPane
        graph={emptyGraph}
        parallelGroups={[]}
        inspectedNodeId={null}
        showReasoning={false}
        onToggleReasoning={() => {}}
        onOpenHistory={() => {}}
      />,
    );

    const tablist = getDetailTablist();
    expect(tablist).toHaveClass('min-h-control', 'flex-wrap');
    expect(tablist).not.toHaveClass('h-control');

    expect(getDetailTabs().map((tab) => tab.textContent)).toEqual([
      'Detalle',
      'Chat',
    ]);
    expect(screen.queryByTestId('chat-attention-badge')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Pantalla completa' }),
    ).toBeNull();
  });
});
