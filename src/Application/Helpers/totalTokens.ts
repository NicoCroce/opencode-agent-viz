import type { TTokenUsage } from '@app/Domains/Graph/Graph.entity';

/**
 * Total de tokens consumidos (entrada + salida + razonamiento), o `null`.
 * Ignora los componentes `null` y devuelve `null` si no hay ninguno; los tokens
 * de caché (`cacheRead`/`cacheWrite`) se excluyen a propósito, igual que en las
 * tres copias de origen. Única fuente de verdad compartida por `AgentNode`,
 * `HistoryHeader` y `SessionSummaryBar` (Familia 5).
 */
export const totalTokens = (tokens: TTokenUsage | null): number | null => {
  if (!tokens) return null;
  const values = [tokens.input, tokens.output, tokens.reasoning].filter(
    (value): value is number => value !== null,
  );
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
};
