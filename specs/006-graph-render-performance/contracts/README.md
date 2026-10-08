# Contracts — Rendimiento del visualizador de grafo

Contratos de interfaz que esta feature expone. Como es una app de solo frontend cuya
"interfaz pública" es la **UI** y cuyos contratos internos son **hooks y funciones puras**,
los documentos describen: la estabilidad de identidad que ve React Flow, el modelo de carga
progresiva y el contrato de instrumentación. Todos son verificables con tests de Testing
Library, tests de hooks (con `renderWithProviders`) y tests puros.

| Documento | Cubre | FR / SC |
|-----------|-------|---------|
| [graph-render-contract.md](./graph-render-contract.md) | Identidad estable de nodos/aristas, foco/hover por contexto, altura calculada una vez, invariante de paridad. | FR-005, FR-007, SC-004, SC-006 |
| [graph-loading-contract.md](./graph-loading-contract.md) | Modelo por fases, orden de prioridad, lotes, cancelación, revisita desde caché. | FR-001..FR-004, FR-008..FR-010, SC-002, SC-003, SC-007, SC-008 |
| [performance-instrumentation-contract.md](./performance-instrumentation-contract.md) | Marcas y medidas `graph.session.open`/`revisit`/`interaction`. | FR-011, SC-001..SC-004 |

No hay contratos de API/endpoints nuevos: la feature **no** consume ni expone interfaces de red
nuevas; reutiliza los endpoints de lectura existentes a través de `opencodeService` (Principio III).
El "contrato externo" observable es la Performance API (`performance.mark/measure`), documentado
para permitir la captura de línea base antes/después.
