---
name: commit-conventions
description: Formato de commits del proyecto (Conventional Commits validado por commitlint + lint-staged vía Husky). Usar al crear cualquier commit.
---

# Commit Conventions

Formato: `<type>(<scope>): <subject>` (+ body opcional tras una línea en blanco).

- `type`: `feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `style` | `perf` | `build` | `ci` | `revert` (`@commitlint/config-conventional`; sin límite de largo del header).
- `scope`: dominio o área (`users`, `documents`, `opencode`…).
- `subject`: imperativo, minúscula inicial, sin punto final.
- Sin atribución IA ni `Co-Authored-By`.

Hooks (Husky): `pre-commit` corre `pnpm lint-staged` (ESLint + Prettier sobre lo staged); `commit-msg` corre commitlint.

Si un hook falla: leer el error, corregir el archivo, `git add` y volver a commitear. **Prohibido `git commit --no-verify`** (constitución, Pr. VI).

Ejemplos: `feat(documents): add filter by document type`, `fix(auth): refresh token on expired session`.
