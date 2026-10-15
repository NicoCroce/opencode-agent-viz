# Contrato — Panel de contexto en el detalle

**Feature**: `010-context-metrics-insights`
**Cubre**: FR-011, FR-014, FR-015..FR-017 · SC-004, SC-005, SC-007
**Implementa**: `Domains/Inspector/Components/ContextSection.tsx`, `ContextCompositionBar.tsx`, `ParallelismSection.tsx`,
`LatencySection.tsx`, `Domains/Inspector/Hooks/useContextMetrics.ts`, `Domains/Graph/Components/AgentNodeFooter.tsx` (in/out),
`Domains/Graph/Components/SessionSummaryBar.tsx`.

---

## 1. Hook orquestador

```ts
// Domains/Inspector/Hooks/useContextMetrics.ts
export interface ContextMetricsData {
  context: TNodeContextMetrics | null;   // del nodo (ya derivado en el grafo)
  parentImpact: TParentImpact | null;    // bajo demanda (R5)
  compactionEffect: TCompactionEffect | null; // efecto de la última compactación (FR-016)
  usage: TContextUsage | null;           // ventana frente a `limit.context` del modelo (catálogo)
  compactionLoop: TCompactionLoop | null; // racha de compactaciones casi seguidas (§2.1)
  parentId: string | null;
  isLoading: boolean;
  isError: boolean;
}

export const useContextMetrics = (
  node: TGraphNode | null,
  invokedBy: TGraphNode | null,
): ContextMetricsData;
```

- Toda la lógica vive en el hook; los componentes son presentación pura (AGENTS §4).
- `parentImpact` se calcula con los mensajes del padre (`useSessionMessages(parentId)`); no se recalcula en el grafo.
- `compactionEffect` se deriva de `context.growth`/`context.compactions` con `deriveCompactionEffect` (context-metrics-contract §2bis).
- `usage` cruza el modelo del nodo con el catálogo de su directorio (`findContextLimit`); es `null` si el catálogo no carga o no trae el modelo.
- `compactionLoop` sale de `detectCompactionLoop(context.growth, context.compactions)` (§2.1).

## 2. Sección Contexto (FR-015, FR-016)

Se compone en `InspectorPanel` entre **Métricas** y **Recursos**, con un solo bloque `ContextSection`:

| Apartado | Dato | FR |
|---|---|---|
| Composición | `ContextCompositionBar` + leyenda (categoría, `%`, valor absoluto) | FR-001..FR-005 |
| Ventana | entrada (ventana), caché read/write, **tasa de acierto** | FR-016 |
| Evolución | ventana por paso, con compactaciones y límite del modelo (§2.1) | FR-016 |
| Salida | output, reasoning y su relación | FR-016 |
| Compactaciones | número, efecto sobre el contexto y aviso de bucle (§2.1) | FR-016 |
| Aporte al padre | `TParentImpact` + navegación al padre | FR-012..FR-014 |
| Coste | coste por 1k tokens de contexto | FR-016 |

`ContextSection` recibe `context`, `tokens` (salida y razonamiento), `compactionEffect`, `usage` y `compactionLoop`; otras historias (paralelismo, aporte al padre, latencia) montan sus apartados vía `children`.

### 2.1 Evolución del contexto y bucle de compactación (revisión)

> **Revisión.** La sparkline original escalaba el eje Y del mínimo al máximo de la serie y animaba
> el trazo con `stroke-dasharray` + `pathLength`. Con `vector-effect: non-scaling-stroke` y
> `preserveAspectRatio="none"`, el guion se medía antes de estirar el SVG y la línea aparecía cortada
> (trazo, hueco, trazo). Además no mostraba las compactaciones, y un bucle de 238 compactaciones
> seguidas pasó inadvertido.

- **Geometría** (`Inspector/lib/contextGrowthChart.ts`, `buildGrowthChart`): eje X con los pasos
  repartidos en partes iguales; eje Y de **0** al mayor entre la ventana máxima y `usage.limitTokens`.
  Con límite conocido se dibuja una línea punteada a esa altura.
- **Compactaciones**: una muesca vertical por episodio, entre el último paso anterior y el primero
  posterior (en los bordes si cae fuera de la serie). Las `failed` usan el color de error.
