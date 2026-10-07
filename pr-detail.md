# PR: feat(viz): add execution detail, history and enriched states

## Resumen
El visor pasa de mostrar *cuándo* corrió cada agente a mostrar *qué hizo*: se leen sus respuestas y razonamiento, se abre el histórico completo de cualquier agente o subagente y cada nodo expone su estado real de ejecución. Todo sigue siendo de solo lectura y sin procesar deltas de texto.

## Cambios principales
- Respuestas y razonamiento con formato enriquecido y saneado, y tool calls expandibles.
- Histórico completo en overlay a pantalla completa, con linaje padre-hijo y carga progresiva.
- Estado de ejecución de 9 valores (reintento, compactación, esperas, interrupción) coherente nodo-detalle.
- Barra de resumen de sesión: contadores por estado, coste, tokens y tiempo.
- Impacto en el repositorio: archivos, líneas y parche por agente.
- Motivo de la espera: permisos, preguntas al usuario y turnos en cola.
- Compactación de contexto y duración mediana por herramienta.
- Nuevo dominio `History`; wrapper del SDK ampliado solo con endpoints de lectura.

## Archivos modificados
- `src/Domains/History/` — dominio nuevo del histórico
- `src/Infrastructure/WorkspacePage.tsx` — orquesta overlay y resumen
- `src/Infrastructure/Services/opencodeClient.ts` — endpoints de lectura
- `src/Domains/Graph/` — estados, señales y barra de resumen
- `src/Domains/Inspector/` — respuestas, archivos y preguntas
- `src/Application/Components/Organisms/` — render compartido de entradas
- `specs/003-execution-detail-views/` — spec, plan, contratos y tareas

## Notas adicionales
- Dependencias nuevas: `react-markdown`, `remark-gfm`, `rehype-sanitize` (ejecutar `pnpm install`).
- `pnpm-lock.yaml` está en `.gitignore`, así que no entra en el diff.
- La validación de los escenarios V1–V7 de `quickstart.md` está cubierta por la suite (451 tests); la comprobación manual contra un servidor OpenCode en vivo queda pendiente.
- Sin migraciones ni variables de entorno nuevas.
