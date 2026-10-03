# Contracts — OpenCode Agent Viz

Esta feature es una SPA de solo lectura; no expone una API pública. Sus "contratos" son las **interfaces internas estables** entre capas (Infrastructure ↔ Application ↔ Domains) y entre la lógica pura y la UI. Cualquier cambio incompatible en estos contratos es un cambio de contrato.

| Contrato | Archivo | Qué fija |
|----------|---------|----------|
| Servicio SDK | [sdk-service-contract.md](./sdk-service-contract.md) | Firma del wrapper `opencodeClient`, métodos permitidos, query keys y hooks de datos |
| Stream de eventos | [event-stream-contract.md](./event-stream-contract.md) | Mapeo evento→queryClient, batching y reconexión |
| Grafo | [graph-contract.md](./graph-contract.md) | `buildGraph()`, `layoutGraph()` y estabilidad de posiciones |
| Métricas e inspector | [metrics-contract.md](./metrics-contract.md) | `deriveMetrics()`, agregación y contrato de presentación de métricas/recursos |

Reglas transversales:
- El SDK se invoca **solo** desde `*.service.ts` (Constitución III).
- Los contratos de datos usan tipos `T` derivados del SDK (Constitución IV).
- Las funciones de `lib/` son puras y sin React (Constitución V).
