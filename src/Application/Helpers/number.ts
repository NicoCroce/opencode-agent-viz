/**
 * Suma los valores presentes de `values` ignorando los `null`. Devuelve `null`
 * si no hay ninguno (no `0`), para no confundir "sin datos" con "cero".
 *
 * Extraído de `deriveMetrics.sumNullable` (misma semántica y mismo orden de
 * reducción).
 */
export const sumNullable = (
  values: readonly (number | null)[],
): number | null => {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((total, value) => total + value, 0);
};
