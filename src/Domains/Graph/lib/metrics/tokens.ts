import type { TTokenUsage } from '../../Graph.entity';

/** Acumulador mutable de tokens durante el barrido de mensajes. */
export interface TokenAccumulator {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Marca qué componentes de token se vieron al menos una vez. */
export interface TokenSeen {
  input: boolean;
  output: boolean;
  reasoning: boolean;
  cacheRead: boolean;
  cacheWrite: boolean;
}

/** Forma de `tokens` tal como la entrega el SDK en un mensaje assistant. */
export interface SdkTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

/**
 * Acumula los tokens de un mensaje assistant en `acc` y marca en `seen` los
 * componentes presentes. No decide la forma final: eso lo hace `toTokenUsage`.
 */
export const accumulateTokens = (
  tokens: SdkTokens,
  acc: TokenAccumulator,
  seen: TokenSeen,
): void => {
  acc.input += tokens.input;
  acc.output += tokens.output;
  acc.reasoning += tokens.reasoning;
  acc.cacheRead += tokens.cache.read;
  acc.cacheWrite += tokens.cache.write;
  seen.input = true;
  seen.output = true;
  seen.reasoning = true;
  seen.cacheRead = true;
  seen.cacheWrite = true;
};

/**
 * Proyecta el acumulador a `TTokenUsage` respetando qué campos se vieron: los
 * no vistos quedan `null`; si no se vio ninguno, devuelve `null` (sin datos,
 * no cero).
 */
export const toTokenUsage = (
  acc: TokenAccumulator,
  seen: TokenSeen,
): TTokenUsage | null => {
  const hasTokens =
    seen.input ||
    seen.output ||
    seen.reasoning ||
    seen.cacheRead ||
    seen.cacheWrite;

  return hasTokens
    ? {
        input: seen.input ? acc.input : null,
        output: seen.output ? acc.output : null,
        reasoning: seen.reasoning ? acc.reasoning : null,
        cacheRead: seen.cacheRead ? acc.cacheRead : null,
        cacheWrite: seen.cacheWrite ? acc.cacheWrite : null,
      }
    : null;
};
