import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  WORKSPACE_TABS,
  type TWorkspaceTab,
} from '../../WorkspacePage.constants';
import {
  WorkspaceChatAttentionContext,
  WorkspaceMobileTabs,
} from '../WorkspaceMobileTabs';

/**
 * T059/FR-013 (chat-panel-contract §2, P4): en móvil el workspace es un tablist
 * de primer nivel con `sessions | graph | inspector | chat`. El chat es un panel
 * **propio**, no una pestaña anidada: este es el **único** tablist de la vista.
 *
 * Se verifica el patrón APG completo (`role=tablist`/`tab`/`tabpanel`,
 * `aria-controls` ↔ `aria-labelledby`, roving tabindex y flechas/Home/End) y que
 * solo se monta el contenido del panel activo.
 *
 * T075/FR-009: se conserva el `ChatAttentionBadge` real (T053) para verificar el
 * badge de atención del tab Chat; el resto del barrel pesado de Chat no se
 * necesita en este spec.
 */
vi.mock('@app/Domains/Chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/Domains/Chat')>();
  return { ChatAttentionBadge: actual.ChatAttentionBadge };
});

interface HarnessProps {
  initialTab?: TWorkspaceTab;
  chat?: ReactNode;
  attentionCount?: number;
}

const Harness = ({
  initialTab = 'graph',
  chat,
  attentionCount,
}: HarnessProps) => {
  const [tab, setTab] = useState<TWorkspaceTab>(initialTab);

  return (
    <WorkspaceMobileTabs
      tab={tab}
      onChange={setTab}
      sessions={<div data-testid="sessions-panel" />}
      graph={<div data-testid="graph-panel" />}
      inspector={<div data-testid="inspector-panel" />}
      chat={chat ?? <div data-testid="chat-panel" />}
      attentionCount={attentionCount}
    />
  );
};

const panelFor = (tab: HTMLElement): HTMLElement | null => {
  const panelId = tab.getAttribute('aria-controls');
  return panelId ? document.getElementById(panelId) : null;
};

describe('WorkspaceMobileTabs — tablist de primer nivel (T059, FR-013, P4)', () => {
  it('renderiza las cuatro pestañas del workspace en orden', () => {
    render(<Harness />);

    const tablist = screen.getByRole('tablist', {
      name: 'Vistas del workspace',
    });
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(
      ['sessions', 'graph', 'inspector', 'chat'],
    );
    expect([...WORKSPACE_TABS]).toEqual([
      'sessions',
      'graph',
      'inspector',
      'chat',
    ]);
  });

  it('marca el tab activo y aplica roving tabindex (APG)', () => {
    render(<Harness initialTab="inspector" />);

    const [sessions, graph, inspector, chat] = screen.getAllByRole('tab');

    expect(inspector).toHaveAttribute('aria-selected', 'true');
    expect(inspector).toHaveAttribute('tabindex', '0');
    for (const tab of [sessions, graph, chat]) {
      expect(tab).toHaveAttribute('tabindex', '-1');
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('enlaza cada tab con su tabpanel vía aria-controls/aria-labelledby', () => {
    render(<Harness />);

    for (const tab of screen.getAllByRole('tab')) {
      const panel = panelFor(tab);
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    }
  });

  it('oculta los paneles inactivos y monta solo el contenido activo', () => {
    render(<Harness initialTab="graph" />);

    expect(screen.getByTestId('graph-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspector-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();

    // El panel inactivo sigue existiendo (para `aria-controls`) pero oculto.
    const sessions = screen.getByRole('tab', { name: 'sessions' });
    expect(panelFor(sessions)).toHaveAttribute('hidden');
  });

  it('cambia de panel al activar otro tab', () => {
    render(<Harness initialTab="graph" />);

    fireEvent.click(screen.getByRole('tab', { name: 'inspector' }));

    expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'inspector' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('navega con flechas y Home/End moviendo foco y selección (APG)', () => {
    render(<Harness initialTab="graph" />);

    const graph = screen.getByRole('tab', { name: 'graph' });
    graph.focus();

    fireEvent.keyDown(graph, { key: 'ArrowRight' });
    const inspector = screen.getByRole('tab', { name: 'inspector' });
    expect(inspector).toHaveAttribute('aria-selected', 'true');
    expect(inspector).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(inspector);

    fireEvent.keyDown(inspector, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'graph' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'graph' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'chat' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'sessions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('hace wrap-around con ArrowRight/ArrowLeft', () => {
    render(<Harness initialTab="sessions" />);

    fireEvent.keyDown(screen.getByRole('tab', { name: 'sessions' }), {
      key: 'ArrowLeft',
    });
    expect(screen.getByRole('tab', { name: 'chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'chat' }), {
      key: 'ArrowRight',
    });
    expect(screen.getByRole('tab', { name: 'sessions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('WorkspaceMobileTabs — el chat es un panel propio (T059, FR-013, P4)', () => {
  it('monta el panel de chat sin tabbars anidadas', () => {
    render(<Harness initialTab="chat" chat={<div data-testid="chat-panel" />} />);

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    // El único tablist es el del workspace: el chat no anida `Detalle | Chat`.
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(
      screen.queryByRole('tablist', { name: 'Vistas del panel de detalle' }),
    ).not.toBeInTheDocument();
  });

  it('el tabpanel del chat es alcanzable por su tab', () => {
    render(<Harness initialTab="chat" />);

    const chat = screen.getByRole('tab', { name: 'chat' });
    const panel = panelFor(chat);

    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('sin nodo de chat el tab queda como panel vacío, sin romper el tablist', () => {
    render(
      <WorkspaceMobileTabs
        tab="chat"
        onChange={() => undefined}
        sessions={null}
        graph={null}
        inspector={null}
      />,
    );

    expect(screen.getByRole('tab', { name: 'chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
  });
});

describe('WorkspaceMobileTabs — badge de atención del tab Chat (T075, FR-009)', () => {
  it('monta el badge en el tab Chat con el conteo recibido por prop', () => {
    render(<Harness attentionCount={2} />);

    const chat = screen.getByRole('tab', { name: /chat/ });
    expect(within(chat).getByTestId('chat-attention-badge')).toBeInTheDocument();
    // `aria-label` textual (marca no-color), `attention-contract.md §2`.
    expect(
      screen.getByRole('img', { name: '2 pendientes por atender' }),
    ).toBeInTheDocument();
    // Los demás tabs no llevan badge.
    expect(
      within(screen.getByRole('tab', { name: 'graph' })).queryByTestId(
        'chat-attention-badge',
      ),
    ).not.toBeInTheDocument();
  });

  it('sin conteo no monta badge (FR-011)', () => {
    render(<Harness />);

    expect(screen.queryByTestId('chat-attention-badge')).not.toBeInTheDocument();
  });

  it('usa el conteo del contexto cuando no llega la prop (cableado de la página)', () => {
    render(
      <WorkspaceChatAttentionContext.Provider value={3}>
        <Harness />
      </WorkspaceChatAttentionContext.Provider>,
    );

    expect(
      screen.getByRole('img', { name: '3 pendientes por atender' }),
    ).toBeInTheDocument();
  });
});
