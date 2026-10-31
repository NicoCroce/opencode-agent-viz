import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Button,
  Container,
  EmptyScreenError,
  EmptyState,
} from '@app/Application/Components';
import { Alert } from '@app/Application/Components/Molecules/Alert';
import { useDevice } from '@app/Application/Hooks';
import {
  EfficiencyReport,
  EfficiencySkeleton,
  useSessionEfficiency,
  type TEfficiencyReference,
  type TEfficiencyReport,
  type TEfficiencySessionMeta,
} from '@app/Domains/Efficiency';

/** Copy exacto del aviso de subárbol parcial (contrato overlay §4). */
const partialMessage = (missingCount: number): string =>
  `Análisis parcial: ${missingCount} sesiones sin datos`;

/** Copy exacto de la nota de grafo truncado (contrato overlay §4). */
const TRUNCATED_MESSAGE =
  'El grafo está truncado: faltan agentes del subárbol.';

/** Copy exacto del aviso de informe conservado (contrato overlay §4). */
const STALE_MESSAGE =
  'No se pudieron actualizar los datos; se muestra el último análisis.';

export interface TEfficiencyOverlayProps {
  isOpen: boolean;
  rootSessionId: string;
  rootTitle: string | null;
  sessions: Record<string, TEfficiencySessionMeta>;
  rootReady: boolean;
  truncated: boolean;
  graphError: boolean;
  /** `openedAt` fijo del panel; no tickea. */
  now: number | null;
  /** Subconjunto estructural de `TNodeMetrics` para el contraste de totales. */
  reference: TEfficiencyReference | null;
  onClose: () => void;
  onRestoreFocus: () => void;
}

/** Estado del cuerpo: el informe solo existe cuando el análisis está listo. */
type TBodyState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'report'; report: TEfficiencyReport };

/**
 * Overlay de análisis de eficiencia (contrato overlay §2–§4).
 *
 * Radix Dialog full-screen aporta `role="dialog"`, focus trap, `Escape` y
 * scroll-lock. El informe y sus bloques viven en el dominio Efficiency; aquí
 * solo se resuelven los estados globales y la composición cross-domain, que es
 * la única razón por la que el overlay vive en Infrastructure.
 *
 * - `onCloseAutoFocus` evita el foco de Radix en el body y delega en
 *   `onRestoreFocus`, que devuelve el foco al disparador si sigue montado.
 * - El hook se ejecuta siempre, con `enabled = isOpen`; cerrado no observa la
 *   caché ni analiza nada, y Radix no monta el contenido.
 * - Carga, error y vacío conservan el header y “Cerrar” (FR-036).
 * - Los avisos de parcial/truncado/no actualizado van dentro del cuerpo, sobre
 *   el informe, y nunca lo sustituyen (FR-037).
 */
export const EfficiencyOverlay = ({
  isOpen,
  rootSessionId,
  rootTitle,
  sessions,
  rootReady,
  truncated,
  graphError,
  now,
  reference,
  onClose,
  onRestoreFocus,
}: TEfficiencyOverlayProps) => {
  const { isMobile } = useDevice();
  const { report, isError, isPartial, missingSessionIds } =
    useSessionEfficiency({
      rootSessionId,
      sessions,
      rootReady,
      truncated,
      graphError,
      now: now ?? undefined,
      enabled: isOpen,
    });

  const agentCount = Object.keys(sessions).length;
  const subtitle = rootTitle ?? `Solo lectura · ${agentCount} agentes`;

  /**
   * Banners que acompañan al informe sin reemplazarlo:
   * - parcial: faltan mensajes de nodos del subárbol (con truncado sin
   *   ausencias, la nota de truncado ya lo explica y no se dice “0 sesiones”).
   * - truncado: el grafo declara el subárbol incompleto.
   * - no actualizado: `graphError` con informe previo. El hook nunca expone
   *   `isError` junto a un `report` (lo conserva), así que la señal es la prop.
   */
  const missingCount = missingSessionIds.length;
  const showPartial = isPartial && missingCount > 0;
  const showStale = report !== null && graphError;

  /**
   * Sin informe el hook solo puede estar cargando o en error (`isError`); el
   * cuerpo se resuelve con un estado explícito para no dejar una rama final
   * inalcanzable. `no_data` es un informe sin turnos, no un cuerpo vacío.
   */
  const bodyState: TBodyState = report
    ? report.status === 'no_data'
      ? { kind: 'empty' }
      : { kind: 'report', report }
    : isError
      ? { kind: 'error' }
      : { kind: 'loading' };

  const renderBody = () => {
    switch (bodyState.kind) {
      case 'loading':
        return <EfficiencySkeleton />;
      case 'error':
        return <EmptyScreenError message="No se pudo cargar la sesión." />;
      case 'empty':
        return (
          <EmptyState
            title="Sin mensajes"
            description="Esta sesión todavía no reportó mensajes."
          />
        );
      case 'report':
        return (
          <Container space="medium">
            {(showPartial || truncated || showStale) && (
              <Container space="small">
                {showPartial && (
                  <Alert
                    variant="info"
                    role="status"
                    ariaLive="polite"
                    message={partialMessage(missingCount)}
                  />
                )}
                {truncated && (
                  <Alert
                    variant="warning"
                    role="status"
                    ariaLive="polite"
                    message={TRUNCATED_MESSAGE}
                  />
                )}
                {showStale && (
                  <Alert
                    variant="warning"
                    role="status"
                    ariaLive="polite"
                    message={STALE_MESSAGE}
                  />
                )}
              </Container>
            )}
            <EfficiencyReport
              report={bodyState.report}
              reference={reference}
              isMobile={Boolean(isMobile)}
            />
          </Container>
        );
    }
  };

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(206_46%_2%/0.74)] backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 bg-surface-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
        >
          <Container space="none" className="h-full">
            <div className="border-b border-border/60 bg-surface-0/70 px-5 py-4 backdrop-blur-xl">
              <Container
                row
                align="center"
                justify="between"
                space="medium"
                className="mx-auto w-full max-w-6xl flex-wrap"
              >
                <Container space="small" className="min-w-0">
                  <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
                    Eficiencia de la sesión
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    Análisis de solo lectura de la sesión y su subárbol.
                  </DialogPrimitive.Description>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </Container>
                <Button
                  variant="outline"
                  aria-label="Cerrar análisis de eficiencia"
                  onClick={onClose}
                >
                  Cerrar
                </Button>
              </Container>
            </div>

            <Container
              space="none"
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6"
            >
              <div className="mx-auto w-full max-w-6xl flex-wrap">
                {renderBody()}
              </div>
            </Container>
          </Container>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
