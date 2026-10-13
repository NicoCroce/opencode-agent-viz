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

## 2. Sección Contexto (FR-015, FR-016)

Se compone en `InspectorPanel` entre **Métricas** y **Recursos**, con un solo bloque `ContextSection`:

| Apartado | Dato | FR |
|---|---|---|
| Composición | `ContextCompositionBar` + leyenda (categoría, `%`, valor absoluto) | FR-001..FR-005 |
| Ventana | entrada (ventana), caché read/write, **tasa de acierto** | FR-016 |
| Evolución | crecimiento del contexto por paso (sparkline) | FR-016 |
| Salida | output, reasoning y su relación | FR-016 |
| Compactaciones | número y efecto sobre el contexto | FR-016 |
| Aporte al padre | `TParentImpact` + navegación al padre | FR-012..FR-014 |
| Coste | coste por 1k tokens de contexto | FR-016 |

`ContextSection` recibe `context`, `tokens` (salida y razonamiento) y `compactionEffect`; otras historias (paralelismo, aporte al padre, latencia) montan sus apartados vía `children`.

## 3. Sección Paralelismo (FR-009)

Visible cuando el nodo participa de un grupo (`speedup !== null`): tamaño, tiempo en serie, tiempo real, aceleración y eficiencia. `provisional` se etiqueta.

## 4. Sección Latencia (FR-019, FR-023)

Serie de `ttftMs` y `totalMs`, mediana de referencia (nodo/agente) y lista de anomalías con magnitud (`ratio`), referencia (`referenceMs`) y origen (`reference`).

El listado de respuestas medidas y el de anomalías se montan **dentro del desplegable "Avanzado"** (`AdvancedSection`), después de Errores, para no saturar el panel principal. Al estar colapsado por defecto, no se montan en el DOM hasta expandir.

## 5. In/out en el nodo (FR-011)

`AgentNodeFooter` añade una línea compacta `contexto: 12.4k ↓ · 1.2k ↑` (entrada = ventana del nodo; salida = `output + reasoning`), en el registro monoespaciado existente y sin añadir filas a `cardHeight` (se reutiliza una fila existente o se ajusta la constante).

## 6. Estados de pantalla (FR-017, SC-007)

Cada apartado y la sección completa representan explícitamente: **error** (`EmptyScreenError`), **cargando** (skeleton del dominio), **vacío** ("sin datos de contexto", nunca ceros) y **datos**. Si `context === null` y `isLoading`, skeleton; si no hay contexto tras cargar, estado vacío.

## 7. Accesibilidad y presentación (SC-007)

- Composición: barra apilada **con leyenda y valores textuales**; la información no depende solo del color.
- Anomalía y provisionalidad: **etiqueta textual** además del color.
- Navegación al padre: control operable por teclado con `aria-label` ("Ir al agente padre: <título>").
- `prefers-reduced-motion` respetado en la sparkline.
- Mobile: doble presentación con `useDevice` (AGENTS §9); sin `md:hidden`.

## 8. Validación

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| S1 | La sección Contexto lista todos los apartados de §2 | spec de `ContextSection` |
| S2 | Composición muestra leyenda con `%` y absolutos y suma 100% | spec de `ContextCompositionBar` |
| S3 | Cada apartado tiene los 4 estados | spec de `ContextSection` |
| S4 | El aporte al padre navega al nodo padre | spec de `useContextMetrics`/`ContextSection` |
| S5 | Sección Paralelismo visible solo con grupo y con etiqueta provisional | spec de `ParallelismSection` |
| S6 | Latencia lista anomalías con magnitud y referencia | spec de `LatencySection` |
| S7 | El footer del nodo muestra in/out sin romper `cardHeight` | spec `AgentNodeFooter`/`cardHeight` |
| S8 | Control de padre accesible por teclado | spec a11y |
