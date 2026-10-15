import type { ModelInfo, ModelRef } from '@opencode/client';
import type { TContextUsage } from '../Inspector.entity';

/**
 * Límite de contexto (`limit.context`) del modelo del nodo en el catálogo.
 * Cruza por proveedor y, dentro de él, por `ModelInfo.id` (la clave con la que
 * se envía el modelo) o, si no, por `modelID`. Sin coincidencia o con un límite
 * no positivo devuelve `null`.
 */
export const findContextLimit = (
  models: ModelInfo[],
  ref: ModelRef | null,
): number | null => {
  if (ref === null) return null;
  const sameProvider = models.filter(
    (model) => model.providerID === ref.providerID,
  );
  const match =
    sameProvider.find((model) => model.id === ref.id) ??
    sameProvider.find((model) => model.modelID === ref.id);
  const limit = match?.limit.context ?? null;
  return limit !== null && limit > 0 ? limit : null;
};

/** Fracción usada de la ventana; `null` si falta el uso o el límite. */
export const deriveContextUsage = (
  usedTokens: number | null,
  limitTokens: number | null,
): TContextUsage | null =>
  usedTokens === null || limitTokens === null
    ? null
    : { usedTokens, limitTokens, ratio: usedTokens / limitTokens };

/** Desde qué fracción de la ventana el uso se considera alto o crítico. */
export const CONTEXT_USAGE_HIGH = 0.7;
export const CONTEXT_USAGE_CRITICAL = 0.9;

export type TContextUsageLevel = 'normal' | 'high' | 'critical';

/** Nivel de alerta del uso de la ventana, para el color de la barra. */
export const contextUsageLevel = (ratio: number): TContextUsageLevel => {
  if (ratio >= CONTEXT_USAGE_CRITICAL) return 'critical';
  if (ratio >= CONTEXT_USAGE_HIGH) return 'high';
  return 'normal';
};
