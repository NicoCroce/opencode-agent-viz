/**
 * Compara dos query keys de TanStack Query: misma longitud e igualdad estricta
 * elemento a elemento.
 *
 * Unifica `useExecutionSignals.sameKey` (producción) y el `sameKey` local del
 * spec de `eventReducer` (no existía en producción: el reducer se limita a
 * emitir el `queryKey` y cada consumidor lo filtraba). Ambas implementaciones
 * eran idénticas carácter a carácter, así que la semántica no cambia.
 *
 * Es un cotejo **superficial**: cada elemento se compara por identidad (`===`),
 * no por valor. Dos arrays con objetos estructuralmente iguales pero distinta
 * referencia no son iguales. Los query keys del proyecto son de primitivos
 * (`string`/`number`) o referencias reutilizadas, de modo que el cotejo
 * superficial es suficiente.
 */
export const sameQueryKey = (
  a: readonly unknown[],
  b: readonly unknown[],
): boolean => a.length === b.length && a.every((value, index) => value === b[index]);
