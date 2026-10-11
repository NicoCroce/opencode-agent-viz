import type { ModelInfo } from '@opencode/client';
import type { TModelOption, TReasoningOption } from '../Chat.entity';

/**
 * Catálogo de modelos y sus variantes de razonamiento (data-model §2.4,
 * `contracts/chat-panel-contract.md` §3, research R7). Función **pura**: proyecta
 * `ModelInfo[]` → `TModelOption[]`, derivando por modelo su lista de
 * `TReasoningOption[]` desde `ModelInfo.variants` (`ModelVariant.id` **es** la
 * variante de razonamiento). Modelo sin variantes → lista vacía y el envío sigue
 * funcionando (P6). No muta la entrada.
 */
export function mapModelOptions(models: ModelInfo[]): TModelOption[] {
  return models.map((model) => ({
    id: model.id,
    label: model.name,
    // `ref` base sin variante: la variante se elige en el selector de razonamiento.
    ref: { id: model.id, providerID: model.providerID },
    reasoning: model.variants.map(
      (variant): TReasoningOption => ({
        value: variant.id,
        label: variant.id,
      }),
    ),
  }));
}
