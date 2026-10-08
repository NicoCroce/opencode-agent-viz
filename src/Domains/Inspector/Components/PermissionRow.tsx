import { Container } from '@app/Application/Components';
import type { TPermissionEntry } from '../Inspector.entity';

interface PermissionRowProps {
  /** Permiso que la sesión está esperando (FR-031). */
  permission: TPermissionEntry;
}

/**
 * Fila de un permiso (FR-031): `action` (operación), `resources[]` (recursos
 * afectados) y el motivo textual si el servidor lo reporta (FR-038).
 *
 * Presentación pura extraída de `QuestionsSection`; conserva los textos y el
 * borde inferior de la fila que verifican los specs.
 */
export const PermissionRow = ({ permission }: PermissionRowProps) => (
  <Container space="none" className="border-b border-border py-1 last:border-b-0">
    <span className="font-mono text-xs text-foreground">
      {permission.action}
    </span>
    {permission.resources.length > 0 ? (
      <span className="font-mono text-[11px] text-muted-foreground">
        {permission.resources.join(', ')}
      </span>
    ) : null}
    {permission.message ? (
      <span className="text-[11px] text-muted-foreground">
        {permission.message}
      </span>
    ) : null}
  </Container>
);