- **Aparición**: un recorte (`clip-path: inset`) que se abre de izquierda a derecha (`.growth-reveal`);
  sin animación con `prefers-reduced-motion`. El trazo no usa guiones.
- **Alto**: 48 px.
- **Resumen** (texto visible y `aria-label` del `role="img"`): primera y última ventana, pasos,
  compactaciones (si hay) y límite (si se conoce).
- **Bucle** (`Inspector/lib/compactionLoop.ts`, `detectCompactionLoop`): la racha más larga de
  compactaciones separadas por `LOOP_MAX_GAP_STEPS = 2` pasos o menos. Con `LOOP_MIN_COMPACTIONS = 3` o
  más, `ContextSection` muestra un `Alert` `warning` con `role="status"`: «Posible bucle de
  compactación · N compactaciones en M pasos: compactar no libera contexto».

## 3. Sección Paralelismo (FR-009)

Visible cuando el nodo participa de un grupo (`speedup !== null`): tamaño, tiempo en serie, tiempo real, aceleración y eficiencia. `provisional` se etiqueta.

## 4. Sección Latencia (FR-019, FR-023)

Reparto del tiempo del nodo (modelo, herramientas, subagentes y usuario), ritmo esperado de cada
modelo, umbral de lentitud, respuestas con su desglose y lista de respuestas lentas con magnitud
(`ratio`), exceso (`excessMs`) y lo esperado (`expectedMs`). Detalle en
`latency-anomaly-contract.md` §6, que reemplaza la serie contra la mediana del nodo/agente.

> **Superseded (`014-inspector-detail-tabs`, FR-010).** El desplegable "Avanzado" ya no existe: el
> listado de respuestas medidas y el de anomalías se montan en la **pestaña Latencia** del tablist de
> secciones técnicas del detalle. Contrato vigente:
> `specs/014-inspector-detail-tabs/contracts/inspector-section-tabs-contract.md` (§1, §5).

## 5. In/out en el nodo (FR-011)

`AgentNodeFooter` añade una línea compacta `contexto: 12.4k ↓ · 1.2k ↑` (entrada = ventana del nodo; salida = `output + reasoning`), en el registro monoespaciado existente y sin añadir filas a `cardHeight` (se reutiliza una fila existente o se ajusta la constante).

## 6. Estados de pantalla (FR-017, SC-007)

Cada apartado y la sección completa representan explícitamente: **error** (`EmptyScreenError`), **cargando** (skeleton del dominio), **vacío** ("sin datos de contexto", nunca ceros) y **datos**. Si `context === null` y `isLoading`, skeleton; si no hay contexto tras cargar, estado vacío.

## 7. Accesibilidad y presentación (SC-007)

- Composición: barra apilada **con leyenda y valores textuales**; la información no depende solo del color.
- Anomalía y provisionalidad: **etiqueta textual** además del color.
- Navegación al padre: control operable por teclado con `aria-label` ("Ir al agente padre: <título>").
- `prefers-reduced-motion` respetado en el gráfico de evolución (§2.1).
- Compactaciones y límite del gráfico repetidos en texto; el aviso de bucle es un `role="status"`.
- Mobile: doble presentación con `useDevice` (AGENTS §9); sin `md:hidden`.

## 8. Validación

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| S1 | La sección Contexto lista todos los apartados de §2 | spec de `ContextSection` |
| S2 | Composición muestra leyenda con `%` y absolutos y suma 100% | spec de `ContextCompositionBar` |
| S3 | Cada apartado tiene los 4 estados | spec de `ContextSection` |
| S4 | El aporte al padre navega al nodo padre | spec de `useContextMetrics`/`ContextSection` |
| S5 | Sección Paralelismo visible solo con grupo y con etiqueta provisional | spec de `ParallelismSection` |
| S6 | Latencia muestra el desglose y lista las respuestas lentas con magnitud y lo esperado | spec de `LatencySection` |
| S7 | El footer del nodo muestra in/out sin romper `cardHeight` | spec `AgentNodeFooter`/`cardHeight` |
| S8 | Control de padre accesible por teclado | spec a11y |
| S9 | La evolución marca compactaciones y límite, y la sección avisa de un bucle | specs de `buildGrowthChart`, `detectCompactionLoop`, `ContextGrowth` y `ContextSection` |
