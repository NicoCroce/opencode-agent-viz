# OpenCode Agent Viz — Visión general

> **Observabilidad en tiempo real para ejecuciones multi-agente de OpenCode.**

## Qué es

OpenCode Agent Viz es un **visor web de solo lectura** que muestra, en vivo,
todo lo que ocurre durante una o varias ejecuciones de agentes y subagentes en
OpenCode.

Cuando un flujo dispara agentes que a su vez lanzan subagentes, la ejecución se
vuelve una caja negra: el terminal escupe texto y vos querés entender
**estructura, estado y costo**. Agent Viz lo resuelve con un grafo jerárquico en
vivo, un inspector por nodo y un detalle de ejecución completo, alimentados por
el stream de eventos (SSE) del servidor de OpenCode.

No controla nada: **observa**. Nunca envía prompts, aborta sesiones ni responde
permisos. Eso lo hace seguro por diseño y apto para mirar ejecuciones sin
alterarlas.

## Para quién es

- **Desarrolladores de OpenCode** que quieren ver qué hacen sus agentes.
- **Equipos** que necesitan auditar costo, tokens y tiempos de las ejecuciones.
- **Autores de agentes y de metodologías SDD** (como SddOrch) que necesitan
  depurar orquestaciones multi-agente.
- **Cualquiera que enseñe o demuestre** cómo se comporta un sistema de agentes.

## Cinco beneficios clave

1. **Entendé la estructura, no solo el texto.** Un grafo jerárquico
   agente → subagente con estado en vivo, en lugar de un scroll infinito.
2. **Diagnosticá al instante.** El inspector muestra agente, modelo, esfuerzo,
   herramientas, todos y errores de cada nodo.
3. **Mirá el costo con claridad.** Duración, tokens (entrada/salida/razonamiento/
   caché) y costo por agente y por sesión, con estado explícito "no disponible".
4. **Seguí la ejecución sin perderte.** Follow mode que centra el nodo activo y
   resalta los que esperan permisos del usuario.
5. **Cero riesgo.** Es de solo lectura: no toca tu repo ni tus sesiones.

## Empezar rápido

Requisitos: **Node 22+**, **pnpm 9+** y **OpenCode 2.0.22+**.

```bash
pnpm install
opencode service status   # asegurate de que el background service esté corriendo
pnpm start                # descubre URL + password y levanta el visor
```

Abrí el visor y listo. La conexión se refleja en el indicador de estado
(**connected / reconnecting / disconnected**).

## ¿Por dónde seguir?

| Quiero… | Documento |
|---|---|
| Entender el valor y los diferenciadores | [Propuesta de valor](02-value-proposition.md) |
| Ver las bondades en detalle | [Bondades y beneficios](03-benefits.md) |
| Ver casos de uso concretos | [Casos de uso](04-use-cases.md) |
| Entender cómo funciona por dentro | [Cómo funciona](05-how-it-works.md) |
| Resolver dudas y objeciones | [Preguntas frecuentes](06-faq.md) |
