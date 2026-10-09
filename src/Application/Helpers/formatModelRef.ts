import type { ModelRef } from '@opencode/client';

/**
 * Referencia legible de un modelo como `provider/id` (FR-010/FR-038). Única
 * fuente de verdad compartida por `HistoryEntry` (`formatModel`), `HistoryHeader`,
 * `ModelSection`, `AgentNode` y `cardHeight`.
 *
 * Las cinco copias producían exactamente el mismo string; solo diferían en el
 * manejo del `null`, que queda en el llamador (omitir, `UNAVAILABLE` o `null`),
 * no en este formateador.
 */
export const formatModelRef = (model: ModelRef): string =>
  `${model.providerID}/${model.id}`;
