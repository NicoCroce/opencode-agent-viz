import { createContext, useContext, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { ChatAttentionBadge } from '@app/Domains/Chat';
import { WORKSPACE_TABS, type TWorkspaceTab } from '../WorkspacePage.constants';

/**
 * Conteo de atención del subárbol abierto, publicado por `WorkspacePage` para
 * que el tab móvil Chat muestre su badge (FR-009, `attention-contract.md §2`).
 *
 * `WorkspaceLayout` compone este componente con un conjunto fijo de props y no
 * reenvía datos cross-domain, así que el conteo viaja por **contexto**; la prop
 * directa `attentionCount` tiene precedencia (usos aislados y tests). El valor
 * es el mismo `useSessionAttention` que ya vive en la página: una sola fuente de
 * lógica, dos presentaciones (FR-014).
 */
export const WorkspaceChatAttentionContext = createContext(0);

interface WorkspaceMobileTabsProps {
  tab: TWorkspaceTab;
  onChange: (tab: TWorkspaceTab) => void;
  sessions: ReactNode;
  graph: ReactNode;
  inspector: ReactNode;
  /**
   * Panel del chat como destino de **primer nivel** (FR-013). Es el **mismo**
   * nodo `ChatPanel` (alimentado por `useChatController`) que la pestaña de
   * escritorio: una sola fuente de lógica, dos presentaciones (FR-014, AGENTS
   * §9). Sin `ChatPanel` cableado el panel queda vacío.
   */
  chat?: ReactNode;
  /**
   * Nº de pendientes del subárbol abierto (FR-009). Si se omite, se usa el
   * valor del `WorkspaceChatAttentionContext`.
   */
  attentionCount?: number;
}

/**
 * Presentación móvil del workspace: tablist (`WORKSPACE_TABS`) + panel activo.
 * Recibe los paneles ya armados como `ReactNode` para no duplicar lógica entre
 * desktop y móvil (AGENTS §9, una sola fuente de lógica). El chat es un tab de
 * primer nivel, no una pestaña anidada: este tablist es el **único** del
 * workspace en móvil (FR-013).
 *
 * Sigue el patrón APG de tabs: `role=tablist`/`tab`/`tabpanel`, `aria-controls`
 * ↔ `aria-labelledby`, roving tabindex (un solo tab stop, el activo) y
 * navegación con flechas/Home/End. Los paneles inactivos quedan `hidden` para
 * que el árbol accesible solo exponga el activo; el contenido se monta de forma
 * perezosa.
 */
export const WorkspaceMobileTabs = ({
  tab,
  onChange,
  sessions,
  graph,
  inspector,
  chat = null,
  attentionCount,
}: WorkspaceMobileTabsProps) => {
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<TWorkspaceTab, HTMLButtonElement | null>>>(
    {},
  );
  // La prop directa gana al contexto (tests y usos aislados del componente).
  const contextAttention = useContext(WorkspaceChatAttentionContext);
  const chatAttention = attentionCount ?? contextAttention;

  const tabId = (item: TWorkspaceTab): string => `${baseId}-tab-${item}`;
  const panelId = (item: TWorkspaceTab): string => `${baseId}-panel-${item}`;

  const panels: Record<TWorkspaceTab, ReactNode> = {
    sessions,
    graph,
    inspector,
    chat,
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const last = WORKSPACE_TABS.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? last : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = last;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = WORKSPACE_TABS[nextIndex];
    onChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <Container space="none" className="h-full min-h-0">
      <Container
        row
        space="none"
        className="shrink-0 border-b border-border"
        role="tablist"
        aria-label="Vistas del workspace"
      >
        {WORKSPACE_TABS.map((item, index) => (
          <button
            key={item}
            ref={(node) => {
              tabRefs.current[item] = node;
            }}
            id={tabId(item)}
            type="button"
            role="tab"
            aria-selected={tab === item}
            aria-controls={panelId(item)}
            tabIndex={tab === item ? 0 : -1}
            onClick={() => onChange(item)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
              tab === item
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {item}
            {item === 'chat' ? (
              <ChatAttentionBadge count={chatAttention} />
            ) : null}
          </button>
        ))}
      </Container>
      <Container block className="min-h-0 flex-1 overflow-auto">
        {WORKSPACE_TABS.map((item) => (
          <Container
            key={item}
            block
            id={panelId(item)}
            role="tabpanel"
            aria-labelledby={tabId(item)}
            hidden={tab !== item}
            className="h-full min-h-0"
          >
            {tab === item ? panels[item] : null}
          </Container>
        ))}
      </Container>
    </Container>
  );
};
