import { Link, Outlet } from 'react-router-dom';
import { Container } from '@app/Application/Components';
import { ConnectionBadge } from '@app/Domains/Connection';
import { SESSIONS_LIST_ROUTE } from '@app/Domains/Sessions';

/** Marca: cuadro con LED cyan, la firma visual del rediseño. */
const BrandMark = () => (
  <span
    aria-hidden
    className="inline-flex size-[22px] items-center justify-center rounded-flat border-[1.5px] border-accent"
  >
    <span className="size-1.5 rounded-full bg-accent glow-accent" />
  </span>
);

export const AppShell = () => (
  <Container space="none" className="h-full bg-surface-0 text-foreground">
    <Container
      row
      space="none"
      justify="between"
      align="center"
      className="h-14 shrink-0 border-b border-border bg-surface-1 px-4"
    >
      <Link
        to={SESSIONS_LIST_ROUTE}
        className="inline-flex items-center gap-2.5 rounded-flat text-foreground"
      >
        <BrandMark />
        <span className="font-display text-[15px] font-semibold tracking-tight">
          agent<span className="text-accent">·</span>viz
        </span>
      </Link>
      <ConnectionBadge />
    </Container>
    <Container block className="min-h-0 flex-1">
      <Outlet />
    </Container>
  </Container>
);
