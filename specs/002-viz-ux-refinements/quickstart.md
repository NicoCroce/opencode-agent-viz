# Quickstart & Validation — Refinamientos de experiencia del visor

Guía para validar la feature de punta a punta. Los detalles de contrato están en
[contracts/](./contracts/) y el modelo de datos en [data-model.md](./data-model.md).

## Prerrequisitos

- Node instalado; dependencias: `npm install`.
- Un servidor local de OpenCode disponible en `http://127.0.0.1:4096` (el proxy Vite mapea `/oc`).
- Una sesión raíz con al menos un subagente y **más de 10** ejecuciones de herramientas, para cubrir US2 y US3.
- Fixture de eventos real ya versionado: `src/Domains/Graph/lib/__fixtures__/run.ndjson`.

## Comandos

```bash
npm install
npm run dev       # levanta Vite con proxy /oc → 127.0.0.1:4096
npm run tsc       # typecheck estricto
npm run lint      # ESLint strict
npm test          # Vitest (unit + componentes + hooks)
```

## Escenarios de validación

### V1 — Resize del nodo (US1, FR-001..FR-004, SC-001/002)

1. Abre una sesión con un nodo cuyo contenido no entra en el tamaño por defecto.
2. Pasa el cursor sobre el nodo → aparecen los tiradores de resize en esquina/borde.
3. Arrastra una esquina y un borde → el nodo cambia de ancho y alto; el contenido se ve completo y sin superposición.
4. Mientras el agente sigue en vivo, llega nueva actividad → **el tamaño elegido se mantiene** (no se revierte).
5. Cambia de sesión y vuelve → el nodo recupera su tamaño por defecto (el ajuste no se filtra entre sesiones).
**Esperado**: 0 reversiones de tamaño durante una ejecución activa; el contenido deja de recortarse.

### V2 — Modo cadena (US2, FR-005..FR-008, SC-003/004)

1. Con un grafo con ramas, selecciona un nodo con al menos un ancestro.
2. Observa que **solo** quedan los nodos y conexiones de la cadena raíz→nodo, alineados en una sola fila y en orden de ejecución.
3. Verifica que el nodo seleccionado se distingue de sus ancestros.
4. Haz clic en el fondo del grafo → vuelve el grafo completo.
5. Repite la selección y presiona `Escape` → vuelve el grafo completo.
6. Selecciona la raíz (cadena de un solo nodo) → la vista sigue siendo legible.
**Esperado**: identificar la cadena completa en < 10s, sin zoom ni scroll manual; volver con un solo gesto.

### V3 — Historial de herramientas (US3, FR-009..FR-012, SC-005)

1. Abre el inspector de un nodo con más de 10 herramientas.
2. Verifica que se ven **solo las 10 primeras** en el orden cronológico actual y un control `"Ver N más"`.
3. Actívalo → se despliegan hacia abajo las restantes y el control pasa a `"Ver menos"`.
4. Contráelo → vuelven a verse 10.
5. Abre un nodo con exactamente 10 (o menos) herramientas → no aparece el control.
**Esperado**: la herramienta número 11 se alcanza con un solo clic.

### V4 — Tarjeta de sesión (US4, FR-013, SC-006)

1. Mira la lista de sesiones: en cada tarjeta el **título** está arriba y el **agente** abajo.
2. Busca una sesión sin agente reportado → la línea del agente muestra `"agente no disponible"` (no queda en blanco).
**Esperado**: reconocer nombre y agente en < 3s por tarjeta.

### V5 — Rango horario (US5, FR-014..FR-016, SC-007/008)

1. Sesión terminada → la tarjeta muestra `"HH:mm – HH:mm"` con hora de inicio y fin real.
2. Nodo terminado → el nodo muestra el mismo rango junto a la duración.
3. Nodo que sigue en ejecución → el rango se muestra como `"HH:mm – en curso"` (la hora final no cambia sola).
4. Un origen sin alguna de las horas (y no en curso) → se indica `"no disponible"` en el extremo faltante.
**Esperado**: rango correcto en el 100% de sesiones/nodos con ambas horas; `"no disponible"` distinguible de una hora real.

### V6 — Regresiones y responsive (FR-017..FR-020, SC-009)

1. Provoca error/loading/vacío de conexión o datos → cada vista afectada conserva sus estados obligatorios.
2. En viewport móvil, las mismas mejoras son utilizables vía tabs (Sessions | Graph | Inspector), sin duplicar lógica.
3. Verifica que ninguna mejora envía prompts, aborta sesiones ni responde permisos (solo lectura).

## Tests automáticos esperados

- `chainGraph.spec.ts` — orden raíz→nodo, raíz sola, nodo ausente → `null`, ignora hermanos/descendientes, fila (`y` constante, `x` creciente).
- `nodeResize.spec.ts` — dimensiones, posición de resize, cambios ignorados, inmutabilidad.
- `formatTimeRange.spec.ts` — ambos extremos, en curso, faltantes, formato `HH:mm`.
- `useToolHistory.spec.tsx` — 0/10/11 entradas, `hiddenCount`, `canExpand`, toggle, orden.
- `ToolHistory.spec.tsx` — 10 visibles + control con 11, sin control con 10, expandir revela el resto.
- `AgentNode.spec.tsx` — rango horario en el nodo y tirador de resize presente.
- `SessionCard.spec.tsx` — título arriba / agente abajo / `"agente no disponible"` / rango.
- `useNodeResize.spec.tsx`, `useChainSelection.spec.tsx` — reset por sesión y modo cadena.

## Criterio de "listo"

Todos los escenarios V1–V6 se cumplen; `npm run tsc`, `npm run lint` y `npm test` pasan; y las SC-001..SC-009 de [spec.md](./spec.md) son verificables.
