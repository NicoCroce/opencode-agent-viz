# Propuesta de valor

## El problema

Las ejecuciones multi-agente son **cajas negras**.

Cuando un flujo de OpenCode lanza un agente que a su vez delega en varios
subagentes, aparecen preguntas que el terminal no responde bien:

- ¿Qué agente está corriendo ahora y cuál está bloqueado?
- ¿Por qué se detuvo la ejecución? ¿Espera un permiso o una respuesta?
- ¿Cuánto costó, en tiempo y en tokens, cada rama de la ejecución?
- ¿Qué archivos tocó realmente?
- ¿Hay un loop o un reintento infinito?

El TUI de OpenCode muestra texto y algunos estados, pero no la **estructura**
de la orquestación ni su **costo** de forma comparable. Los logs y la base de
datos requieren conocimiento interno y no son en vivo.

## La solución

Agent Viz convierte el stream de eventos de OpenCode en una **imagen viva de la
ejecución**:

- un **grafo jerárquico** agente → subagente con estado en vivo;
- un **inspector** por nodo con modelo, esfuerzo, herramientas y errores;
- un **detalle de ejecución** con respuestas, razonamiento, historial completo e
  impacto en el repo;
- **métricas** de duración, tokens y costo;
- **diagnóstico** de esperas (permisos, preguntas), loops y reintentos.

Todo **en tiempo real** y **de solo lectura**.

## ¿Por qué ahora?

El uso de agentes y subagentes creció más rápido que sus herramientas de
observabilidad. Los equipos ya confían trabajo real a orquestaciones
multi-agente, y necesitan verlas con la misma claridad con la que ven un build
o un deploy. Agent Viz cubre ese hueco: observabilidad nativa para el modelo de
ejecución de OpenCode.

## Diferenciadores

| Enfoque | Qué te da | Qué le falta |
|---|---|---|
| TUI de OpenCode | Texto y estados básicos | No muestra la estructura del grafo ni el costo comparado |
| Leer logs / la DB | El dato crudo | No es en vivo, requiere conocimiento interno |
| **Agent Viz** | Grafo vivo + inspector + métricas + detalle | — |

Y una diferencia de fondo: **Agent Viz es de solo lectura por diseño**. No
puede alterar una ejecución, así que podés usarlo sobre sesiones reales sin
miedo.

## Audiencias y qué gana cada una

| Audiencia | Qué obtiene |
|---|---|
| Desarrollador de OpenCode | Ver y depurar la orquestación en vez de adivinarla |
| Equipo / tech lead | Auditar costo, tokens y tiempos por sesión |
| Autor de agentes / SDD | Corregir el diseño del orquestador con evidencia |
| Docente / demo | Mostrar cómo se comporta un sistema multi-agente |

## No-objetivos (v1)

- **No controla ejecuciones.** No envía prompts, no aborta sesiones, no responde
  permisos ni preguntas.
- **No es un servidor de OpenCode.** Consume el background service existente.
- **No persiste historial propio.** La fuente de verdad es OpenCode.
- **No es multi-proyecto ni remoto.** Hoy observa el proyecto local conectado.

Estos límites son parte de la propuesta: un observador que no puede intervenir
es un observador en el que se puede confiar.
