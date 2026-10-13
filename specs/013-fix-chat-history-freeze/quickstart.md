# Quickstart — Validación de `013-fix-chat-history-freeze`

**Feature**: `013-fix-chat-history-freeze` | **Date**: 2026-10-13 | **Plan**: [plan.md](./plan.md)

Guía de validación reproducible. Prerrequisitos: dependencias instaladas
(`pnpm install`). Todos los comandos se ejecutan desde la raíz del repo.
Ver [data-model.md](./data-model.md) (invariantes) y
[contracts/attention-forms-subscription.md](./contracts/attention-forms-subscription.md).

## Escenario 0 — Estado previo (la prueba hoy cuelga)

Antes de aplicar la corrección, ejecutar la regresión:

```bash
pnpm test -- src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx
pnpm test -- src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx
```

**Esperado (pre-fix)**: la prueba de integración que abre el histórico de un nodo
`waiting-input` no termina (bucle de render: React "Maximum update depth
exceeded"); la unitaria falla por timeout corto. **Nada se corrige en este paso**:
sirve para constatar que la prueba captura el defecto (US4/FR-006).

> Nota de timeout: `vitest.config.ts` no fija `testTimeout` (por defecto 5 s), pero
> un bucle de render síncrono puede durar >3 min sin que el temporizador lo corte;
> por eso ambos specs declaran un `timeout` explícito y corto en el propio `it`.

## Escenario 1 — Corregir y validar la regresión (US1 + US4)

Aplicar la corrección en `src/Domains/Chat/Hooks/useSessionAttention.ts`
(filtro por clave exacta, identidad estable del índice, solo eventos de dato;
ver research R1–R3) y volver a ejecutar:

```bash
pnpm test -- src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx
pnpm test -- src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx
```

**Esperado (post-fix)**:
- La integración abre el histórico: `HistoryModalMarker` monta con
  `data-node = <sessionId>` y `data-question-count >= 1` (US1, US2).
- La unitaria converge, enriquece el ítem con el `FormInfo` cacheado y demuestra
  la identidad estable del índice ante una notificación sin cambio de dato
  (caso negativo, Principio VIII).

## Escenario 2 — El contenido del histórico no cambia (US2/FR-003)

```bash
pnpm test -- src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx \
  src/Infrastructure/specs/integration/workspaceHistoryData.integration.spec.tsx
```

**Esperado**: el enriquecimiento de preguntas (incluidas las de sesiones hijas)
conserva `id`/`title`/posición; el cableado del overlay (T022) sigue verde. Sin
diferencias de texto/etiqueta respecto de hoy.

## Escenario 3 — Sin regresiones (US3/FR-009)

```bash
pnpm test -- src/Domains/Chat/Hooks/specs
pnpm test -- src/Infrastructure/specs/WorkspacePage.spec.tsx \
  src/Infrastructure/specs/WorkspacePage.perf.spec.tsx \
  src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx \
  src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx
```

**Esperado**: `src/Domains/Chat/Hooks/specs/**` intacto y verde (los 5 specs
existentes) y las 4 suites protegidas de `012-refactor-workspace-enrichment`
intactas y verdes.

## Escenario 4 — Batería completa y estáticos (cierre)

```bash
pnpm test
pnpm tsc
pnpm tsc:node
pnpm lint
```

**Esperado**: batería completa verde (referencia del estado actual: 1976 pruebas),
sin regresiones; `tsc`, `tsc:node` y `lint` limpios.

## Criterios de aceptación cubiertos

| Escenario | US / FR | SC |
|---|---|---|
| 0–1 | US1, US4 / FR-001, FR-002, FR-006 | SC-001, SC-002, SC-005 |
| 2 | US2 / FR-003 | SC-003 |
| 3 | US3 / FR-004, FR-005, FR-009 | SC-004 |
| 4 | FR-009 | SC-005 |

## Fuera de esta guía

No se incluye código de implementación, cuerpos de servicio ni la suite completa:
eso pertenece a `tasks.md` (Phase 2) y a la fase de implementación.
