---
name: progress-tracker
description: Muestra el progreso compacto de pipelines y cadenas de agentes. Usar al iniciar, cambiar de fase, pausar o delegar. `@develop` y `@blendverse-implement` ya traen estas reglas inline; cargarla solo en flujos ad-hoc.
---

# Progress Tracker

Usá `todowrite` como estado visual primario. Actualizalo inmediatamente antes de
una fase/agente y al finalizarlo; un ítem solo se completa con resultado positivo.
Las fases no aplicables se completan con `SKIPPED — <motivo>`.

## Diseño de feature

Crear una lista con Fases 0–6. Fase 0 es `SKIPPED — solo se evalúa en modo auto`
cuando el modo es `plan`. Fase 3 incluye el diseño frontend condicional; no es una
fase adicional para el porcentaje.

El progreso cuenta únicamente Fases 1–6:
`round(fases terminadas / 6 * 100)`. Un handoff aceptado es `HANDOFF STARTED`, no
la finalización de la implementación.

Informar cada transición en una línea:

```text
Fase <n>/6 · <estado> · <agente o acción> · <progreso>%
```

Agregar una segunda línea solo ante una decisión, bloqueo, cambio de modo o salto:

```text
Motivo: <hecho concreto>. Siguiente: <acción>.
```

## Cadena de implementación

Crear la lista según scope: back, front, tester ∥ reviewer, QA (script) y cierre. Mostrar
antes de cada `task`:

```text
@<agent> · <acción> · <actual>% → <siguiente>%
```

No repetir outputs esperados, estimaciones, “currently doing”, “up next” ni banners
ASCII: la lista ya contiene esa información.
