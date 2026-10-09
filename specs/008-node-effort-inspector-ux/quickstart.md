# Quickstart — Live Node Feedback, Effort Levels & Detail Panel UX

**Feature**: `008-node-effort-inspector-ux`
**Objetivo**: validar de extremo a extremo que (1) los nodos activos muestran una animación continua, (2) el follow enfoca el activo más reciente, (3) el panel de detalle se redimensiona y se persiste, (4) el panel se expande a pantalla completa y vuelve, (5) el diff se lee como en un editor y (6) cada nodo muestra un nivel de esfuerzo de 1 a 5 legible de un vistazo.

Referencias: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [design-direction.md](./design-direction.md).

---

## Prerrequisitos

- Node.js y dependencias instaladas: `npm install`.
- Para la validación manual: una instancia de OpenCode server accesible vía el proxy de Vite (`OPENCODE_URL`).
- Una **muestra de ejecución representativa**:
  - una ejecución **en curso** con varios nodos activos coincidentes;
  - un nodo que **lanza subagentes en paralelo**;
  - un nodo claramente **más lento** que el más rápido de su tanda;
  - un nodo con **muchas invocaciones de herramientas** o muchos hijos;
  - un nodo que **modifica archivos** (idealmente con varios hunks, un archivo añadido y uno borrado).
- Navegador con DevTools y la preferencia de **movimiento reducido** accesible desde el sistema.

---

## 1. Validación automatizada (obligatoria)

```bash
# Dominio Graph (animación, follow, esfuerzo, comparador, cardHeight)
npx vitest run src/Domains/Graph

# Dominio Inspector (parser de diff, render, encabezado del panel)
npx vitest run src/Domains/Inspector

# Estado del panel y layout
npx vitest run src/Infrastructure src/Application

# Puerta de calidad del repo
npm test
npm run tsc
npm run lint
```

**Esperado**: verde. Los specs de esta feature:

- `effort.spec.ts` (**nuevo**) — escala acumulativa, tope 5, línea de uno, duración ausente, provisionalidad (S1..S7).
- `activeNode.spec.ts` (**nuevo**) — `latestActiveNodeId` = mayor `startOf`; `null` sin activos (E1, E2).
- `parseDiff.spec.ts` (**nuevo**) — hunks, numeración doble, `\ No newline`, patch vacío, entrada inesperada (D1..D5).
- `panelWidth.spec.ts` (**nuevo**) — clamp por debajo/encima y `NaN` (P1).
- `reconcileGraph.spec.ts` (**extendido**) — `sameEffort` y su efecto en `sameNodeData` (S8).
- `cardHeight.spec.ts` (**extendido**) — el medidor no añade filas; `STATUS_WIDTH` reserva su ancho (S10, A4).
- `useFollowMode.spec.tsx` (**extendido**) — se dispara al cambiar el id y no con el mismo; reactivar enfoca el más reciente (E3, E4).
- `useGraphModel.spec.tsx` (**extendido**) — `latestActiveNodeId`; identidad de nodo estable ante tick sin cambio de nivel (E1, S11).
- `useInspectorPanel.spec.tsx` (**nuevo**) — arrastre, persistencia, teclado, fullscreen efímero (P2..P4, P8).
- `Specs de componentes` (`AgentNode`, `EffortMeter`, `FileDiff`, `FileChanges`, `InspectorPanel`, `WorkspacePage`) — `.rail-scan` solo en activos (A1, A2), medidor y `aria-label` (S9), diff por tipo/estado (D6..D9), fullscreen conserva estados (P5..P7).

Opcional, si hay server real disponible:

```bash
npm run test:live   # integración contra el server vía VIZ_API_URL + OPENCODE_PASSWORD
```

---

## 2. Validación manual

### US1 — Esfuerzo de un vistazo (P1 · FR-021..FR-028, SC-002)

1. Abrir una ejecución con nodos en serie, un nodo que lanza paralelos y un nodo > 2× el más rápido de su línea.
   - **Esperado**: cada nodo muestra un **medidor de 5 muescas** con un nivel distinto; se lee sin abrir el detalle.
2. Con la ejecución en curso, mirar los nodos de una tanda abierta.
   - **Esperado**: el nivel se presenta **provisional** (muescas atenuadas + marca) y se recalcula al cerrarse los tiempos.
3. Inspeccionar un nodo con muchos hijos/invocaciones.
   - **Esperado**: su nivel es mayor que el de un nodo simple (forma alta), sin superar 5.
4. Pasar el foco/lector por el medidor.
   - **Esperado**: anuncia "Esfuerzo N de 5: …"; el medidor **no** es un control editable.

### US2 — Nodos trabajando ahora (P1 · FR-001..FR-004, SC-001)

1. Observar un nodo activo.
   - **Esperado**: el rail muestra un **barrido continuo** de brillo en color de actividad.
2. Esperar a que el nodo termine o falle.
   - **Esperado**: la animación se detiene.
