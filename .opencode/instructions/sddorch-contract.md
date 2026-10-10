---
description: Contrato de retorno común de los subagentes de SddOrch (formato, señales de harness y reglas de alcance).
---

# Contrato de los subagentes de SddOrch

Aplica a todo subagente lanzado por `sddorch` (`sddorch-researcher-code`, `sddorch-researcher-market`, `sddorch-writer`, `sddorch-implementer`, `sddorch-reviewer`, `sddorch-tester`, `sddorch-release` y los `general` que ejecutan comandos Spec-kit).

## Reglas de alcance

1. Haz solo lo que pide el prompt del orquestador. No amplíes el alcance ni toques tareas que no te asignaron.
2. Escribe únicamente en los archivos que se te indican (`writes`). Si necesitas tocar otro archivo, **no lo hagas**: repórtalo como bloqueo.
3. No ejecutes `git add`, `commit`, `stash`, `checkout`, `reset`, `push` ni `rebase`, salvo `sddorch-release`. Varios subagentes comparten el mismo árbol de trabajo.
4. No marques tareas en `tasks.md`; lo hace el orquestador.
5. No llames a Engram, salvo `sddorch-researcher-*` y `sddorch-writer`, que escriben únicamente en la clave que se les asigna. Nadie más escribe en Engram.
6. **Nunca preguntes al usuario.** Si algo bloquea o requiere una decisión, devuélvelo como `preguntas_abiertas` (pregunta, opciones, recomendada, impacto) y el orquestador las centraliza.
7. No ejecutes verificaciones globales (`pnpm tsc`, `pnpm lint`, `pnpm test` sobre todo el repo) mientras otros subagentes escriben en paralelo: pueden fallar por trabajo ajeno a medio hacer. Ejecuta solo lo acotado a tus archivos (por ejemplo `pnpm vitest run <spec>`). Las verificaciones globales las hace el orquestador.
8. No modifiques archivos de Spec-kit: `.opencode/commands/speckit.*.md`, `.specify/scripts/`, `.specify/templates/` ni `.specify/memory/constitution.md`.

## Formato de respuesta

Responde siempre con estas secciones, breves:

```markdown
## Resultado
estado: DONE | BLOCKED | FAILED
resumen: <1-3 líneas>

## Artefactos
- `<ruta>` — creado | modificado | leído

## Decisiones
- <decisión relevante y motivo; "ninguna" si no hay>

## Bloqueos
- <qué impide avanzar y qué se necesita; "ninguno" si no hay>

## Verificación
- `<comando>` → <resultado>

## harness_signals
- type: skill | instruction | agent | script | command-hook
  trigger: <situación que lo provocó>
  workaround: <qué hiciste para salir del paso>
  evidence: <archivo, error o comando concreto>
  reuse: <dónde o con qué frecuencia volvería a pasar>
```

Si no hay señales, escribe `harness_signals: ninguna`.

## Señales de harness

Reporta una señal cuando resuelvas algo **a mano** que una pieza permanente del harness habría resuelto mejor:

- Repetiste un procedimiento que merece una **skill** (por ejemplo, un patrón de test o de dominio).
- Faltaba una **instrucción** o una regla del proyecto y tuviste que inferirla.
- Una tarea habría ido mejor con un **agente** especializado.
- Automatizaste algo con comandos sueltos que merece un **script**.
- Un comando de Spec-kit necesitó un ajuste que encajaría como **hook** (`.specify/extensions.yml`).

No reportes preferencias de estilo ni problemas del código del producto: solo huecos del harness. No crees tú la skill, la instrucción ni el script; solo repórtalo. El orquestador los acumula y los propone al usuario al cerrar.
