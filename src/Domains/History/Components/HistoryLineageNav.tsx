import { Container } from '@app/Application/Components';
import { UNAVAILABLE } from '@app/Application/Helpers';
import { NavButton } from '@app/Application/Components/Molecules';

interface HistoryLineageNavProps {
  /** Sesión que invocó a la actual; `null` si es raíz (FR-012). */
  parentId: string | null;
  /** Sesiones invocadas por la actual (FR-012). */
  childrenIds: string[];
  /** Cambia la sesión objetivo sin cerrar el overlay (FR-012). */
  onNavigate: (sessionId: string) => void;
}

/** Fallback "no disponible" del linaje (FR-038), con su `aria-label`. */
const UnavailableNav = () => (
  <span
    className="font-mono text-[11px] text-muted-foreground"
    aria-label="no disponible"
  >
    {UNAVAILABLE}
    <span className="sr-only"> no disponible</span>
  </span>
);

/**
 * Navegación de linaje de la cabecera del histórico (FR-012): "Invocado por"
 * (padre) e "Invocó a" (hijos), con `NavButton` para saltar de sesión sin cerrar
 * el overlay. Presentación pura.
 */
export const HistoryLineageNav = ({
  parentId,
  childrenIds,
  onNavigate,
}: HistoryLineageNavProps) => (
  <Container row space="large" className="flex-wrap items-center">
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Invocado por
      </span>
      {parentId ? (
        <NavButton sessionId={parentId} onNavigate={onNavigate} />
      ) : (
        <UnavailableNav />
      )}
    </span>

    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Invocó a
      </span>
      {childrenIds.length > 0 ? (
        childrenIds.map((childId) => (
          <NavButton key={childId} sessionId={childId} onNavigate={onNavigate} />
        ))
      ) : (
        <UnavailableNav />
      )}
    </span>
  </Container>
);
