---
name: progress-tracker
description: Muestra el progreso compacto de flujos por fases y cadenas de subagentes con `todowrite`. Usar al iniciar, cambiar de fase, pausar o delegar en flujos ad-hoc; SddOrch ya incluye estas reglas.
---

# Progress Tracker

Usa `todowrite` como estado visual primario. Actualízalo justo antes de iniciar una fase o delegar y al terminar; un ítem solo se completa con resultado positivo. Las fases no aplicables se completan con `SKIPPED — <motivo>`.

## Fases

Crea una lista con las fases del flujo elegido. El progreso es `round(fases terminadas / total * 100)`.

Informa cada transición en una línea:

```text
Fase <n>/<total> · <estado> · <agente o acción> · <progreso>%
```

Añade una segunda línea solo ante una decisión, un bloqueo, un cambio de modo o un salto:

```text
Motivo: <hecho concreto>. Siguiente: <acción>.
```

## Subagentes en paralelo

Antes de lanzar una tanda, muestra:

```text
Tanda <i>/<n> · <k> subagentes en paralelo · <progreso>%
```

No repitas salidas esperadas, estimaciones ni banners ASCII: la lista ya contiene esa información.
