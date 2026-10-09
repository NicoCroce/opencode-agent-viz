---
name: commit-conventions
description: Formato y validación de commits del proyecto (Conventional Commits, constitución principio VIII). Usar al crear cualquier commit.
---

# Commit Conventions

Formato: `<type>(<scope>): <subject>` y, opcionalmente, un body tras una línea en blanco.

- `type`: `feat` | `fix` | `refactor` | `test` | `docs` | `style` | `chore` | `perf` | `build` | `ci` | `revert`.
- `scope`: dominio o área afectada, en minúsculas (`graph`, `connection`, `sessions`, `inspector`, `hooks`, `components`, `opencode`…). Obligatorio.
- `subject`: imperativo, minúscula inicial, sin punto final, máximo 50 caracteres. Si no cabe, mueve el detalle al body.
- Body (opcional): explica el porqué, no el qué. Líneas de hasta 72 caracteres.
- Sin atribución de IA ni `Co-Authored-By`.

## Validación

Este repo no tiene Husky ni commitlint. Valida el mensaje tú antes de ejecutar `git commit`: el header debe cumplir

```
^(feat|fix|refactor|test|docs|style|chore|perf|build|ci|revert)\([a-z0-9-]+\): [a-z0-9].{0,49}[^.]$
```

Si no cumple, corrige el mensaje y vuelve a validar.

## Reglas de uso

- Un commit por cambio lógico. No mezcles feature, refactor y docs en el mismo commit.
- El `scope` debe coincidir con el dominio principal de los archivos del commit.
- Revisa `git diff --staged --stat` antes de commitear; no incluyas archivos ajenos al cambio.
- Prohibido `git commit --no-verify` y `git push --force` salvo petición explícita.
- No hagas commit directamente en `main`.

## Ejemplos

```
feat(graph): add real-time node updates via SSE
fix(connection): handle reconnection with backoff
refactor(components): atomize shared pieces
test(sessions): add fixtures for session list
docs(opencode): document agent harness
```
