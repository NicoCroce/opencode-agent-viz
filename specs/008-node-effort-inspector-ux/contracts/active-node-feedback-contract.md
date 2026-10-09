# Contrato — Señal de nodo activo y follow al más reciente

**Feature**: `008-node-effort-inspector-ux`
**Cubre**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009 · SC-001, SC-003, SC-007
**Implementa**: `Domains/Graph/Components/NodeStatusRail.tsx`, `Domains/Graph/Components/AgentNodeHeader.tsx`,
`Domains/Graph/lib/activeNode.ts`, `Domains/Graph/Hooks/useGraphModel.ts`, `Domains/Graph/Hooks/useFollowMode.ts`,
`Domains/Graph/Components/ViewportControllers.tsx`, `src/index.css`.

---

## 1. Animación "pensando" (FR-001..FR-004, SC-001)

- **Superficie**: el `NodeStatusRail` de 3 px (no se añaden filas ni altura).
- **Clase**: `.rail-scan` (barrido de brillo `@keyframes rail-scan`) aplicada **solo** cuando el nodo está activo y **no** está rayado por loop/reintento.
- **Activo**: `isActiveStatus(status)` ∈ {`running`, `retrying`, `compacting`, `waiting-permission`, `waiting-input`}.
- **Terminal**: la clase se retira al cambiar a `created`/`succeeded`/`failed`/`interrupted` → la animación se detiene (FR-002/FR-004).
- **Se retira** el `animate-pulse` del punto de `AgentNodeHeader` (deja de ser la señal principal).
- **Movimiento reducido (FR-003)**: con `prefers-reduced-motion: reduce` el bloque global anula animaciones y el rail queda en **color de actividad sólido y estático**.
- **Sin estado por nodo**: la animación es declarativa; no hay JS por frame (SC-006).

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| A1 | Un nodo activo renderiza el rail con `.rail-scan` | spec de componente `AgentNode`/`NodeStatusRail` |
| A2 | Un nodo terminal no renderiza `.rail-scan` | spec de componente |
| A3 | El estado estático (sin animación) está definido para reduced-motion | revisión + spec de clase base |
| A4 | La señal no añade filas ni cambia `cardHeight` | spec de `cardHeight` |

## 2. Nodo activo más reciente (FR-005, SC-003)

```ts
// Domains/Graph/lib/activeNode.ts (puro)
export const latestActiveNodeId = (model: TGraphModel): string | null;
```

- Devuelve el `id` del nodo `isActiveStatus` con **mayor `activityStartOf(node) = metrics.startedAt ?? createdAt ?? 0`** (hora de inicio de ejecución; la creación de la sesión es solo el último recurso); desempate determinista por `id`. **No reutiliza** el `startOf` de `lib/execution/nodeInterval.ts` (precedencia inversa `createdAt ?? metrics.startedAt`): es un helper propio.
- `null` si no hay nodos activos.
- Se **añade** a `UseGraphModelResult` como `latestActiveNodeId` (additivo; `activeNodeId` se conserva).
- `WorkspacePage` pasa `latestActiveNodeId` a `useFollowMode` (firma sin cambios).

## 3. Seguimiento (FR-006..FR-009)

- `useFollowMode(id)` → `followNodeId = enabled ? id : null` (sin cambios de firma).
- `FollowController` centra el viewport en el nodo seguido; si el nodo ya no existe, `getNode` → `null` → **no mueve**.
- **Invariantes**:
  1. **Cambio de activo** (FR-006): cuando cambia `latestActiveNodeId`, el viewport se recentra sin reposicionar el resto del grafo (solo mueve la cámara).
  2. **Sin activos** (FR-007): `latestActiveNodeId === null` → sin movimiento.
  3. **Reactivar** (FR-008): al pasar `enabled` de `false` a `true`, se enfoca el `latestActiveNodeId` vigente.
  4. **Eventos sin cambio de activo** (FR-009): `followNodeId` es un `string`; si el id no cambia, el `useEffect` no se dispara → sin reposicionamiento ni "temblor".

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| E1 | `latestActiveNodeId` elige el de mayor `startOf` entre varios activos | spec puro `activeNode.spec.ts` |
| E2 | `null` sin activos | spec puro |
| E3 | El follow se dispara al cambiar el id seguido y no con el mismo id | spec de hook `useFollowMode.spec.tsx` extendido |
| E4 | Reactivar enfoca el activo más reciente actual | spec de hook |
| E5 | Nodo enfocado desaparecido → sin error ni vista fuera de sitio | spec de `FollowController` (o revisión) |

## 4. Accesibilidad (SC-007)

- La animación es decorativa: el rail lleva `aria-hidden`; la información de actividad está en la etiqueta de estado textual (`NODE_STATUS_LABEL`) y no depende del movimiento.
