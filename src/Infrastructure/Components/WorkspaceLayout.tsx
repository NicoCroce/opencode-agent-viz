import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { WorkspaceMobileTabs } from './WorkspaceMobileTabs';
import type { TWorkspaceTab } from '../WorkspacePage.constants';

interface WorkspaceLayoutProps {
  isMobile: boolean;
  tab: TWorkspaceTab;
  onChangeTab: (tab: TWorkspaceTab) => void;
  sessions: ReactNode;
  graph: ReactNode;
  inspector: ReactNode;
  history: ReactNode;
}

/**
 * Presentación del workspace: elige entre la vista móvil (`WorkspaceMobileTabs`,
 * tablist + panel activo) y la vista desktop (rail de sesiones, panel del grafo
 * y panel del inspector en tres columnas). Recibe los paneles ya armados como
 * `ReactNode` para que la elección de presentación no duplique lógica
 * (AGENTS §9). El overlay del histórico se monta en ambas presentaciones.
 */
export const WorkspaceLayout = ({
  isMobile,
  tab,
  onChangeTab,
  sessions,
  graph,
  inspector,
  history,
}: WorkspaceLayoutProps) => {
  if (isMobile) {
    return (
      <>
        <WorkspaceMobileTabs
          tab={tab}
          onChange={onChangeTab}
          sessions={sessions}
          graph={graph}
          inspector={inspector}
        />
        {history}
      </>
    );
  }

  return (
    <>
      <Container row space="none" className="h-full min-h-0">
        <Container
          space="none"
          className="w-[280px] shrink-0 overflow-auto border-r border-border"
        >
          {sessions}
        </Container>
        <Container block className="min-h-0 flex-1">
          {graph}
        </Container>
        <Container
          block
          className="w-[360px] shrink-0 overflow-auto border-l border-border"
        >
          {inspector}
        </Container>
      </Container>
      {history}
    </>
  );
};
