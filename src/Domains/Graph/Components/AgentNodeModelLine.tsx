import { Container } from '@app/Application/Components';
import { formatModelRef } from '@app/Application/Helpers/formatModelRef';
import type { ModelRef } from '@opencode/client';

interface AgentNodeModelLineProps {
  /** Modelo del nodo; `null` oculta la línea. */
  model: ModelRef | null;
}

/**
 * Línea de modelo: nombre `provider/id` a la izquierda y variante a la derecha.
 * Reutiliza `formatModelRef` (SH-09) para el nombre.
 */
export const AgentNodeModelLine = ({ model }: AgentNodeModelLineProps) => {
  if (!model) return null;

  return (
    <Container
      row
      align="start"
      justify="between"
      space="small"
      className="mt-1 min-w-0"
    >
      <span className="min-w-0 break-all font-mono text-[11px] leading-snug text-foreground">
        {formatModelRef(model)}
      </span>
      {model.variant ? (
        <span className="shrink-0 rounded-flat border border-border px-1 font-mono text-[10px] leading-4 text-muted-foreground">
          {model.variant}
        </span>
      ) : null}
    </Container>
  );
};
