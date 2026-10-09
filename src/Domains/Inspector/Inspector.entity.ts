/**
 * Barrel de tipos del dominio Inspector.
 *
 * Los tipos se reparten por preocupación: preguntas/permisos
 * (`InspectorQuestions.entity`), sesión/diff/tareas/resumen
 * (`InspectorSession.entity`) y recursos (`InspectorResources.entity`). Este
 * archivo re-exporta todos para preservar la API pública que consumen el resto
 * del dominio, `Graph` y `WorkspacePage` (importan desde `Inspector.entity`).
 */
export * from './InspectorQuestions.entity';
export * from './InspectorSession.entity';
export * from './InspectorResources.entity';

/**
 * Tipo de vista de una línea de diff (FR-016, file-diff-contract §1).
 * `meta` agrupa cabeceras internas y el marcador `\ No newline at end of file`.
 */
export type TDiffLineKind = 'added' | 'removed' | 'context' | 'meta';

/**
 * Línea de un patch unificado ya clasificada (tipo de vista, Principio IV: no
 * redefine nada del SDK). `oldNumber`/`newNumber` son `null` donde no aplica.
 */
export interface TDiffLine {
  kind: TDiffLineKind;
  /** Texto sin el prefijo `+`/`-`/` `. */
  content: string;
  /** Número en el archivo viejo; `null` en añadidas/metadatos. */
  oldNumber: number | null;
  /** Número en el archivo nuevo; `null` en eliminadas/metadatos. */
  newNumber: number | null;
}

/**
 * Hunk de un patch unificado (tipo de vista): cabecera `@@ -a,b +c,d @@`, su
 * rango y las líneas numeradas que lo componen (file-diff-contract §1).
 */
export interface TDiffHunk {
  /** Cabecera original `@@ -a,b +c,d @@` (se conserva para mostrar). */
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: TDiffLine[];
}
