# Constitution — OpenCode Agent Viz

## Principios de Arquitectura

**I. Observador de solo lectura**
La app nunca envía prompts, aborta sesiones ni responde permisos en v1. Solo visualiza lo que OpenCode reporta via SSE.

**II. Arquitectura por dominios funcionales**
Código organizadoen `src/Domains/[Domain]/` con subcarpetas: entity, service, routes, router, Components, Hooks, Pages. Una responsabilidad por dominio (Connection, Sessions, Graph, Inspector).

**III. Datos del servidor SOLO vía TanStack Query**
El SDK de OpenCode se invoca **solo** desde archivos `*.service.ts`. Componentes y páginas consumen datos via hooks. Prohibido imports directos del SDK en componentes.

**IV. Tipos derivados del SDK**
Tipos con prefijo `T` derivados de `@opencode-ai/sdk`. Prohibido redefinir mano interfaces que el SDK ya exporta.

**V. Lógica pura y testeable**
Funciones puras sin React para: aplicar eventos al estado, construir el grafo, derivar estados. Con tests unitarios usando eventos reales grabados.

**VI. Estados de pantalla obligatorios**
Toda pantalla con datos: error → loading → vacío → datos. Estado de conexión siempre visible.

**VII. Rendimiento en tiempo real**
Eventos procesados en lotes (batches). Deltas de texto ignorados. Sin re-layout completo del grafo por evento.

**VIII. Convenciones de repositorio**
Tests en carpetas `specs/` junto al código. No mezclados. Commits Conventional Commits. ESLint strict. TypeScript strict.
