import type { TDiffHunk } from '../Inspector.entity';

/**
 * Cabecera de hunk unificado: `@@ -a[,b] +c[,d] @@`. Los `count` son opcionales
 * y, cuando se omiten, valen 1 (file-diff-contract §2).
 */
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const parseCount = (value: string | undefined): number =>
  value === undefined ? 1 : Number.parseInt(value, 10);

/**
 * Convierte un `patch` unificado (el que entrega `FileDiffInfo.patch`) en la
 * estructura de vista de hunks y líneas numeradas (file-diff-contract §1/§2).
 *
 * Recorrido lineal, sin dependencias y sin efectos: reconoce cabeceras de hunk,
 * clasifica `+`/`-`/contexto con numeración doble incremental y trata el
 * marcador `\ No newline at end of file` y el contenido inesperado como `meta`
 * sin numeración. **Nunca lanza**: un patch vacío devuelve `[]` y las líneas de
 * preámbulo (`diff --git`, `---`/`+++`, …) se ignoran sin romper (R5, FR-020).
 */
export const parseUnifiedDiff = (patch: string): TDiffHunk[] => {
  if (patch.trim().length === 0) return [];

  const hunks: TDiffHunk[] = [];
  let current: TDiffHunk | null = null;
  let oldNumber = 0;
  let newNumber = 0;

  for (const line of patch.split('\n')) {
    const header = HUNK_HEADER.exec(line);

    if (header) {
      oldNumber = Number.parseInt(header[1], 10);
      newNumber = Number.parseInt(header[3], 10);
      current = {
        header: line,
        oldStart: oldNumber,
        oldCount: parseCount(header[2]),
        newStart: newNumber,
        newCount: parseCount(header[4]),
        lines: [],
      };
      hunks.push(current);
      continue;
    }

    // Líneas de preámbulo (antes del primer hunk) se ignoran sin romper.
    if (current === null) continue;

    if (line.startsWith('+')) {
      current.lines.push({
        kind: 'added',
        content: line.slice(1),
        oldNumber: null,
        newNumber,
      });
      newNumber += 1;
    } else if (line.startsWith('-')) {
      current.lines.push({
        kind: 'removed',
        content: line.slice(1),
        oldNumber,
        newNumber: null,
      });
      oldNumber += 1;
    } else if (line.startsWith(' ')) {
      current.lines.push({
        kind: 'context',
        content: line.slice(1),
        oldNumber,
        newNumber,
      });
      oldNumber += 1;
      newNumber += 1;
    } else if (line.length > 0) {
      // `\ No newline at end of file` y contenido inesperado → `meta`.
      current.lines.push({
        kind: 'meta',
        content: line,
        oldNumber: null,
        newNumber: null,
      });
    }
    // `line === ''` es el artefacto del salto final: se omite.
  }

  return hunks;
};
