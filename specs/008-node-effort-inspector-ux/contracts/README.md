# Contracts — Live Node Feedback, Effort Levels & Detail Panel UX

Contratos de interfaz que esta feature precisa. Es una app de solo frontend cuya "interfaz pública" es la **UI** y cuyos contratos internos son **hooks y funciones puras**. Los documentos describen: la señal de nodo activo y el follow, la derivación de los 5 niveles de esfuerzo, la disposición del panel de detalle (resize/fullscreen) y el parser/render del diff. Todos son verificables con tests puros, tests de hooks (`renderWithProviders`) y tests de componentes.

| Documento | Cubre | FR / SC |
|-----------|-------|---------|
| [active-node-feedback-contract.md](./active-node-feedback-contract.md) | Animación "pensando" sobre el rail y selección del nodo activo más reciente para el follow. | FR-001..FR-009 · SC-001, SC-003, SC-007 |
| [effort-contract.md](./effort-contract.md) | Escala acumulativa de 5 niveles de esfuerzo, definición de "línea", provisionalidad, comparador y presentación accesible. | FR-021..FR-028 · SC-002, SC-006 |
| [inspector-panel-contract.md](./inspector-panel-contract.md) | Ancho redimensionable persistido, límites, fullscreen efímero y conservación de estados de pantalla. | FR-010..FR-015 · SC-005, SC-007 |
| [file-diff-contract.md](./file-diff-contract.md) | Parser de patch unificado, modelo de hunks/líneas, presentación por tipo y estado, casos límite. | FR-016..FR-020 · SC-004, SC-008 |

No hay contratos de API/endpoints nuevos: la feature **no** consume ni expone interfaces de red nuevas; reutiliza el endpoint de lectura de diff ya existente a través de `useSessionDiff`/`opencodeService` (Principio III) y no altera el stream SSE. El "contrato externo" observable son los seis comportamientos de UX descritos, medibles con las SC del [spec](./spec.md).
