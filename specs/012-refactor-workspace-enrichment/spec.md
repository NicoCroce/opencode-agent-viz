# Feature Specification: Descomposición de la vista de workspace y del enriquecimiento del grafo

**Feature Branch**: `012-refactor-workspace-enrichment`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Refactor interno sin cambios de comportamiento: descomponer `src/Infrastructure/WorkspacePage.tsx` (~500 líneas, lógica mezclada) y `src/Domains/Graph/Hooks/useGraphEnrichment.ts` (~255 líneas) sin tocar el contrato público, las rutas, `queryKeys` ni `data-testid`."

## Clarifications

### Session 2026-10-13

- Q: ¿Los cinco bloques de vista listados en FR-005 (rail, panel de grafo, panel de inspector, panel de chat, overlay de histórico) deben extraerse obligatoriamente a componentes propios, incluso los que no tienen props ni estado? → A: Sí: cada uno de los cinco bloques MUST vivir en un componente dedicado; la Edge Case 1 (extracción según legibilidad) aplica solo a fragmentos no listados, no a los cinco bloques nombrados. En HEAD los cinco ya son componentes de dominio, así que la obligación se satisface reutilizándolos tal cual.
- Q: FR-005 exige extraer los cinco bloques "a componentes propios", pero en HEAD ya lo son (`SessionsRail`, `GraphPane`, `InspectorPane`, `ChatPanel`, `HistoryOverlay`); ¿se crean cinco wrappers en `Infrastructure/Components/`? → A: No. Cada bloque ya vive en su componente; no se crean wrappers ni se mueven de su dominio (`ChatPanel` permanece en `Domains/Chat`). La obligación de FR-005 se satisface llevando la composición de los cinco slots (más `panel` y `attentionCount`) a un único `WorkspaceView`, sin JSX inline en la página (opción A de `plan.md`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vista de workspace descompuesta, comportamiento idéntico (Priority: P1)

Quien mantiene el visor abre la vista de workspace (rail de sesiones, grafo, inspector, chat e histórico) y obtiene exactamente la misma experiencia que antes: mismas pantallas, mismos estados de carga/error/vacío, mismos `data-testid`, mismos textos y misma navegación. Internamente, los bloques de vista que hoy están escritos dentro de la página pasan a ser componentes propios, y la lógica de datos y de interacción de la página pasa a hooks.

**Why this priority**: Es la mitad del refactor y la de mayor riesgo observable: la página concentra la composición de los cinco paneles y toda la orquestación cross-domain. Si esta parte se rompe, se rompe la vista principal del producto.

**Independent Test**: Ejecutar la suite de pruebas existente de la página (incluida la de rendimiento) sin modificar ningún archivo de prueba y sin cambios de aserciones; la vista responde igual en escritorio y móvil.

**Acceptance Scenarios**:

1. **Given** la vista de workspace abierta en escritorio, **When** el mantenedor recorre rail, grafo, inspector, chat e histórico, **Then** cada panel se muestra con las mismas props, los mismos `data-testid` y los mismos textos que antes del refactor.
2. **Given** un pendiente de permiso o de pregunta en la sesión abierta, **When** se abre la bandeja de pendientes del chat, **Then** el ítem aparece con su origen y su acción, igual que antes.
3. **Given** un nodo seleccionado y/o el panel en pantalla completa, **When** se pulsa `Escape`, **Then** la precedencia se mantiene: con el foco dentro del chat no ocurre nada; si no, se cierra pantalla completa y, solo después, se limpia la selección.
4. **Given** una sesión raíz distinta de la abierta con permisos abiertos, **When** se observa el rail, **Then** el badge de atención por raíz conserva el mismo conteo que antes.

---

### User Story 2 - Enriquecimiento del grafo en piezas puras verificables (Priority: P2)

Quien mantiene el grafo puede verificar por separado cada regla del enriquecimiento: qué nodos ya están listos (ya cargados en esta visita o presentes en caché), cuál es la latencia mediana por agente, cómo se fusionan los datos enriquecidos en un nodo y cómo se fusiona la señal de ejecución. Cada regla se prueba con entradas explícitas, sin depender del ciclo de vida de la vista.

**Why this priority**: Es la parte que hace evolucionable el rendimiento en tiempo real; sin piezas puras, cualquier cambio de enriquecimiento obliga a probar el hook completo.

**Independent Test**: Cada pieza pura nueva tiene su propio archivo de pruebas y pasa de forma aislada; las pruebas existentes del enriquecimiento siguen pasando sin modificarse.

**Acceptance Scenarios**:

1. **Given** un subárbol con mensajes ya cacheados, **When** se calculan los nodos listos, **Then** no se repite la carga de esos nodos y no se abre ninguna consulta nueva.
2. **Given** nodos con muestras de latencia de varios agentes, **When** se calcula la mediana por agente, **Then** los nodos sin muestras propias usan la mediana de su agente y los que no tienen referencia usan el valor nulo.
3. **Given** un nodo sin enriquecer, **When** se fusionan los datos enriquecidos, **Then** el nodo cambia de `pending` a `ready` únicamente si estaba en el conjunto de listos.
4. **Given** un nodo cuyo campo derivado cambia, **When** se compara con la versión previa, **Then** la comparación detecta el cambio y el nodo se vuelve a renderizar.

---

### User Story 3 - Verificación de no regresión del refactor (Priority: P3)

Quien revisa el cambio confirma, sin leer el diff completo, que el refactor no alteró nada observable: la batería de pruebas existente sigue verde, las compuertas de calidad pasan y ningún archivo fuera del alcance fue tocado.

**Why this priority**: Da la garantía de cierre para una feature cuyo único valor es no cambiar comportamiento.

**Independent Test**: Ejecutar las compuertas de calidad del repositorio sobre el árbol de trabajo y comprobar que el conjunto de archivos modificados coincide con el alcance declarado.

**Acceptance Scenarios**:

1. **Given** el árbol de trabajo del refactor, **When** se ejecutan las compuertas de calidad (verificación de tipos, lint y pruebas), **Then** todas quedan en verde sin advertencias nuevas.
2. **Given** el conjunto de archivos modificados, **When** se compara contra el alcance declarado, **Then** solo aparecen los dos archivos objetivo, sus nuevos vecinos (componentes, hooks, piezas puras) y sus pruebas.

---

### Edge Cases

- Bloque de vista inline **no listado** en FR-005 que no tiene props ni estado propios: se decide si merece componente atendiendo a la legibilidad; no se crean componentes genéricos dentro de un dominio. Los cinco bloques nombrados en FR-005 quedan excluidos de este criterio: siempre viven en su componente dedicado (ya existente o nuevo).
- Fragmento de vista compartido entre escritorio y móvil: una sola fuente de lógica y dos presentaciones; nunca dos ramas siempre montadas.
- Lógica cross-domain necesaria para la vista: vive en la infraestructura, no se importa un dominio desde un componente.
- Pieza pura que hoy lee la caché: se parametriza con sus entradas (mensajes, conjunto de listos) para no abrir consultas nuevas.
- Cambio de subárbol con un lote en vuelo: el turno se cancela; los resultados del plan abandonado siguen siendo válidos y reutilizables, pero no bloquean al nuevo plan.
- Nodo sin mensajes, sin muestras o sin estado de sesión: conserva el respaldo por agente o el valor nulo, sin romper el enriquecimiento.
- Campo derivado nuevo en el nodo: si la comparación de reconciliación no lo cubre, el nodo no se vuelve a renderizar.
- Un fallo de red en un lote: el lote permanece pendiente y el estado de pantalla lo gobierna la consulta de sesiones, sin bloquear el resto.
- Cambio de sesión abierta mientras hay pantalla completa o selección: el manejo de `Escape` no debe quedar desactivado de más.

## Requirements *(mandatory)*

### Functional Requirements

**Contrato público y alcance**

- **FR-001**: La vista de workspace MUST conservar el mismo contrato público: mismas props de los componentes consumidos, mismas rutas y mismos `data-testid`.
- **FR-002**: La feature MUST NOT modificar las claves de consulta existentes, ni el copy, ni el comportamiento observable de ninguna interacción.
- **FR-003**: La feature MUST limitarse a los dos archivos objetivo, a las piezas nuevas que extraigan de ellos y a las pruebas asociadas; el resto del plan priorizado queda fuera de alcance.
- **FR-004**: La feature MUST cubrir únicamente frontend y pruebas.

**Descomposición de la vista de workspace**

- **FR-005**: Cada bloque de vista de la página (rail, panel de grafo, panel de inspector, panel de chat y overlay de histórico) MUST vivir en un componente dedicado: los cinco ya existen como `SessionsRail`, `GraphPane`, `InspectorPane`, `ChatPanel` y `HistoryOverlay`, **no** se envuelven en wrappers ni se mueven de su dominio. La página MUST NOT construir JSX inline: la composición de los cinco slots (más `panel` y `attentionCount`) MUST residir en un único componente presentacional `WorkspaceView` en la carpeta de componentes de la infraestructura.
- **FR-006**: La lógica de datos cross-domain de la bandeja de pendientes del chat (permisos listados, permisos sembrados por sesión y preguntas accionables del subárbol) MUST residir en un hook.
- **FR-007**: La atención por nodo y la atención por raíz MUST derivarse en unidades propias, reutilizando la fuente única de atención sin duplicar su derivación.
- **FR-008**: La semilla de selección del chat MUST seguir derivándose del nodo abierto, y con la sesión sin nodo en el grafo MUST equivaler a "no cambiar".
- **FR-009**: El manejo de `Escape` MUST preservar la precedencia actual (foco en el chat → no propaga; luego cerrar pantalla completa; luego limpiar la selección) y MUST seguir activo solo cuando hay pantalla completa o selección.
- **FR-010**: La derivación de las métricas de apertura de sesión y de los datos del overlay de histórico (nodo, linaje, id ausente) MUST residir en hooks, con la misma información que hoy recibe la vista.

**Descomposición del enriquecimiento del grafo**

- **FR-011**: El cálculo de los nodos listos (ya procesados en la visita actual más los que ya están en caché de mensajes) MUST ser una función pura que recibe sus entradas y no abre consultas nuevas.
- **FR-012**: El cálculo de la mediana de latencia por agente MUST ser una función pura y MUST producir un respaldo nulo para los agentes sin muestras.
- **FR-013**: La fusión de los datos enriquecidos en un nodo MUST ser una función pura que devuelve el nodo sin mutarlo y solo cuando el nodo está listo.
- **FR-014**: La fusión de la señal de ejecución MUST ser una función pura separada de la anterior.
- **FR-015**: Las comparaciones de reconciliación (incluida la de datos de nodo) MUST cubrir los campos derivados, de modo que un cambio en ellos provoque re-render.
- **FR-016**: La carga del subárbol MUST mantenerse por lotes priorizados, un lote por turno de reposo.
- **FR-017**: MUST conservarse la semántica "lo vivo gana sobre la siembra": los datos de una ejecución en curso o finalizada prevalecen sobre el contenido sembrado.
- **FR-018**: Un cambio de subárbol o de sesión MUST cancelar el turno en vuelo y reiniciar el progreso del plan, sin bloquearse con el plan abandonado.
- **FR-019**: El enriquecimiento MUST NOT recalcularse por cada avance del reloj; las derivaciones costosas se gobiernan por la identidad de sus entradas.
- **FR-020**: Cada pieza pura nueva MUST tener su propio archivo de pruebas.

**Pruebas y calidad**

- **FR-021**: Las pruebas existentes de la página de workspace (incluida la de rendimiento) y del enriquecimiento del grafo MUST pasar sin modificarse.
- **FR-022**: Las compuertas de calidad del repositorio (verificación de tipos de aplicación y de configuración, lint y pruebas) MUST quedar en verde.
- **FR-023**: Al extraer lógica o vista MUST mantenerse una única fuente de verdad por regla, sin duplicar ni reimplementar derivaciones ya existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las pruebas existentes del alcance pasa sin que se edite un solo caso de prueba previo.
- **SC-002**: El 0 % de las interacciones del usuario cambia de forma observable: los identificadores de prueba, los textos y las rutas permanecen idénticos.
- **SC-003**: El 100 % de las reglas de negocio del enriquecimiento (nodos listos, mediana por agente, fusión de datos, fusión de señal) tiene al menos un caso de prueba aislado y en verde.
- **SC-004**: Las compuertas de calidad del repositorio terminan con 0 errores y sin advertencias nuevas.
- **SC-005**: El 100 % de los archivos modificados pertenece al alcance declarado; 0 archivos ajenos al refactor se ven alterados.
- **SC-006**: Las dos unidades descompuestas dejan de mezclar vista y lógica: la vista queda sin lógica de datos y la pieza de enriquecimiento queda sin estado de vista, cada regla en una unidad con una sola responsabilidad.

## Assumptions

- Es un refactor interno sin cambios de comportamiento; se asume que "contrato público" incluye props exportadas, rutas, identificadores de prueba y claves de consulta, que quedan congelados.
- El valor de la feature es de mantenibilidad y verificabilidad; no hay nuevas capacidades de usuario ni cambios de experiencia.
- El trabajo es solo de frontend y pruebas, dentro de las restricciones de la constitución (datos del servidor solo vía consultas en los servicios, lógica en hooks o funciones puras, pruebas en carpetas de pruebas junto al código, tipado estricto).
- Las convenciones del repositorio descritas en el documento de convenciones y la constitución aplican sin excepciones; toda decisión de extracción las respeta.
- Las pruebas existentes listadas en el alcance son la red de seguridad del refactor y no deben reescribirse para "acomodar" cambios.
- El conjunto de archivos del plan priorizado ajeno a esta feature no se toca; no se aprovechan "arreglos de paso".
