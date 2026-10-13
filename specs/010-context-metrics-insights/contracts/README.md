# Contracts — Context Composition, Parallel Speedup & Latency Insights

**Feature**: `010-context-metrics-insights`

Contratos de las interfaces internas (funciones puras y tipos de vista) que la feature introduce o modifica. Cada archivo fija firma, invariantes y criterios de validación.

| Contrato | Cubre | Archivos |
|---|---|---|
| [context-metrics-contract.md](./context-metrics-contract.md) | FR-001..FR-005, FR-011..FR-014, FR-015..FR-017 · SC-001, SC-002, SC-004, SC-005, SC-007 | `lib/metrics/contextBreakdown.ts`, `lib/metrics/windowStats.ts`, `lib/metrics/parentImpact.ts` |
| [parallel-speedup-contract.md](./parallel-speedup-contract.md) | FR-006..FR-010 · SC-003 | `lib/metrics/speedup.ts`, `lib/parallelism.ts`, `lib/metrics/summarizeSession.ts` |
| [latency-anomaly-contract.md](./latency-anomaly-contract.md) | FR-018..FR-023 · SC-006 | `lib/metrics/latency.ts`, `lib/metrics/anomalyThreshold.ts` |
| [context-panel-contract.md](./context-panel-contract.md) | FR-011, FR-015..FR-017 · SC-004, SC-005, SC-007 | `Domains/Inspector/Components/ContextSection.tsx`, `ParallelismSection.tsx`, `LatencySection.tsx`, `ContextCompositionBar.tsx`, `Hooks/useContextMetrics.ts` |

## Reglas transversales

1. **Solo lectura**: ninguna interfaz escribe en el servidor ni en el stream (Principio I).
2. **Puras y sin React**: las derivaciones de `lib/metrics/*` no importan React (Principio V).
3. **Tipos `T` de vista**: no se redefine ningún tipo del SDK (Principio IV).
4. **Reconciliación**: todo campo nuevo de `TGraphNodeData` entra en `sameNodeData` (AGENTS §11).
5. **Estados de pantalla**: los componentes del panel representan error → carga → vacío → datos (Principio VI).
