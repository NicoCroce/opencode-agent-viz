/**
 * Barrel de tipos del dominio History.
 *
 * Los tipos se reparten por preocupación: entradas del histórico y navegación
 * de linaje (`HistoryEntry.entity`), view-models de pregunta
 * (`HistoryQuestion.entity`) y estados del SDK (`HistoryStatus.entity`). Este
 * archivo re-exporta todos para preservar la API pública que consumen el resto
 * del dominio, `Inspector` y `Application/Components` (importan desde
 * `History.entity`).
 */
export * from './HistoryEntry.entity';
export * from './HistoryQuestion.entity';
export * from './HistoryStatus.entity';
