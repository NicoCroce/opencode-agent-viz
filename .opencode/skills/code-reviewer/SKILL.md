---
name: code-reviewer
description: Checklist de @blendverse-reviewer (arquitectura, tipado, seguridad multi-tenant, convenciones y estados de UI) y formato de 04_review_log.md.
---

# Skill: code-reviewer

Tsc, lint y ubicación de carpetas los valida `qa-report.sh`; no los revises. Revisá solo los `affected_files`.

## Checklist

🔴 = crítico (un fallo → `REJECTED`). 🟡 = recomendado (va a Deuda técnica, no bloquea).

Chequeos mecánicos primero (un solo `grep` sobre `affected_files`): `: any\b|as any|<any>` (ítem 4) y `console\.` (ítem 9).

**Backend / arquitectura**
1. 🔴 `Domain/` no importa de `Application/` ni `Infrastructure/`.
2. 🔴 Los use cases dependen de la interfaz del repositorio, no de la implementación.
3. 🔴 Dominio nuevo registrado en `register.ts` y `Router.ts`.
4. 🔴 Sin `any` explícito.
5. 🟡 Métodos públicos con tipo de retorno explícito.
6. 🔴 Entre capas solo se comparten interfaces/tipos, no clases concretas.
7. 🔴 Input validado con Zod (controller) o RHF + Zod (formulario).
8. 🔴 Toda query del repositorio filtra por `ownerId`/`id_propietario` (o usa `TenantAwareRepository`).
9. 🟡 Sin `console.*` en código productivo.
10. 🔴 Naming de clases, archivos y carpetas según `server.instructions.md` / `app.instructions.md`.
11. 🟡 La entidad expone `static create()`, `toJSON()` y `get values()`.

**Frontend** (solo si hay archivos en `packages/app/`; ver `app.instructions.md` → "Estados de Pantalla")
12. 🔴 Pantallas con datos: `isError` → `EmptyScreenError`, `isLoading` → skeleton, vacío → `EmptyScreenFilter`/`EmptyState`.
13. 🔴 Sin texto suelto para estados (`Cargando`, `<Text.Muted>`, `<p>`) ni fallbacks inalcanzables en ternarios.
14. 🔴 Botones que disparan mutations usan `isLoading={isPending}`, no solo `disabled`.
15. 🟡 Empty states de dominio construidos sobre `EmptyState`.
16. 🟡 Skeletons en `Components/` del dominio (o `Application/Components/` si son cross-domain).
17. 🟡 El barrel `index.ts` no reexporta implementaciones privadas.

Rechazar solo por incumplimientos de estándares documentados, nunca por estilo personal.

## `04_review_log.md`

Frontmatter: `.opencode/scripts/bash/memory-log-scaffold.sh frontmatter review_log {task_id} Reviewer_Agent APPROVED|REJECTED`.

```markdown
# Revisión — <título>

Resultado: APPROVED | REJECTED · ítems revisados: <n> · 🔴 fallidos: <lista o "ninguno">

## Feedback (solo si REJECTED; uno por ítem 🔴 fallido)
- Ítem <n> — `<archivo>:<línea>`: <problema>. Esperado: <cambio concreto, con snippet si ayuda>.

## Deuda técnica (solo si hay 🟡 fallidos)
- <ítem>: <detalle>
```
