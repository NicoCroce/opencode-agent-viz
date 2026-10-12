<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles:
  - I. Observador de solo lectura → I. Observador con modo interactivo (redefinición incompatible → MAJOR)
  - VII. Rendimiento en tiempo real → VII. Rendimiento en tiempo real (texto precisado: batches, sin
    re-layout por evento, buffer de streaming del chat separado)
- Added sections:
  - Governance
- Removed sections: (none)
- Follow-up TODOs: (none)
-->

# Constitution — OpenCode Agent Viz

## Principios de Arquitectura

**I. Observador con modo interactivo**
La app observa por defecto y visualiza lo que OpenCode reporta vía SSE. Con el modo interactivo habilitado puede enviar prompts, interrumpir sesiones y responder preguntas/permisos. La escritura se dirige al agente y nunca muta datos propios del visor. El acceso al dev server MUST quedar restringido (bind loopback y validación de Origin/Referer); no se expone a la red.

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
Eventos procesados en lotes (batches). El grafo ignora los deltas de texto y no se re-layouta por evento. El chat mantiene un buffer de streaming separado que acumula los deltas sin provocar re-layout del grafo.

**VIII. Convenciones de repositorio**
Tests en carpetas `specs/` junto al código. No mezclados. Commits Conventional Commits. ESLint strict. TypeScript strict.

## Governance

Esta constitución prevalece sobre cualquier otra práctica del repositorio.

Toda enmienda requiere propuesta escrita, aprobación explícita del usuario y actualización del Sync Impact Report.

Versionado semántico: MAJOR (eliminación o redefinición incompatible de un principio), MINOR (principio nuevo o guía materialmente ampliada), PATCH (aclaraciones de redacción).

Cumplimiento: toda feature verifica los principios en las compuertas plan-check y code-review; la complejidad debe justificarse.

Guía de desarrollo en runtime: AGENTS.md.

**Version**: 2.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-10
