import { Outlet } from 'react-router-dom';
import { Container } from '@app/Application/Components';
import { ConnectionBadge } from '@app/Domains/Connection';

export const AppShell = () => (
  <Container space="none" className="h-full bg-surface-0 text-foreground">
    <Container
      row
      space="none"
      justify="between"
      align="center"
      className="h-14 shrink-0 border-b border-border bg-surface-1 px-4"
    >
      <span className="font-mono text-sm font-semibold tracking-tight">
        opencode<span className="text-accent">·</span>agent-viz
      </span>
      <ConnectionBadge />
    </Container>
    <Container block className="min-h-0 flex-1">
      <Outlet />
    </Container>
  </Container>
);
