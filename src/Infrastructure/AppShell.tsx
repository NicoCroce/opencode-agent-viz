import { Outlet } from 'react-router-dom';
import { Container } from '@app/Application/Components';
import { ConnectionBadge } from '@app/Domains/Connection';

/** Marca de la consola: tres señales enlazadas (raíz → dos agentes). */
const BrandMark = () => (
  <svg
    aria-hidden
    viewBox="0 0 28 28"
    className="size-7 shrink-0 text-signal"
    fill="none"
  >
    <path
      d="M6 6.5h9.5M15.5 6.5v7M15.5 13.5h6M15.5 13.5v7.5"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeOpacity="0.55"
      strokeLinecap="round"
    />
    <circle cx="6" cy="6.5" r="2" fill="currentColor" fillOpacity="0.9" />
    <circle
      cx="15.5"
      cy="13.5"
      r="2.4"
      fill="currentColor"
      fillOpacity="0.16"
      stroke="currentColor"
      strokeWidth="1.1"
    />
    <circle
      cx="21.5"
      cy="13.5"
      r="1.6"
      fill="currentColor"
      fillOpacity="0.85"
    />
    <circle cx="15.5" cy="21" r="1.6" fill="currentColor" fillOpacity="0.35" />
  </svg>
);

/**
 * Armazón de la consola: barra de mando compacta con la marca y el estado del
 * canal. Dos capas de superficie (hull + abismo) y una sola hairline de señal
 * bajo la cabecera: la firma visual del producto.
 */
export const AppShell = () => (
  <Container
    space="none"
    className="relative h-full bg-transparent text-foreground"
  >
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-surface-0/70 px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark />
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-[13px] font-semibold leading-none tracking-[-0.02em] text-foreground">
            agent viz
          </span>
          <span className="font-mono text-[9px] uppercase leading-none tracking-[0.22em] text-muted-foreground/80">
            opencode
          </span>
        </div>
      </div>
      <ConnectionBadge />
    </header>

    {/* Firma: hairline de señal + barrido lento. Decorativa, nunca bloquea. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-14 z-20 h-px overflow-hidden"
    >
      <div className="h-px w-full bg-gradient-to-r from-transparent via-signal/35 to-transparent" />
      <span className="signal-sweep absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
    </div>

    <Container block className="min-h-0 flex-1">
      <Outlet />
    </Container>
  </Container>
);
