# Contrato — Diff de archivos estilo editor

**Feature**: `008-node-effort-inspector-ux`
**Cubre**: FR-016, FR-017, FR-018, FR-019, FR-020 · SC-004, SC-008
**Implementa**: `Domains/Inspector/lib/parseDiff.ts`, `Domains/Inspector/Inspector.entity.ts` (`TDiffHunk`, `TDiffLine`),
`Domains/Inspector/Components/FileDiff.tsx`, `Domains/Inspector/Components/FileChanges.tsx`.

---

## 1. Entrada y tipos

- **Entrada**: `TFileChange.patch` (`string`), el parche unificado que ya entrega `useSessionDiff` (`FileDiffInfo`). No se añade red ni tipo del SDK.
- **Tipos de vista** (prefijo `T`, Principio IV):

```ts
export type TDiffLineKind = 'added' | 'removed' | 'context' | 'meta';
export interface TDiffLine {
  kind: TDiffLineKind;
  content: string;
  oldNumber: number | null;
  newNumber: number | null;
}
export interface TDiffHunk {
  header: string;      // '@@ -a,b +c,d @@'
  oldStart: number; oldCount: number;
  newStart: number; newCount: number;
  lines: TDiffLine[];
}
```

```ts
// lib/parseDiff.ts (puro)
export const parseUnifiedDiff = (patch: string): TDiffHunk[];
```

## 2. Reglas del parser

- **Hunks**: cabecera `@@ -a[,b] +c[,d] @@`; `count` ausente → 1. Cada bloque inicia un rango y su numeración incremental.
- **Líneas**: `+` → `added` (avanza `newNumber`), `-` → `removed` (avanza `oldNumber`), ` ` → `context` (avanza ambos).
- **`\ No newline at end of file`** → línea `meta`, sin numeración. No genera líneas espurias (FR-020).
- **Cabeceras internas** (`diff --git`, `index`, `---`/`+++`, `rename from/to`) y contenido inesperado → `meta`/contexto sin numeración; el parser **nunca lanza** (FR-020).
- **Patch vacío** (`''` o solo espacios) → `[]` → la vista muestra "parche no disponible" (comportamiento actual preservado).
- **Rename-only sin hunks** → `[]`; el encabezado del archivo sigue mostrando su estado (FR-019).
- **Contenido no textual** → no rompe: se renderiza como texto seguro o "parche no disponible".

## 3. Presentación (FR-016..FR-019, design-direction §3.5)

- **Fondo por línea**: añadida = `--status-done` a ~14 % de alfa + borde izquierdo sólido; eliminada = `--status-error` a ~14 % + borde; contexto = sin fondo. Tokens, nunca hex.
- **Canal de números doble** (viejo/nuevo) en JetBrains Mono con `tabular-nums`, color `--muted-foreground` (FR-018).
- **Encabezado de hunk** en `--surface-2` con el rango `@@ -a,b +c,d @@` y chevron de colapso; **expandido por defecto** (FR-017). El estado de colapso es local a `FileDiff` (set por hunk), sin persistencia.
- **Estado del archivo** (FR-019): punto LED (`--status-done`/`--status-running`/`--status-error`) reutilizando el lenguaje de LEDs; etiqueta `añadido`/`modificado`/`borrado`.
- **Rendimiento** (SC-004): parseo lineal memoizado por archivo seleccionado; sin dependencias.

## 4. Accesibilidad (SC-007)

- El encabezado de cada hunk es un control operable por teclado (`<button>` con `aria-expanded`) que colapsa/expande el bloque.
- La selección de archivo conserva el patrón `aria-pressed` ya existente en `FileChanges`.

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| D1 | `+`/`-`/contexto se clasifican y numeran correctamente | spec puro `parseDiff.spec.ts` |
| D2 | Múltiples hunks con rango y `count` por defecto | spec puro |
| D3 | `\ No newline…` → `meta` sin numeración ni líneas espurias | spec puro |
| D4 | Patch vacío → `[]` → "parche no disponible" | spec puro + spec de `FileChanges` |
| D5 | Contenido/cabecera inesperada no lanza | spec puro |
| D6 | Añadidas/eliminadas distinguibles por color (clases de token) | spec de `FileDiff` |
| D7 | Hunks expandidos por defecto y colapsables por teclado | spec de `FileDiff` |
| D8 | Canal doble de números presente | spec de `FileDiff` |
| D9 | Estado del archivo (añadido/eliminado/modificado) distinguible | spec de `FileChanges`/`FileDiff` |
