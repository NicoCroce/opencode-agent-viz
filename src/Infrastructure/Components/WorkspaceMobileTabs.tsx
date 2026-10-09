import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { WORKSPACE_TABS, type TWorkspaceTab } from '../WorkspacePage.constants';

interface WorkspaceMobileTabsProps {
  tab: TWorkspaceTab;
  onChange: (tab: TWorkspaceTab) => void;
  sessions: ReactNode;
  graph: ReactNode;
  inspector: ReactNode;
}

/**
 * Presentación móvil del workspace: tablist (`WORKSPACE_TABS`) + panel activo.
 * Recibe los paneles ya armados como `ReactNode` para no duplicar lógica entre
 * desktop y móvil (AGENTS §9, una sola fuente de lógica).
 */
export const WorkspaceMobileTabs = ({
  tab,
  onChange,
  sessions,
  graph,
  inspector,
}: WorkspaceMobileTabsProps) => (
  <Container space="none" className="h-full min-h-0">
    <Container
      row
      space="none"
      className="shrink-0 border-b border-border"
      role="tablist"
    >
      {WORKSPACE_TABS.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={tab === item}
          onClick={() => onChange(item)}
          className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
            tab === item
              ? 'border-b-2 border-accent text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          {item}
        </button>
      ))}
    </Container>
    <Container block className="min-h-0 flex-1 overflow-auto">
      {tab === 'sessions' ? sessions : null}
      {tab === 'graph' ? graph : null}
      {tab === 'inspector' ? inspector : null}
    </Container>
  </Container>
);
