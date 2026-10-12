import { Container } from '@app/Application/Components';
import {
  ChatPendingRequest,
  type TPermissionDecision,
} from '@app/Application/Components/Molecules/ChatPendingRequest';
import type { TPermissionEntry } from '../Inspector.entity';

interface PermissionRowProps {
  /** Permiso que la sesión está esperando (FR-031). */
  permission: TPermissionEntry;
  /**
   * Modo accionable opt-in (FR-005). Por defecto `false`: la fila conserva el
   * comportamiento de solo lectura. Con `true` (y `onReplyPermission`) delega en
   * la molecule `ChatPendingRequest` y ofrece las decisiones `once`/`always`/`reject`.
   */
  actionable?: boolean;
  /** Notifica la decisión elegida; requerido para el modo accionable (FR-005). */
  onReplyPermission?: (decision: TPermissionDecision) => void;
  /** Mutation en vuelo: bloquea los controles en modo accionable (FR-004). */
  isPending?: boolean;
}

/**
 * Fila de un permiso (FR-031): `action` (operación), `resources[]` (recursos
 * afectados) y el motivo textual si el servidor lo reporta (FR-038).
 *
 * Presentación pura extraída de `QuestionsSection`; conserva los textos y el
 * borde inferior de la fila que verifican los specs. En **modo accionable
 * opt-in** (FR-005) reusa la molecule `ChatPendingRequest` (permiso) sin
 * importar componentes de `Domains/Chat`.
 */
export const PermissionRow = ({
  permission,
  actionable = false,
  onReplyPermission,
  isPending = false,
}: PermissionRowProps) => {
  if (actionable && onReplyPermission) {
    return (
      <ChatPendingRequest
        kind="permission"
        permission={permission}
        onReplyPermission={onReplyPermission}
        isPending={isPending}
        className="border-b border-border py-1 last:border-b-0"
      />
    );
  }

  return (
    <Container
      space="none"
      className="border-b border-border py-1 last:border-b-0"
    >
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
};
