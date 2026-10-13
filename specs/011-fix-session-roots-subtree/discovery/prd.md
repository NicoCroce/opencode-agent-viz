# PRD — Todas las sesiones raíz listables y subárbol de grafo completo

> Independiente de la tecnología: qué y por qué, nunca cómo. Entrada de `specify`.
> Fuentes: `improvements/fix-session-list-parent-window.md` (plan aprobado, E1–E5 / T001–T028),
> norte Engram `sddorch/20261012-fix-session-list-parent-window/north` (#654), informes
> `findings/performance` (#658), `findings/quality` (#656), `findings/ux` (#657) y las decisiones
> `sddorch/20261012-fix-session-list-parent-window/decision/*` (#659–#666).

## Problema

El visor abre la vista de sesiones pidiendo **las 200 sesiones más recientes del proyecto sin
distinguir raíces de hijas**. En un store real eso significa que las hijas de subagentes desplazan
a las raíces fuera de la ventana.

Evidencia medida en el store (2026-10-12): **486 sesiones, 38 raíces, 448 hijas**.
- `limit=200&order=desc` sin filtro → **15–16 raíces visibles** (y ~184 hijas).
- `limit=200&parentID=null&order=desc` → **38 raíces, 0 hijas**.

Quien abre el visor, por tanto:
1. **No encuentra la mayoría de raíces** en el listado: ~22 de 38 no son alcanzables navegando.
2. Si abre la URL de una de esas raíces, la vista **se queda en un skeleton sin fin**: el
   directorio se resuelve solo desde las raíces ya listadas, su consulta queda deshabilitada y el
   estado de carga se fuerza sin salida (ni error, ni timeout, ni vacío).
3. Aunque entre, el **grafo del subárbol sale vacío o cortado en silencio**, sin decir que falta
   contenido.
4. El **paralelismo se agrupa por sesión**: una hija reutilizada en varios pasos del padre aporta
   un único intervalo largo que **fusiona pasos secuenciales** en una misma fila paralela.
5. El **Inspector nunca muestra skills cargadas**, porque las lista como lista vacía fija.

Importa porque el producto es un visor de ejecuciones multi-agente: si no se ven todas las
ejecuciones, si un enlace directo no abre, o si el grafo miente sobre qué corrió en paralelo, la
herramienta no cumple su función de observabilidad.

## Usuarios

Perfil único: desarrollador/analista que revisa ejecuciones multi-agente de OpenCode (una o más
sesiones por proyecto). Contexto de uso: llega por el listado o por un enlace directo a una sesión
concreta, compara pasos paralelos y consulta el detalle de un agente en el Inspector.

## Objetivos

- Toda sesión raíz del proyecto es **listable** y **accesible** sin depender de la ventana de
  sesiones recientes.
- El directorio de una sesión **se resuelve siempre**: nunca un estado de carga sin salida.
- El subárbol mostrado es **completo o declara truncamiento** visible.
- La unidad de paralelismo es la **invocación** (llamada de subagente/tarea del padre), no la
  sesión; filas y badge dicen lo mismo.
- El Inspector **lista las skills cargadas** con su estimación de tokens.

## No-objetivos

- Modelo de datos del grafo, layout y métricas derivadas.
- Paginación de mensajes (ya resuelta) y vistas de Chat/History.
- Skills permitidas/configuradas por agente (solo las **cargadas** en la sesión).
- Coalescer las invalidaciones SSE: queda como seguimiento aparte (decisión
  `decision/coalescing-fuera-de-alcance`).
- Virtualizar el listado o el riel de sesiones (no es necesario con decenas de raíces).

## Historias de usuario (priorizadas, independientes)

| Id | Prioridad | Historia | Criterio de aceptación |
|---|---|---|---|
| H1 | P1 | Como analista quiero ver **todas las raíces** del proyecto en el listado para poder abrir cualquiera | Dado un proyecto con **R raíces y H hijas**, cuando abro el listado, entonces se listan **las R raíces y ninguna hija**; el texto de aceptación habla de "todas las raíces" (R se mide hoy en 38) y **no** de un número fijo; el orden dentro de cada carpeta sigue siendo por última actividad descendente |
| H2 | P1 | Como analista quiero que un enlace directo a una raíz no listada abra su grafo | Dado `?id=<raíz fuera de la ventana>`, cuando abro la URL, entonces la vista muestra esa raíz y su subárbol; **no** permanece en skeleton; el directorio se resuelve aunque la raíz no esté en el listado |
| H3 | P1 | Como analista quiero estados de pantalla honestos cuando el enlace es raro o la red falla | Dado una sesión cuyo directorio aún no se conoce, mientras se resuelve → **carga acotada**; al resolver → **datos**; si la sesión no existe → **"no encontrada" con acción para volver al listado**; si falla la red → **error con reintento**. Nunca skeleton infinito (Principio VI) |
| H4 | P2 | Como analista quiero ver el subárbol completo, o saber que falta | Dado una raíz con descendientes, cuando abro, entonces el grafo incluye **todo el subárbol**; si el cargador toca su tope, entonces aparece un **aviso persistente** de subárbol incompleto (no un recorte silencioso) |
| H5 | P2 | Como analista quiero que el paralelismo no mezcle pasos secuenciales | Dado un padre que invoca subagentes en **pasos distintos**, incluida una **hija reutilizada en dos pasos**, cuando llegan los datos, entonces cada invocación es una unidad: los dos pasos **no comparten fila ni lote**, y **filas y badge coinciden** |
| H6 | P3 | Como analista quiero ver qué skills cargó un agente y cuánto costaron | Dado una sesión con skills cargadas, cuando abro el Inspector, entonces veo cada skill con su estimación de tokens (`nombre · ~N tokens`); sin skills cargadas → texto "Sin skills cargadas"; el vacío de la sección ya no oculta una sesión que solo cargó skills |

## Requisitos funcionales

- RF1: la lista de sesiones se compone **solo de raíces** del proyecto (las hijas no ocupan la ventana).
- RF2: la lista es **completa** con independencia del volumen del proyecto, o declara truncamiento.
- RF3: el directorio de una sesión se resuelve **desde la propia sesión** cuando no está en la lista.
- RF4: todo estado de carga tiene salida (datos, error o vacío con acción); prohibido el skeleton terminal.
- RF5: una sesión inexistente se distingue de "sin nodos" y ofrece salida al listado.
- RF6: el subárbol cargado es completo; si se trunca, se declara de forma persistente y no intrusiva.
- RF7: la unidad de paralelismo es la invocación; una sesión reutilizada aporta **varios intervalos**, no uno.
- RF8: filas y badge de paralelismo derivan de la misma unidad (paridad exigida por el contrato de 007).
- RF9: el Inspector lista las skills **cargadas** en la sesión, con conteo de repeticiones y estimación de tokens.
- RF10: la estimación se rotula como aproximada (caracteres ÷ 4), nunca como coste real.

## Métricas de éxito

- **38/38 raíces listadas** en el store medido; 0 hijas en la lista (hoy 15–16/38).
- **0 casos** de skeleton infinito al abrir por URL.
- **0 casos** de filas/lote que fusionen pasos secuenciales de un mismo padre.
- Payload por refresco de la lista: de 200 ítems a **38** (−81 %, 5,4×). *Nota: la comparación
  honesta es 200→38, no 468→37 (468/486 es el total del store, no lo que pide el visor).*
- Coste de red del subárbol: **1 request por raíz** en el bosque medido (plano: 25 raíces sin
  hijos, 13 con hijos directos, 0 con nietos); el techo crece con nodos internos, no con nodos.

## Restricciones

Constitución del proyecto: **II** (arquitectura por dominios), **III** (SDK solo en
`*.service.ts`; datos vía TanStack Query), **IV** (tipos derivados del SDK), **V** (lógica pura y
testeable fuera de componentes), **VI** (estados de pantalla explícitos, sin skeleton infinito),
**VII** (rendimiento en tiempo real; no encarecer el refresco por evento). Solo frontend + tests;
no se toca `.specify/` ni la constitución. Specs viven junto al código.

## Decisiones y supuestos

- `decision/cache-subtree` (D5): el subárbol cuelga de `graph.*`, no de `sessions.all`.
- `decision/e4-completa` (D6): la invocación alimenta filas **y** badge; la firma de lotes entra en la clave de ejecución.
- `decision/borrado-codigo-muerto` (D7): se eliminan `useSessionInfo` y `useSelectSession`.
- `decision/t021-fin-invocacion` (D8): el fin de la invocación es el fin del tool part.
- `decision/ux-estados-graph` (D9): estados y textos del grafo, banner y formato de skills.
- `decision/filter-subtree-spec` (D10): `filterSubtree` se conserva por compatibilidad de barrel y recibe spec propio.
- `decision/coalescing-fuera-de-alcance` (D11): el coalescing SSE no entra en alcance.
- Supuestos: el árbol del proyecto es plano (medido, no generalizable a todo store); `background: true` no aparece en el store (0 casos), así que su tratamiento queda documentado y no verificado.

## Preguntas abiertas

- **Presupuesto global del cargador de subárbol**: hoy el tope es por padre. Opciones: (A) presupuesto de nodos/requests con aviso por encima del techo de fluidez de ~200 agentes; (B) solo tope por padre; (C) truncar a ~200. Recomendada: **A** (B no acota el peor caso y C recortaría casos reales como la raíz de 109 hijos). Impacto: coste de layout y texto del aviso.
- **Ventana de la barra del nodo vs. ventana de la invocación**: si las filas se agrupan por invocación y la barra del nodo se dibuja con el intervalo de sesión, hay diferencia visual. Opciones: documentarla o unificar. Impacto: 8 llamadas `background` medidas.
