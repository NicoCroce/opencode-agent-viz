import { Container } from '@app/Application/Components';
import {
  Button,
  DetailRow,
  SectionFrame,
} from '@app/Application/Components/Molecules';
import { formatPercent, formatTokens } from '@app/Application/Helpers';
import type { TParentImpact } from '@app/Domains/Graph/Graph.entity';

interface ParentImpactRowProps {
  /** Aporte del nodo al contexto del padre; `null` si no aplica (FR-013). */
  impact: TParentImpact | null;
  /** Título del agente padre, para la etiqueta accesible del control. */
  parentTitle?: string | null;
  /** Navega al nodo padre por su id de sesión (FR-014). */
  onNavigate?: (nodeId: string) => void;
  isError?: boolean;
  isLoading?: boolean;
}

/**
 * Apartado **Aporte al padre** del panel de contexto (FR-012..FR-014;
 * `contracts/context-panel-contract.md` §2). Muestra los caracteres que el
 * resultado del hijo inyecta en el padre, qué porcentaje representa y los tokens
 * equivalentes, más un control operable por teclado para navegar al padre. Los
 * cuatro estados de pantalla los resuelve `SectionFrame`; sin padre o sin tool
 * de spawn el `impact` es `null` → estado vacío (nunca ceros).
 */
export const ParentImpactRow = ({
  impact,
  parentTitle = null,
  onNavigate,
  isError = false,
  isLoading = false,
}: ParentImpactRowProps) => {
  const pct = impact?.pctOfParent ?? null;

  return (
    <SectionFrame
      title="Aporte al padre"
      isError={isError}
      isLoading={isLoading}
      isEmpty={impact === null}
      emptyLabel="Sin aporte al padre"
    >
      <Container space="none" className="gap-0.5">
        <DetailRow
          label="Caracteres aportados"
          value={impact?.addedChars ?? null}
        />
        <DetailRow
          label="Aporte al contexto"
          value={pct === null ? null : formatPercent(pct, 1)}
        />
        <DetailRow
          label="Tokens aportados"
          value={formatTokens(impact?.addedTokens ?? null)}
        />
      </Container>

      {impact && onNavigate ? (
        <Button
          variant="link"
          className="h-auto w-fit p-0 text-[11px] font-normal"
          aria-label={`Ir al agente padre: ${parentTitle ?? impact.parentId}`}
          onClick={() => onNavigate(impact.parentId)}
        >
          Ir al agente padre
        </Button>
      ) : null}
    </SectionFrame>
  );
};
