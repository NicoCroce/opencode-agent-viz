# Quickstart & Validation — OpenCode Agent Viz (Observabilidad Multi-Agente)

Guía para validar la feature de punta a punta. Los detalles de contrato están en
[contracts/](./contracts/) y el modelo de datos en [data-model.md](./data-model.md).

## Prerrequisitos

- Node/pnpm instalados; dependencias: `pnpm install`.
- Un servidor local de OpenCode disponible en `http://127.0.0.1:4096` (el proxy Vite mapea `/oc`).
- Una ejecución de referencia `develop → implement` que incluya al menos un subagente.
- Fixture de eventos real grabado (R1):

```bash
mkdir -p src/Domains/Graph/lib/__fixtures__
curl -N http://127.0.0.1:4096/event > src/Domains/Graph/lib/__fixtures__/run.ndjson
```

## Comandos

```bash
pnpm install
pnpm dev          # levanta Vite con proxy /oc → 127.0.0.1:4096
pnpm tsc          # typecheck estricto
pnpm lint         # ESLint strict
pnpm test         # Vitest (unit + hooks con renderWithProviders)
```

## Escenarios de validación

### V1 — Conexión (US1, FR-001, FR-018, SC-003)

1. `pnpm dev` con el servidor arriba → el indicador muestra **"Conectado"** de forma persistente.
2. Detén el servidor → el indicador pasa a **"Desconectado"** sin bloquear la UI.
3. Reinicia el servidor → **"Reconectando"** y luego **"Conectado"**; el grafo vuelve a coincidir con el estado del servidor.
**Esperado**: el estado de conexión es siempre visible; tras reconectar, grafo == servidor.

### V2 — Sesiones (US2, FR-002/003)

1. Con una sesión raíz creada, abre el visor → aparece listada con agente, título, estado y hora.
2. Selecciona otra sesión → queda activa; la más reciente se activa por defecto.
3. Sin sesiones → se ve un estado vacío explicativo (no pantalla en blanco).

### V3 — Grafo en vivo (US3, FR-004/005, SC-001/002)

1. Lanza una ejecución con un subagente → su nodo aparece conectado a su padre en **< 1s**.
2. Observa cambios de estado → el nodo cambia de color de franja sin recargar.
3. Con ~50 nodos y ~1000 partes, la interacción sigue fluida y las posiciones **no** se reordenan al cambiar solo el estado.

### V4 — Inspector y métricas (US4, US5, US6, FR-006..FR-009, SC-004/005/007)

1. Selecciona un nodo terminado → muestra agente, modelo, **duración**, **tokens** (entrada/salida/razonamiento/caché) y **costo**.
2. Durante la ejecución, la duración avanza en vivo y se fija al terminar.
3. Compara contra los valores del servidor → coinciden.
4. Un nodo sin datos de costo/tokens muestra **"no disponible"** (`—`), nunca `0`.
5. Identifica al agente más lento y al más costoso en **< 5s**.

### V5 — Invocaciones y loops (US7, FR-010/011, SC-006)

1. Un agente invocado varias veces muestra su **conteo de invocaciones**.
2. Provoca un reintento del proveedor → el nodo se marca **"Posible loop"** en segundos, con el número de reintentos.
3. El detalle lista la evidencia (mensajes del proveedor).
4. Un simple conteo alto de invocaciones **no** marca loop (solo los reintentos).

### V6 — Recursos (US8, FR-012)

1. Con al menos un MCP configurado y un archivo de instrucciones → el inspector los lista etiquetados como **"disponible"**.
2. Ningún recurso se etiqueta como "usado".
3. Sin recursos configurados → estado vacío explicativo.

### V7 — Seguir y permisos (US9, US10, FR-013/014)

1. Activa "seguir" durante una ejecución → la vista se centra en el nodo activo; al desactivarlo, deja de recentrar.
2. Provoca un permiso → el nodo se resalta como **"waiting"**; al resolverse, el resalte desaparece.

### V8 — Diseño Dark / Flat (FR-015, SC-008)

1. La app arranca en **modo oscuro** (clase `dark`).
2. No hay sombras ni gradientes decorativos; la profundidad es por borde/superficie.
3. Textos y estados clave tienen contraste legible (objetivo WCAG AA).
4. En viewport móvil, la misma lógica se presenta en tabs (Sessions | Graph | Inspector), sin duplicar componentes.

## Tests automáticos esperados

- `buildGraph.spec.ts` — topología padre→hijo, atribución de agente, estabilidad.
- `layoutGraph.spec.ts` — posiciones estables ante cambios de solo-estado.
- `deriveMetrics.spec.ts` — duración/costo/tokens/invocaciones/retry con fixture `run.ndjson` y casos `null`.
- `eventReducer.spec.ts` — mapeo evento→update y reconciliación.
- Helpers `formatDuration/formatCost/formatTokens.spec.ts` — formato y caso `null` → `"—"`.
- Hooks con `renderWithProviders` — `useGraphModel`, `useConnectionStatus`, `useInspectorData`.

## Criterio de "listo"

Todos los escenarios V1–V8 se cumplen, `pnpm tsc`, `pnpm lint` y `pnpm test` pasan, y las SC-001..SC-009 de [spec.md](./spec.md) son verificables.
