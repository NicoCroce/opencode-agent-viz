# Contrato — Skills cargadas en el Inspector (E5)

**Feature**: `011-fix-session-roots-subtree`
**Cubre**: FR-009, FR-010 · US6 · SC-007
**Implementa**: `Domains/Inspector/lib/deriveSkills.ts` (**nuevo**),
`Domains/Inspector/lib/deriveResources.ts`, `Domains/Inspector/InspectorResources.entity.ts`,
`Domains/Inspector/Components/ResourceList.tsx`, `Domains/Inspector/Hooks/useInspectorData.ts`,
`Application/Components/Molecules/ResourceRow.tsx`.

---

## 1. Derivación pura

```ts
// Domains/Inspector/lib/deriveSkills.ts
export interface TSkillUsage {
  name: string;
  count: number;
  estTokens: number | null;
  firstLoadedAt: number;
}

export const deriveSkills: (messages: TSessionMessage[]) => TSkillUsage[];
```

- Recorre las partes `tool` con `name: 'skill'`.
- Nombre: `input.name` **o** `input.id` (ambas claves se usan en los datos; con una sola se perderían casos como `{ 'id': 'commit-conventions' }`).
- `estTokens` = caracteres totales de `content[].text` ÷ 4 (orden de magnitud); `null` si no hay texto.
- `count` = repeticiones; `firstLoadedAt` = `time.created` más bajo.
- `state.status === 'error'` (p. ej. denegada por permisos) se **excluye** y no cuenta como cargada.

## 2. Proyección y entidad

- `TResourceUsage.skills` pasa de `{ name: string }[]` a `TSkillUsage[]`.
- `deriveResources` recibe las skills **ya derivadas** (no en render) y las propaga; `useInspectorData` pasa los mensajes.
- Se memoiza con el resto de los derivados.

## 3. UI (FR-010)

- `ResourceRow` se extiende a `items: { label: string; note?: string }[]`: con `note` pinta `label · note`; **sin** `note` mantiene el chip "disponible" actual (MCP/Instructions/Tools intactos).
- Copy: `frontend-design · ~3.4k tokens` (`.tabular-nums`); `estTokens` desconocido → solo el nombre, **sin inventar número**.
- La estimación es **aproximada**: nunca se presenta como coste real; `aria-label` deletrea "aproximadamente" (el `~` no es la única señal semántica).
- Vacío → **"Sin skills cargadas"** (hoy "Sin skills configuradas"). Tools dicen "usadas"; Skills dicen "cargadas".
- Una sesión que solo cargó skills (sin otras secciones con contenido) **no** oculta la sección.

## 4. Criterios de aceptación

| # | Criterio | Cómo se valida |
|---|---|---|
| I1 | Skill con `input.name` y con `input.id` | spec puro `deriveSkills.spec.ts` |
| I2 | Skill repetida → `count` refleja las repeticiones | spec puro |
| I3 | Skill con `state.status === 'error'` → no cuenta | spec puro |
| I4 | Sin skills → "Sin skills cargadas" visible (sección no vacía genérica) | `ResourceList.spec.tsx` con datos reales (hoy solo el vacío) |
| I5 | `nombre · ~N tokens` rotulado como aproximado | `ResourceList.spec.tsx` |
| I6 | MCP/Instructions/Tools sin cambios (chips "disponible") | specs existentes de `ResourceRow`/`ResourceList` |
