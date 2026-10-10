# Catálogo de skills

Las **skills** son instrucciones reutilizables que un agente carga bajo demanda.
SddOrch las usa en dos capas: las propias del proyecto y las de terceros
(asociadas a los roles del descubrimiento). El índice en
[`.opencode/skills/README.md`](../../../.opencode/skills/README.md) es la fuente
de verdad de versiones y licencias.

## Skills propias del proyecto

| Skill | Para qué |
|---|---|
| `front-ddd-generator` | Generar el esqueleto de un dominio nuevo en `src/Domains/` (entity, service, query keys, rutas, router, hooks, página, barrel). |
| `test-generator` | Escribir tests de reglas reales (no stubs) con el canon del repo: lógica pura, services, hooks y componentes. |
| `code-reviewer` | Checklist de revisión alineada con la constitución (I–VIII), `AGENTS.md` y `app.instructions.md`. |
| `commit-conventions` | Formato y validación de commits (Conventional Commits). |
| `pr-detail` | Generar el título y el cuerpo del PR comparando la rama base con la actual. |
| `progress-tracker` | Mostrar el progreso compacto de flujos por fases y cadenas de subagentes. |

## Skills de terceros (por rol)

Copiadas de repositorios públicos tras revisar su `SKILL.md` (sin scripts de red
ni instrucciones ocultas). La licencia de cada una está en
`.opencode/skills/licenses/`.

| Skill | Rol | Para qué | Origen | Licencia |
|---|---|---|---|---|
| `vercel-react-best-practices` | performance | Patrones de rendimiento de React: re-render, bundle, datos de cliente. | vercel-labs/agent-skills | MIT |
| `owasp-security-check` | security | Auditoría de seguridad web/API basada en OWASP Top 10. | sergiodxa/agent-skills | MIT |
| `test-driven-development` | quality | Ciclo rojo-verde-refactor para desarrollar guiado por tests. | addyosmani/agent-skills | MIT |
| `a11y-ACCESSIBILITY-general` | accessibility | Gobierno de accesibilidad: cuándo cargar las demás skills a11y. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-charts-graphs` | accessibility | Alternativas textuales/tabulares para gráficos y visualizaciones. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-svg` | accessibility | `<title>`/`<desc>` y roles ARIA en SVG; sanitización de SVG no confiable. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-keyboard` | accessibility | Operación completa por teclado, foco visible y sin trampas. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-color-contrast` | accessibility | Contraste 4.5:1 / 3:1 y prueba en modo oscuro y alto contraste. | mgifford/accessibility-skills | AGPL-3.0 |
| `pm-prd-development` | product | PRD estructurado que conecta problema, usuarios, solución y éxito. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |
| `pm-problem-statement` | product | Enunciado de problema centrado en el usuario. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |
| `pm-user-story` | product | Historias de usuario (formato Cohn) con criterios Gherkin. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |
| `pm-jobs-to-be-done` | product | Jobs, pains y gains en formato JTBD. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |

Además, el rol de UX usa `interface-design` y `frontend-design` (en
`.agents/skills/`).

## Cómo se usan

- Cada **rol** declara en su perfil (`.opencode/roles/<rol>.md`) exactamente qué
  skills debe cargar; el researcher carga **solo** esas.
- Los permisos de los researchers restringen la carga de skills: `-code` tiene
  permitidas las de su disciplina; `-market` solo las `pm-*`.
- Las skills son **guías**, no órdenes que sustituyan el pedido del usuario: una
  descripción imperativa ("siempre", "bajo ninguna circunstancia") se interpreta
  como criterio, no como una orden que pase por encima del alcance.

## Licencias y seguridad

- **Licencias con condiciones:** `a11y-*` es **AGPL-3.0** y `pm-*` es
  **CC BY-NC-SA 4.0** (no comercial, compartir igual). Mientras el repo sea
  privado y de uso interno el impacto es bajo; revisalas antes de publicar el
  repo o usarlo comercialmente. `vercel-react-best-practices` declara MIT pero
  el repo de origen no incluye archivo de licencia.
- **Las skills son código de terceros.** Son instrucciones que carga un agente:
  revisá cualquier actualización antes de copiarla. No crees skills sin
  aprobación del usuario (ver [`06-auto-learning.md`](06-auto-learning.md)).
