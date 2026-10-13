# Contratos — Raíces listables, subárbol completo y paralelismo por invocación

**Feature**: `011-fix-session-roots-subtree`
**Cubre**: FR-001…FR-016 · SC-001…SC-009

Contratos de interfaz de la feature (lógica pura, hooks y UI). Cada archivo fija
decisiones verificables con specs; el detalle de entidades está en
[../data-model.md](../data-model.md) y las decisiones en [../research.md](../research.md).

| Contrato | Cubre | Artefactos que implementa |
|---|---|---|
| [session-roots-contract.md](./session-roots-contract.md) | FR-001, FR-002, FR-003, FR-015 | `Services/lib/sessionPagination.ts`, `session.service.ts`, `queryKeys.ts`, `useRootSessions.ts`, `WorkspacePage.tsx` |
| [subtree-structure-contract.md](./subtree-structure-contract.md) | FR-004, FR-005, FR-006, FR-013 | `Graph/lib/loadPlan/subtree.ts`, `useGraphStructure.ts`, `useGraphModel.ts`, `GraphPane.tsx`, `GraphTruncationBanner.tsx` |
| [invocation-lanes-contract.md](./invocation-lanes-contract.md) | FR-007, FR-008, FR-011, FR-012, FR-014, FR-016 | `Graph/lib/invocations.ts`, `executionKey.ts`, `parallelism.ts`, `parallelByNode.ts` |
| [inspector-skills-contract.md](./inspector-skills-contract.md) | FR-009, FR-010 | `Inspector/lib/deriveSkills.ts`, `deriveResources.ts`, `ResourceList.tsx`, `ResourceRow.tsx` |

**Contratos de specs previas que esta feature actualiza** (entregable, no extra):

- `specs/006-graph-render-performance/contracts/graph-loading-contract.md` §1.1 — el origen estructural pasa a ser el subárbol (consultas estructurales de sesiones ≠ consultas de contenido).
- `specs/007-fix-parallel-lanes-live/contracts/execution-lanes-contract.md` §2/§6 — el agrupamiento pasa de sesión a invocación (paridad fila↔badge).

**Nota transversal (FR-008)**: la paridad exigida es **fila ↔ badge**; la **barra temporal del nodo** mantiene el intervalo de la sesión y su diferencia con la ventana de la invocación queda explícita en estos contratos. No se unifica en esta feature.
