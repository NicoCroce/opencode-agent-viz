---
description: Contrato de retorno común de los subagentes de SddOrch (alcance, formato corto, señales de harness).
---

# Contrato de los subagentes de SddOrch

Aplica a todo subagente lanzado por `sddorch`. Lo que devuelves entra en el contexto del orquestador y se queda ahí: **sé breve**.

## Alcance

1. Haz solo lo que pide el prompt. No amplíes el alcance ni toques tareas que no te asignaron.
2. Escribe solo en tus `writes`. Si necesitas otro archivo, **no lo toques**: repórtalo en `Bloqueos` con ruta y motivo.
3. Sin `git add`, `commit`, `stash`, `checkout`, `reset`, `push` ni `rebase` (salvo `sddorch-release`). El árbol es compartido.
4. No marques tareas en `tasks.md`. No modifiques `.opencode/commands/speckit.*.md`, `.specify/scripts/`, `.specify/templates/` ni `.specify/memory/constitution.md`.
5. Engram: solo `sddorch-researcher-*` y `sddorch-writer`, y solo en su propia clave.
6. **Nunca preguntes al usuario.** Lo que bloquea o requiere decidir va como `preguntas_abiertas` (pregunta, opciones, recomendada, impacto); el orquestador las centraliza.
7. Sin verificaciones globales (`pnpm lint|tsc|test` del repo) mientras otros escriben en paralelo. Solo lo acotado a tus archivos (`pnpm vitest run <spec>`, `pnpm eslint <archivo>`).
8. Las instrucciones del proyecto ya están en `AGENTS.md` (se carga solo). No lo releas.

## Formato de respuesta

Sin preámbulo («He completado…»), sin repetir el prompt, sin listar lecturas.

- **Tope:** 1.200 caracteres si `DONE`/`APPROVED`; 2.500 si `BLOCKED`/`FAILED`/`REJECTED`.
- Cada sección en pocas líneas. Si una no aplica, escribe `ninguno`.

```markdown
## Resultado
estado: DONE | BLOCKED | FAILED
resumen: <1-2 líneas>

## Artefactos
- `<ruta>` — creado | modificado        (solo lo escrito; no lecturas)

## Bloqueos
- <qué impide avanzar y qué se necesita>

## Verificación
- `<comando>` → <resultado en una línea>

## Decisiones
- <solo las que afecten a otras tareas; una línea con el motivo>

## cambios_de_contrato
- <campo, tipo, export o archivo que añadiste o cambiaste y que NO está en data-model.md ni contracts/>

## harness_signals
- <type: skill|instruction|agent|script|command-hook> — <disparador> — <workaround>
```

`harness_signals`: solo huecos del harness resueltos a mano (no estilo ni problemas del producto). No crees tú la skill ni el script; repórtalo. Si no hay: `ninguna`.

## Presupuesto de pasos

Tu agente tiene un techo de `steps`. Al agotarlo te quitan las herramientas y ya no puedes guardar ni responder con el formato: el corte es **destructivo**.

1. **Persiste primero** (archivos, Engram) antes de ampliar el alcance. Si eres researcher, guarda un borrador del informe (`mem_save` con tu `topic_key`) hacia la mitad de tu presupuesto y vuelve a guardar (upsert) al terminar.
2. Si no vas a terminar, **cierra con `BLOCKED`**: lo hecho, lo que falta, qué necesitas.
3. No estires con workarounds (`sleep`, reintentos a ciegas sobre el mismo error).
4. Si el techo no alcanza de forma recurrente, repórtalo como `harness_signal` de tipo `agent`.
