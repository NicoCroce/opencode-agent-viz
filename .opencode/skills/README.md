# Skills

## Propias del proyecto

| Skill | Uso |
|---|---|
| `front-ddd-generator` | Esqueleto de un dominio nuevo en `src/Domains/`. |
| `test-generator` | Cómo escribir tests con el canon del repo. |
| `code-reviewer` | Checklist de revisión (constitución I-VIII). |
| `commit-conventions` | Formato y validación de commits. |
| `pr-detail` | Detalle del PR. |
| `progress-tracker` | Progreso de flujos por fases. |

## De terceros

Copiadas de repositorios públicos tras revisar su `SKILL.md` y sus scripts (sin scripts de red ni instrucciones ocultas). Se eliminaron los scripts de Python de `pm-*`. La licencia de cada una está en `licenses/`.

| Skill (carpeta) | Origen | Commit | Licencia | Rol |
|---|---|---|---|---|
| `vercel-react-best-practices` | vercel-labs/agent-skills | `063bee9` | MIT | rendimiento |
| `owasp-security-check` | sergiodxa/agent-skills | `40e21b4` | MIT | seguridad |
| `test-driven-development` | addyosmani/agent-skills | `1be8e34` | MIT | calidad |
| `a11y-ACCESSIBILITY-general`, `a11y-charts-graphs`, `a11y-svg`, `a11y-keyboard`, `a11y-color-contrast` | mgifford/accessibility-skills | `ada8393` | AGPL-3.0 | accesibilidad |
| `pm-prd-development`, `pm-problem-statement`, `pm-user-story`, `pm-jobs-to-be-done` | deanpeters/Product-Manager-Skills | `1b5a524` | CC BY-NC-SA 4.0 | producto |

Además de las anteriores se usan `interface-design` y `frontend-design` (en `.agents/skills/`) para el rol de UX.

## Licencias a tener en cuenta

- **AGPL-3.0** (`a11y-*`) y **CC BY-NC-SA 4.0** (`pm-*`, no comercial y compartir igual) son licencias con condiciones. Mientras el repo sea privado y de uso interno el impacto es bajo; revísalas antes de publicar el repo o usarlo comercialmente.
- `vercel-react-best-practices` declara MIT en su `SKILL.md`; el repositorio de origen no incluye un archivo de licencia.
- Algunas `pm-*` enlazan a skills hermanas que no se copiaron (por ejemplo `workshop-facilitation`); esos enlaces no resuelven.

## Seguridad

Las skills son instrucciones que carga un agente: trátalas como código de terceros. Revisa cualquier actualización antes de copiarla. Los agentes `sddorch-researcher-*` solo pueden cargar las skills de su rol.
