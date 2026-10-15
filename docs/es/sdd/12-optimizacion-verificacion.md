# Optimización de la verificación (`verify.sh` y Vitest)

Este documento recoge **qué** se cambió para acelerar la fase `verify`, **por qué**, **con qué evidencia**, **qué se descartó** y **cómo reproducir** las mediciones. Es la referencia de las decisiones; el uso diario está en [Fases](02-phases.md) y en [Optimización del contexto §6.4](11-optimizacion-contexto.md#64-verifysh).

> **Estado:** los cambios están aplicados y **medidos** en un MacBook Pro M1 (4 núcleos de rendimiento + 4 de eficiencia, 16 GB). Cada cifra es de **una sola corrida**; el ruido entre corridas es de unos ±5 s. Las cifras marcadas como *estimación* no se midieron.

## 1. Resultado

| | Antes | Después |
|---|---|---|
| `verify.sh` completo (`lint` + `tsc` + `test` + `build`) | **200–280 s** | **41 s** |
| `pnpm test` (2126 tests) | 56 s (sin límite de workers) | **39,5 s** (4 workers) |
| `pnpm lint` (caché caliente) | 19 s | **1,3 s** |
| `pnpm tsc` (caché caliente) | 5,5 s | **1,9 s** |

> La línea base de 200–280 s es la que se midió **antes** de empezar, con la ejecución en serie. No se volvió a medir, porque el script ya había cambiado.

Corrida final, sin intervención:

```text
PASS lint (7s)
PASS tsc (4s)
PASS test (41s) — Tests  2126 passed | 1 skipped (2127)
PASS build (2s)
total 40,8 s
```

Los 2126 tests pasan igual que antes: no se eliminó ni se omitió ninguno.

## 2. Qué se cambió

| # | Cambio | Dónde | Commit |
|---|---|---|---|
| 1 | `lint`, `tsc` y `build` en paralelo (helper `run_cmd`); `build` ejecuta solo `vite build` si `tsc` ya está en la lista (antes `tsc` corría dos veces) | `.opencode/scripts/bash/verify.sh` | `13cb4a0` |
| 2 | Límite de workers de Vitest | `verify.sh` | `32d4f43` (reemplazado por #6) |
| 3 | Los `.spec.ts` corren en entorno `node` (no `jsdom`); `setup.ts` carga las piezas de DOM solo si hay DOM; 4 specs que sí necesitan DOM declaran `// @vitest-environment jsdom` | `vitest.config.ts`, `src/test/setup.ts`, 4 specs | `823dbd3` |
| 4 | Caché de ESLint (`--cache`) y `tsc` incremental | `package.json`, `tsconfig.json` | `d273ee1` |
| 5 | Los cuatro comandos corren en paralelo, incluido `test`; opción `--changed`; pool `threads` | `verify.sh`, `.opencode/agents/sddorch.md` | `7e9a464` |
| 6 | Tope de 4 workers en la configuración, para `pnpm test`, `test:watch` y `verify.sh` | `vitest.config.ts` | `ed876db` |

### 2.1 `verify.sh` en paralelo

Los cuatro comandos arrancan a la vez y cada uno escribe su código de salida y su duración en archivos temporales (`<log-dir>/<cmd>.rc` y `.dur`). Cuando todos terminan, el script los lee, los borra e imprime el resumen **siempre en el orden** `lint`, `tsc`, `test`, `build`. El formato de error no cambió: primeras 20 líneas con coincidencia, conteo del resto y las últimas 10 líneas del log si no hay coincidencias.

Es seguro correrlos juntos porque `tsc` usa `noEmit` y `vite build` no toca `src/`. La caché de `tsc` (`node_modules/.cache/tsc/app.tsbuildinfo`) la escribe un único proceso.

### 2.2 Specs `.spec.ts` en entorno `node`

La suite tiene 214 archivos: 85 `.spec.ts` (lógica pura: reductores, `buildGraph`, servicios) y 129 `.spec.tsx`. Ningún archivo declaraba entorno, así que **los 214 levantaban `jsdom`**.

Ahora `environmentMatchGlobs: [['src/**/*.spec.ts', 'node']]` los pasa a `node`. Cuatro de ellos sí usan DOM y declaran `// @vitest-environment jsdom` en su primera línea:

| Spec | Por qué necesita DOM |
|---|---|
| `Graph/lib/specs/anomalyThreshold.spec.ts` | `localStorage` |
| `Infrastructure/lib/specs/isFocusWithinChat.spec.ts` | `document` |
| `Infrastructure/specs/harness.helpers.spec.ts` | `render` de Testing Library |
| `Application/Helpers/specs/prefersReducedMotion.spec.ts` | `window.matchMedia` |

El último se descubrió porque **falló** en la primera corrida con el nuevo entorno (2 tests), no por análisis previo. `windowStats.spec.ts` menciona `window`, pero es solo el nombre de una variable.

`src/test/setup.ts` quedó así: lo común (`vi.restoreAllMocks`, `vi.clearAllMocks`) corre siempre, y lo de DOM (`jest-dom`, `cleanup`, polyfills de Radix, limpieza de `localStorage`) se carga con `import()` dinámico solo si `document` existe. Para `jest-dom` se usa `@testing-library/jest-dom/vitest`; la entrada raíz no tiene tipos de módulo y rompía `pnpm tsc`.

### 2.3 Cachés

- **ESLint:** `eslint . --cache --cache-location node_modules/.cache/eslint/`.
- **`tsc`:** `incremental: true` y `tsBuildInfoFile: ./node_modules/.cache/tsc/app.tsbuildinfo` en `tsconfig.json`.

Ambas viven en `node_modules/.cache`, que git ignora. La **primera** corrida tras borrarlas es tan lenta como antes (lint ≈ 19 s, tsc ≈ 5,5 s); el beneficio aparece cuando cambian pocos archivos.

### 2.4 `--changed`

```bash
.opencode/scripts/bash/verify.sh --changed tsc test
```

`test` corre solo los specs afectados por los cambios sin commitear (`vitest --changed`) y no falla si no hay ninguno. `sddorch` lo usa **tras cada ola**; la fase `verify` sigue corriendo todo, sin el flag.

Dos precisiones medidas:

- Tocar un archivo muy importado (`formatDuration.ts`) ejecutó **865 tests en 30 s**: Vitest sigue el grafo de imports.
- Cambiar `vitest.config.ts` o `setup.ts` ejecuta **toda** la suite (2126 tests, 40 s). Es el comportamiento correcto.

## 3. Evidencia

### 3.1 Progresión

| Paso | `verify.sh` | `test` | Nota |
|---|---|---|---|
| Línea base (serie) | 200–280 s | — | Medida antes de empezar |
| `lint`/`tsc`/`build` en paralelo, `test` después | 78 s | 56 s | `lint` 23 s, `tsc` 9 s, `build` 2 s |
| + tope de 2 workers (`forks`) | 100 s | 81 s | Más lento a propósito: se pidió limitar la carga |
| + specs `.spec.ts` en `node` | — | 66 s | Mismo tope de 2 workers |
| + pool `threads` | — | 60 s | Mismo tope de 2 workers |
| + 4 workers y todo en paralelo | **41 s** | 41 s | Corrida final |

### 3.2 Efecto del entorno `node` (2 workers `forks`, mismos 2126 tests)

Los tiempos de Vitest son **sumas entre workers**, no tiempo real.

| Fase | Antes | Después |
|---|---|---|
| `environment` | 50,2 s | 30,9 s |
| `setup` | 24,0 s | 14,9 s |
| `collect` | 23,7 s | 24,5 s |
| `tests` | 31,0 s | 30,7 s |
| `prepare` | 7,9 s | 7,9 s |
| **Duración total** | **80,4 s** | **66,2 s** |

Solo bajan `environment` y `setup`: el costo de levantar `jsdom` en archivos que no lo necesitan. Los tests en sí no cambian.

### 3.3 Barrido de workers (pool `threads`)

| Workers | Tiempo de `test` |
|---|---|
| 2 | 60 s |
| 3 | 46 s |
| 4 | 39 s |
| 6 | 35 s |

Rendimientos decrecientes: de 4 a 6 se gana ~10 %, a costa de ocupar también los núcleos de eficiencia. **4 workers** coincide con los 4 núcleos de rendimiento del M1 y deja margen para seguir trabajando.

### 3.4 `forks` frente a `threads` (2 workers)

`forks`: 66 s. `threads`: 60 s. `threads` arranca más barato; `forks` aísla mejor. La suite pasa completa con ambos.

### 3.5 Dónde queda el tiempo

Con los 4 workers, los 214 archivos suman 39 s de tiempo propio (≈ 10 s reales), y el resto es costo fijo por archivo más ~8 s de arranque de Vite. No hay archivos que dominen:

| Archivo | Tiempo |
|---|---|
| `Chat/Components/specs/ChatPanel.spec.tsx` | 1,8 s |
| `Chat/Components/specs/ChatHistoryDialog.spec.tsx` | 1,3 s |
| `Graph/Hooks/specs/useGraphStructure.spec.tsx` | 1,2 s |
| `Inspector/Components/specs/InspectorPanel.spec.tsx` | 1,2 s |

Los 10 más lentos suman el 27 % del total y 173 de 214 archivos tardan menos de 400 ms. **Optimizar archivos sueltos no compensa.**

## 4. Cómo funcionan los workers de Vitest

> Descripción basada en el diseño de Vitest 2 y `tinypool`. No se verificó observando los procesos.

- El proceso principal de `vitest run` reparte los archivos de test en una cola y crea workers según haga falta, hasta `maxThreads` (aquí, 4).
- Con `isolate: true` (el valor por defecto) cada archivo corre en un worker **nuevo**: se crea, ejecuta un archivo y se descarta. De ahí el costo fijo por archivo (`environment` y `setup`).
- Al terminar la corrida, el proceso principal cierra el pool y sale; **no quedan workers vivos**. En modo `watch` sí permanecen entre cambios y los inactivos se apagan tras un tiempo.
- `forks` usa procesos separados (más aislamiento); `threads` usa hilos del mismo proceso (arranque más barato).

## 5. Configuración resultante

`vitest.config.ts` (fragmento):

```ts
environment: 'jsdom',
environmentMatchGlobs: [['src/**/*.spec.ts', 'node']],
pool: 'threads',
poolOptions: { threads: { minThreads: 1, maxThreads: 4 } },
```

Variable de entorno y opciones de `verify.sh`:

| Opción | Efecto |
|---|---|
| `VERIFY_TEST_WORKERS=N` | Sobrescribe los 4 workers de la configuración (solo en `verify.sh`) |
| `--changed` | `test` corre solo los specs afectados |
| `--log-dir <dir>` | Carpeta de logs (por defecto `.opencode/runs/_verify`) |

## 6. Errores encontrados y cómo se resolvieron

| Problema | Causa | Solución |
|---|---|---|
| `pnpm test --poolOptions…` falla con «Unknown options» | pnpm interpreta esos flags como propios | `verify.sh` llama a `pnpm exec vitest run …` |
| `minThreads and maxThreads must not conflict` | Con solo `maxThreads=2`, el mínimo por defecto lo supera | Fijar siempre `minThreads: 1` junto a `maxThreads` |
| `pnpm tsc`: `jest-dom/types/index.d.ts is not a module` | `import('@testing-library/jest-dom')` dinámico no tiene tipos de módulo | Usar `@testing-library/jest-dom/vitest` |
| `prefersReducedMotion.spec.ts` falla en `node` | Lee `window.matchMedia` | `// @vitest-environment jsdom` |
| `sed -i` con comillas simples falla en macOS | Sintaxis de `sed` de BSD | Usar la herramienta de edición |

## 7. Qué NO se hizo y por qué

| Descartado | Ganancia estimada | Motivo |
|---|---|---|
| `happy-dom` en lugar de `jsdom` | ~4–6 s | Riesgo medio: Radix, `userEvent` y los polyfills de punteros pueden comportarse distinto en 129 specs `.tsx` |
| `isolate: false` (solo en specs `node`) | ~2–4 s | Riesgo medio: el estado de módulo se compartiría entre archivos; la suite usa `vi.stubGlobal` y mocks |
| 6 u 8 workers | ~4 s | Satura también los núcleos de eficiencia; la máquina se nota lenta mientras se trabaja |

Las ganancias son **estimaciones**, no mediciones.

## 8. Convención para quien escribe specs

- Un `.spec.ts` corre en `node`. Si usa `document`, `window` o `localStorage`, debe empezar con `// @vitest-environment jsdom`; si no, falla con un error poco claro (`window is not defined`).
- Un `.spec.tsx` sigue corriendo en `jsdom`.
- Nuevos specs con Radix: ver `src/test/radix.ts` y `AGENTS.md`.

## 9. Cómo reproducir

```bash
# Verificación completa y tiempo total
time .opencode/scripts/bash/verify.sh

# Tests con N workers (cambia N)
pnpm exec vitest run --pool=threads \
  --poolOptions.threads.maxThreads=N --poolOptions.threads.minThreads=1

# Archivos más lentos
pnpm exec vitest run --reporter=json --outputFile=/tmp/vt-report.json

# Cachés frías
rm -rf node_modules/.cache/eslint node_modules/.cache/tsc
```

## 10. Mapa de archivos

| Archivo | Cambio |
|---|---|
| `.opencode/scripts/bash/verify.sh` | Paralelo, `--changed`, `VERIFY_TEST_WORKERS`, `build` sin `tsc` duplicado |
| `.opencode/agents/sddorch.md` | Tras cada ola: `verify.sh --changed tsc test` |
| `vitest.config.ts` | Entorno `node` para `.spec.ts`, pool `threads`, 4 workers |
| `src/test/setup.ts` | DOM cargado solo con jsdom |
| `package.json` | `lint` con `--cache` |
| `tsconfig.json` | `incremental` y `tsBuildInfoFile` |
| 4 specs | `// @vitest-environment jsdom` |