3. Activar **movimiento reducido** y volver a observar nodos activos.
   - **Esperado**: rail en color de actividad **sólido y estático**, sin movimiento.

### US3 — Follow al activo más reciente (P1 · FR-005..FR-009, SC-003)

1. Activar "Seguir" cuando hay un nodo activo.
   - **Esperado**: el viewport enfoca el nodo activo **más reciente** (mayor hora de inicio).
2. Mientras corre, un nodo activo anterior queda atrás y aparece otro.
   - **Esperado**: el enfoque se mueve al nuevo activo, sin reposicionar el resto del grafo.
3. Dejar llegar eventos sin cambio de nodo activo.
   - **Esperado**: el viewport **no** se reposiciona ni "tiembla".
4. Desactivar y reactivar el seguimiento.
   - **Esperado**: al reactivar enfoca el activo más reciente de ese momento. Sin nodos activos, el viewport no se mueve.

### US4 — Diff estilo editor (P2 · FR-016..FR-020, SC-004)

1. Seleccionar un archivo modificado.
   - **Esperado**: canal doble de números (viejo/nuevo), añadidas/eliminadas distinguibles por color, fondo por línea.
2. Un diff con varios bloques.
   - **Esperado**: cada bloque tiene encabezado con su rango y chevron; **expandidos por defecto**; se colapsan/expanden por teclado.
3. Un archivo añadido y uno borrado.
   - **Esperado**: estado distinguible por punto LED/etiqueta.
4. Un archivo sin salto de línea final, un archivo sin cambios de contenido o binario.
   - **Esperado**: el diff no se rompe ni muestra líneas espurias; sin patch → "parche no disponible".

### US5 — Ajustar el ancho del panel (P2 · FR-010..FR-012, SC-005)

1. Arrastrar el separador del panel.
   - **Esperado**: el ancho cambia siguiendo el arrastre dentro de mínimo/máximo; el contenido y el grafo no se alteran.
2. Recargar la app.
   - **Esperado**: el ancho ajustado **se conserva**.
3. Focalizar el separador y usar `←`/`→`.
   - **Esperado**: el ancho ajusta por pasos (operable por teclado).

### US6 — Pantalla completa del panel (P3 · FR-013..FR-015, SC-005)

1. Con un nodo seleccionado, pulsar expandir.
   - **Esperado**: el panel ocupa el área de trabajo conservando encabezado, contenido y estado de pantalla.
2. Con el panel expandido, llegan eventos.
   - **Esperado**: se mantiene el estado correcto (carga/error/vacío/datos).
3. Pulsar el mismo control o `Escape`.
   - **Esperado**: vuelve al layout normal. **Recargar** arranca en layout normal (el fullscreen no se persiste).

### Edge cases

- **Sin nodos activos**: ni animación ni movimiento de viewport.
- **Cambio rápido entre activos**: el enfoque no encadena movimientos por cada evento.
- **Activo que se completa mientras el enfoque va hacia él**: no falla ni deja la vista fuera de sitio.
- **Esfuerzo con duración abierta/desconocida**: provisional; nunca indefinido.
- **Línea con un solo nodo**: no se infla el nivel.
- **Nodos paralelos sin duración**: el nivel no queda indefinido.
- **Diff vacío/binario/rename-only**: no rompe el render.
- **Resize en ventana pequeña/móvil**: el patrón de presentación sigue siendo usable.
- **Fullscreen en estado de error o vacío**: conserva el estado de pantalla correcto.

---

## 3. Criterios de aceptación (resumen)

| Criterio | Cómo se valida |
|----------|----------------|
| SC-001 | Animación perceptible en < 2 s del paso a activo (US2; spec A1/A2). |
| SC-002 | Nivel distinguible en < 2 s sin abrir el detalle (US1; specs S1..S9). |
| SC-003 | El activo más reciente permanece visible en el 100 % de los cambios (US3; specs E1..E4). |
| SC-004 | Diff de hasta 20 archivos legible en < 1 s (US4; specs D1..D9). |
| SC-005 | Ancho a medida o fullscreen en una interacción, y vuelta en una (US5/US6; specs P2..P7). |
| SC-006 | Sin degradación perceptible a ~150 nodos (identidad estable; specs S8/S11 + medición manual). |
| SC-007 | Controles nuevos operables por teclado y anunciados (separador, expandir/colapsar, hunks; specs P4/P7/D7). |
| SC-008 | Cubierto por pruebas de reglas reales (esfuerzo, follow, diff, resize). |

---

## 4. Salida esperada

- Specs verdes, `tsc`/`lint` sin errores.
- Confirmación manual de SC-001..SC-008 sobre la muestra.
- Evidencia (capturas/notas) de: barrido en nodos activos, medidor de esfuerzo con nivel por nodo, follow al más reciente, ancho persistido tras recargar y diff con hunks expandidos.
