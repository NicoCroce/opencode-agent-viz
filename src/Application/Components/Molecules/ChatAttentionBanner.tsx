import type { TAttentionItem } from '@app/Domains/Chat/Chat.entity';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Container,
} from '@app/Application/Components';

export interface ChatAttentionBannerProps {
  /**
   * Pendientes del subárbol de la sesión abierta (`deriveAttention`, FR-009).
   * La señal se monta con ≥1 ítem y desaparece al resolverse (FR-011).
   */
  items: TAttentionItem[];
  /**
   * Lleva a la request que generó el pendiente (FR-010): selecciona la
   * sesión/nodo de origen —aunque sea una hija— y abre el chat.
   */
  onGoToRequest: (item: TAttentionItem) => void;
  className?: string;
}

/** Etiqueta textual del tipo de pendiente (no solo color, FR-021). */
const kindLabel = (item: TAttentionItem): string =>
  item.kind === 'permission' ? 'permiso' : 'pregunta';

/** Ítem más antiguo del set: la acción lleva a la request más urgente (FR-010). */
const oldestItem = (items: TAttentionItem[]): TAttentionItem =>
  items.reduce(
    (oldest, item) => (item.at < oldest.at ? item : oldest),
    items[0],
  );

/**
 * Molecule pura del **banner de atención** del panel de chat (FR-009, FR-010).
 *
 * Resume en un `Alert` (rol `alert`, anuncio accesible) que el agente espera una
 * respuesta y ofrece una acción textual que lleva a la request que la generó,
 * incluso si pertenece a una sesión hija (FR-010). Sin pendientes no renderiza
 * nada (FR-011). Presentacional: no conoce el SDK ni los servicios; solo emite
 * el callback `onGoToRequest`.
 */
export const ChatAttentionBanner = ({
  items,
  onGoToRequest,
  className,
}: ChatAttentionBannerProps) => {
  if (items.length === 0) return null;

  const target = oldestItem(items);
  const label = kindLabel(target);
  const summary =
    items.length === 1
      ? `Solicitud pendiente (${label}): ${target.title}`
      : `${items.length} solicitudes pendientes; la más antigua (${label}): ${target.title}`;

  return (
    <Alert
      data-testid="chat-attention-banner"
      className={`border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-100 ${className ?? ''}`}
    >
      <AlertTitle>El agente necesita tu respuesta</AlertTitle>
      <AlertDescription>{summary}</AlertDescription>
      <Container row justify="end" className="mt-2">
        <Button type="button" onClick={() => onGoToRequest(target)}>
          Ir a la solicitud
        </Button>
      </Container>
    </Alert>
  );
};
