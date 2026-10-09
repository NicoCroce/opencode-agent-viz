---
name: code-reviewer
description: Checklist de revisión de código del visor, alineada con la constitución (principios I-VIII), AGENTS.md y app.instructions.md. Usar al revisar cambios de una feature.
---

# Code Reviewer

Revisa solo los archivos modificados (`git diff --name-only <base>...HEAD`). `pnpm tsc`, `pnpm lint` y `pnpm test` los ejecuta la verificación; no los repitas.

## Checklist

🔴 = crítico (un fallo → `REJECTED`). 🟡 = recomendado (va a deuda técnica, no bloquea).

Chequeos mecánicos primero, con un solo `grep` sobre los archivos modificados: `: any\b|as any|<any>` (ítem 4) y `console\.` (ítem 9).

**Constitución y arquitectura**
1. 🔴 Observador de solo lectura: sin llamadas de escritura al servidor de OpenCode (I).
2. 🔴 Estructura por dominios; un componente no importa `@app/Domains/<OtroDominio>`; el cruce se hace en el hook (II).
3. 🔴 Los datos del servidor pasan solo por TanStack Query; ninguna llamada al SDK fuera de `*.service.ts` / `opencodeService` (III).
4. 🔴 Sin `any` explícito.
5. 🔴 Tipos derivados de `@opencode/client` con prefijo `T`; sin interfaces manuales que dupliquen el SDK (IV).
6. 🔴 La lógica vive en hooks o funciones puras, no en componentes ni páginas (V).
7. 🟡 Query keys en `src/Domains/queryKeys.ts`; sin claves inline.
8. 🔴 Sin magic strings; constantes extraídas.
9. 🟡 Sin `console.*` en código productivo.
10. 🔴 Naming según `app.instructions.md` (`T[Entity]`, `useGet[Entities]`, `[Entity][Action].page.tsx`, `[ENTITY]_[ACTION]_ROUTE`, `[Domain]Router`).
11. 🟡 El barrel `index.ts` no reexporta implementaciones privadas.

**Pantallas y UI** (VI)
12. 🔴 Pantallas con datos: `isError` → `EmptyScreenError`, `isLoading` → skeleton, vacío → `EmptyScreenFilter` / `EmptyState`, datos.
13. 🔴 Sin texto suelto para estados (`Cargando`, `<p>`) ni fallbacks inalcanzables.
14. 🔴 Botones que disparan mutations usan `isLoading={isPending}`.
15. 🔴 Páginas envueltas en `Page`; layout con `Container`, sin `div` + `flex`.
16. 🔴 Sin `md:hidden` / `hidden md:block`; se usa `useDevice()`.
17. 🟡 Skeletons y empty states en `Components/` del dominio.

**Rendimiento** (VII)
18. 🔴 Los eventos SSE se procesan por lotes y sin re-renders innecesarios; sin suscripciones SSE adicionales fuera de `EventStreamProvider`.

**Repositorio y tests** (VIII)
19. 🔴 Los tests están en `specs/` junto al código, no mezclados.
20. 🔴 La lógica pura nueva tiene tests con datos concretos.
21. 🔴 Commits siguen la skill `commit-conventions`.

Rechaza solo por incumplimientos de estándares documentados, nunca por estilo personal.

## Formato de salida

```markdown
# Revisión — <título>

Resultado: APPROVED | REJECTED · ítems revisados: <n> · 🔴 fallidos: <lista o "ninguno">

## Feedback (solo si REJECTED; uno por ítem 🔴 fallido)
- Ítem <n> — `<archivo>:<línea>`: <problema>. Esperado: <cambio concreto>.

## Deuda técnica (solo si hay 🟡 fallidos)
- <ítem>: <detalle>
```

Devuelve este resultado como respuesta; no lo escribas en un archivo.
