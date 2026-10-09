# Contracts — Filas paralelas correctas en el grafo en vivo

Contratos de interfaz que esta feature precisa. Como es una app de solo frontend cuya "interfaz pública" es la **UI** y cuyos contratos internos son **hooks y funciones puras**, los documentos describen: la semántica del intervalo de ejecución y el agrupamiento en filas, y el mantenimiento en vivo de la marca de actividad. Todos son verificables con tests puros, tests de hooks (`renderWithProviders`/`QueryClientProvider`) y tests de reducer.

| Documento | Cubre | FR / SC |
|-----------|-------|---------|
| [execution-lanes-contract.md](./execution-lanes-contract.md) | Intervalo de ejecución (abierto/terminado), agrupamiento por solape, clave de ejecución y recálculo, paridad filas↔badge. | FR-001..FR-008, FR-010, FR-011 · SC-001..SC-005 |
| [session-activity-contract.md](./session-activity-contract.md) | Mapa de actividad (`sessions.activity()`), cobertura de eventos, `max` acumulado, integración sin red, frescura. | FR-009 · SC-002, SC-005 |

No hay contratos de API/endpoints nuevos: la feature **no** consume ni expone interfaces de red nuevas; reutiliza los endpoints de lectura existentes a través de `opencodeService` (Principio III) y los eventos SSE ya procesados por `EventStreamProvider`. El "contrato externo" observable es la disposición en filas del grafo en vivo, idéntica a la reconstruida al reabrir la sesión.
