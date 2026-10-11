# Contracts — Chat interactivo por sesión

Contratos de interfaz que esta feature precisa. Es una app de solo frontend cuya "interfaz pública" observable es la **UI**; sus contratos internos son **services, hooks, funciones puras y esquemas Zod**. Los documentos describen: la fachada de escritura, el buffer de streaming, la señal de atención, el panel/pestañas del chat y el endurecimiento del dev server. Todos son verificables con tests puros, de hooks (`renderWithProviders`) y de componentes.

| Documento | Cubre | FR / SC |
|-----------|-------|---------|
| [write-facade-contract.md](./write-facade-contract.md) | Fachada de escritura hermana (`prompt`/`interrupt`/`form.reply`/`permission.reply`/`switch*`), validación Zod, origen del pendiente y errores. | FR-001, FR-004, FR-005, FR-006, FR-007, FR-019, FR-020, FR-022, FR-023 |
| [chat-stream-contract.md](./chat-stream-contract.md) | Buffer de deltas en `['chatStream', id]`, proyección del timeline, dedupe, texto plano vs `RichText` y no-relayout. | FR-002, FR-003, FR-016 · SC-003, SC-004 |
| [attention-contract.md](./attention-contract.md) | Derivación de pendientes del subárbol, las cinco señales, navegación a la request y limpieza. | FR-007, FR-009, FR-010, FR-011 · SC-005 |
| [chat-panel-contract.md](./chat-panel-contract.md) | Pestañas Detalle\|Chat, tab de primer nivel en móvil, estados de pantalla, borrador y accesibilidad. | FR-008, FR-012, FR-013, FR-014, FR-015, FR-021 · SC-006, SC-007, SC-008 |
| [dev-server-hardening-contract.md](./dev-server-hardening-contract.md) | Bind loopback y validación Origin/Referer en el proxy y en `start.sh`. | FR-018 |

No hay contratos de API/endpoints nuevos: la feature **no** consume ni expone interfaces de red nuevas; reutiliza el proxy `/oc` sobre el servidor existente y **empieza a usar** los métodos de escritura del SDK V2 (`session.prompt`, `session.interrupt`, `session.form.reply`, `permission.reply`, `session.switchAgent`, `session.switchModel`) y de catálogo (`model.list`, `agent.list`) a través de las fachadas de `Infrastructure/Services` (Principio III). No altera el contrato de `opencodeService` ni el stream SSE.
