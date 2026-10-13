# Feature Specification: Raíces de sesión siempre listables, subárbol completo y paralelismo por invocación

**Feature Branch**: `011-fix-session-roots-subtree`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: ".opencode/runs/20261012-fix-session-list-parent-window/prd.md"

## Clarifications

### Session 2026-10-12

- Q: ¿Cómo debe acotar el visor el cargador del subárbol cuando el árbol de una raíz es muy grande? → A: Con un **presupuesto global** de nodos/peticiones por carga del subárbol; al superarlo, el subárbol se trunca y se muestra el aviso, con el umbral enlazado al techo de fluidez (~200 agentes) ya fijado en los contratos de la spec `006`.
- Q: ¿Cómo debe tratarse el desajuste entre la barra temporal del nodo (intervalo de sesión) y la ventana de la invocación que agrupa filas y badge? → A: Se **documenta**: la paridad exigida es fila ↔ badge (ambas por invocación); la barra del nodo mantiene el intervalo de sesión y la diferencia queda explícita en los contratos. No se unifica ni se reabre el modelo del grafo.
- Q: ¿Con qué presupuesto se pagina el listado de raíces antes de declararlo truncado? → A: Tope acotado en páginas (**200 raíces por página × 25 páginas → techo de 5.000 raíces** por directorio), con el mismo patrón de cursor que la paginación existente; al alcanzar el tope, el corte se declara.
- Q: ¿Qué debe hacer el aviso de truncamiento para cumplir "persistente y no intrusiva"? → A: Solo estado "incompleto": **aviso informativo puro**, sin cifras (nada de "N de M") y sin acción, no bloqueante, entre la cabecera y el lienzo del grafo, sobre el componente de alerta compartido en variante de advertencia, con `role="status"` y `aria-live="polite"` (patrón de ConnectionBadge); el grafo sigue usable. El corte del listado de raíces recibe el mismo tratamiento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver todas las raíces del proyecto en el listado (Priority: P1)

Como analista que revisa ejecuciones multi-agente, quiero que el listado de sesiones me muestre **todas las sesiones raíz** del proyecto y ninguna hija, para poder abrir cualquiera sin depender de qué sesiones fueron las últimas en tener actividad.

**Why this priority**: es el defecto de origen. Hoy la vista pide una ventana de sesiones recientes sin distinguir raíces de hijas; como las hijas de subagentes son la enorme mayoría, desplazan a las raíces antiguas fuera del listado y esas ejecuciones se vuelven inalcanzables navegando.

**Independent Test**: abrir el listado sobre un proyecto con R raíces y H hijas (H mucho mayor que R) y verificar que aparecen las R raíces y ninguna hija, con el orden por última actividad descendente dentro de cada carpeta.

**Acceptance Scenarios**:

1. **Given** un proyecto con R raíces y muchas más hijas, **When** se abre el listado de sesiones, **Then** se listan las R raíces y **ninguna** hija.
2. **Given** un proyecto donde las hijas creadas recientemente superan con creces a las raíces, **When** se abre el listado, **Then** las raíces antiguas (las que antes quedaban fuera de la ventana) siguen siendo visibles.
3. **Given** un listado con varias carpetas de proyecto, **When** se muestran las raíces, **Then** dentro de cada carpeta el orden es por última actividad descendente.
4. **Given** un proyecto cuyo volumen se acerca al máximo que el visor decide cargar, **When** el listado se corta por ese tope, **Then** el corte se declara al usuario en lugar de mostrar un listado incompleto como si fuera completo.

---

### User Story 2 - Abrir por enlace directo una raíz que no está en el listado (Priority: P1)

Como analista, quiero que abrir la URL de una sesión raíz que no aparece en el listado cargue su grafo, para poder compartir e inspeccionar cualquier ejecución sin depender del listado.

**Why this priority**: hoy el resultado es un estado de carga sin salida. El directorio de la sesión se resuelve solo desde las raíces ya listadas; si la sesión no está en el listado, la consulta queda deshabilitada y la pantalla muestra un esqueleto de carga indefinido, sin error ni vacío: la ejecución es inobservable por enlace directo.

**Independent Test**: abrir `?id=<raíz fuera del listado>` y comprobar que la vista muestra esa raíz y su subárbol; abrir `?id=<sesión inexistente>` y comprobar un estado "no encontrada" con salida al listado.

**Acceptance Scenarios**:

1. **Given** una sesión raíz que no está en el listado, **When** se abre su URL, **Then** la vista muestra esa raíz y su subárbol, sin quedar en carga indefinida.
2. **Given** una sesión descendiente que no es raíz, **When** se abre su URL, **Then** se resuelve su directorio y se muestra su subárbol desde la raíz correspondiente.
3. **Given** un identificador de sesión que no existe, **When** se abre su URL, **Then** se muestra un estado "no encontrada" con una acción para volver al listado, distinto de "sin agentes".

---

### User Story 3 - Estados de pantalla honestos ante enlace raro o fallo de red (Priority: P1)

Como analista, quiero que la vista de grafo siempre tenga una salida visible (datos, vacío con acción o error con reintento) para no quedarme mirando un esqueleto que nunca termina.

**Why this priority**: un estado de carga sin salida oculta tanto el éxito como el fallo; sin estados honestos, el usuario no puede distinguir "todavía cargando" de "esta sesión no existe" o "la red falló", y no tiene forma de recuperarse.

**Independent Test**: provocar los tres caminos (directorio aún desconocido, sesión inexistente, error de red) y verificar que cada uno muestra su estado con una salida.

**Acceptance Scenarios**:

1. **Given** una sesión cuyo directorio todavía se está resolviendo, **When** transcurre un tiempo acotado de carga, **Then** se muestra una carga acotada y, al resolver, los datos.
2. **Given** un fallo de red al resolver la sesión o su estructura, **When** la consulta falla, **Then** se muestra un estado de error con una acción de reintento.
3. **Given** una sesión que no existe, **When** se abre su URL, **Then** se muestra "no encontrada" con acción para volver al listado.
4. **Given** cualquier combinación de los casos anteriores, **When** la pantalla queda en carga, **Then** la carga siempre termina en datos, error o vacío con acción (nunca un esqueleto terminal).

---

### User Story 4 - Ver el subárbol completo o saber que está truncado (Priority: P2)

Como analista, quiero que el grafo de una raíz incluya todo su subárbol, o que me avise de forma persistente si se cortó, para poder confiar en lo que veo.

**Why this priority**: un subárbol vacío o recortado en silencio induce a conclusiones falsas sobre qué se ejecutó. Es menos crítico que poder abrir la sesión, pero ataca directamente la función de observabilidad.

**Independent Test**: abrir una raíz con descendientes fuera de la ventana de sesiones y verificar que el grafo incluye todo el subárbol; forzar el tope del cargador y verificar que aparece un aviso persistente de subárbol incompleto.

**Acceptance Scenarios**:

1. **Given** una raíz con descendientes que no están en el listado de sesiones, **When** se abre su grafo, **Then** el grafo incluye todo el subárbol alcanzable, no un grafo vacío ni uno cortado.
2. **Given** un subárbol cuyo tamaño hace que el cargador toque su tope, **When** se muestra el grafo, **Then** aparece un aviso persistente de que el subárbol está incompleto.
3. **Given** un subárbol completo, **When** se muestra el grafo, **Then** no aparece ningún aviso de truncamiento.

---

### User Story 5 - Paralelismo por invocación, no por sesión (Priority: P2)

Como analista, quiero que las filas paralelas representen **invocaciones** (una llamada de subagente/tarea del padre) y no sesiones, para no confundir pasos secuenciales con pasos paralelos ni perder un paralelismo real.

**Why this priority**: cuando una sesión hija se reanuda en varios pasos del padre, agrupar por sesión dibuja un único intervalo largo que se solapa con los vecinos y **fusiona pasos secuenciales** en una misma fila paralela. El grafo miente sobre qué corrió en paralelo, que es su propuesta de valor.

**Independent Test**: con un padre que invoca subagentes en pasos distintos e incluye una hija reutilizada en dos pasos, verificar que cada invocación es una unidad: los dos pasos no comparten fila ni lote, y filas y badge coinciden.

**Acceptance Scenarios**:

1. **Given** un padre que lanza 2+ subagentes en el mismo paso, **When** se muestra el grafo, **Then** esas invocaciones comparten fila y cuenta como un lote paralelo.
2. **Given** una hija reutilizada en dos pasos distintos del mismo padre, **When** se muestra el grafo, **Then** aporta **dos invocaciones** (no un intervalo largo) y los dos pasos quedan en filas/lotes distintos.
3. **Given** pasos secuenciales (sin solape), **When** se muestra el grafo, **Then** no se fusionan en una misma fila paralela.
4. **Given** cualquier sesión observada, **When** se compara la fila con el badge de paralelismo del mismo nodo, **Then** ambos dicen lo mismo (paridad fila ↔ badge).
5. **Given** un padre cuyos mensajes todavía no se cargaron, **When** se muestra el grafo, **Then** el agrupamiento se mantiene (respaldo) y no hay regresión del comportamiento estructural.

---

### User Story 6 - Ver las skills cargadas de un agente y su coste aproximado (Priority: P3)

Como analista, quiero que el Inspector liste las skills que la sesión **cargó**, con una estimación de tokens, para entender qué instrucciones entraron al contexto y cuánto costaron.

**Why this priority**: hoy la sección de skills siempre aparece vacía, así que una fuente de contexto relevante es invisible; no bloquea la observabilidad de la ejecución, pero completa el detalle del agente.

**Independent Test**: abrir el Inspector de una sesión con una skill cargada y verificar `nombre · ~N tokens`; abrir una sesión sin skills cargadas y verificar el texto "Sin skills cargadas".

**Acceptance Scenarios**:

1. **Given** una sesión que cargó una skill, **When** se abre su Inspector, **Then** la skill aparece con su nombre y una estimación de tokens rotulada como aproximada.
2. **Given** una skill cargada varias veces, **When** se abre el Inspector, **Then** se reflejan las repeticiones.
3. **Given** una carga de skill rechazada o fallida, **When** se abre el Inspector, **Then** esa skill **no** cuenta como cargada.
4. **Given** una sesión sin skills cargadas, **When** se abre el Inspector, **Then** se muestra "Sin skills cargadas".
5. **Given** una sesión que solo cargó skills (sin otras secciones con contenido), **When** se abre el Inspector, **Then** la sección de skills no queda oculta por el resto de secciones vacías.

---

### Edge Cases

- **Proyecto con un volumen grande de hijas**: el listado debe mostrar todas las raíces aunque la cantidad de hijas sea muy superior; el tope de carga del listado, si se alcanza, se declara con el mismo aviso informativo puro (no bloqueante, sin acción ni cifras).
- **Raíz fuera de la ventana reciente**: debe abrirse por enlace directo sin depender de estar en el listado.
- **Sesión inexistente**: se distingue de "sin agentes" y ofrece volver al listado.
- **Fallo de red** al resolver el directorio o la estructura del subárbol: error con reintento, no carga indefinida.
- **Cargador de subárbol en su tope**: el tope es un **presupuesto global** de nodos/peticiones por carga (no un tope por padre), alineado al techo de fluidez (~200 agentes) de los contratos previos; al alcanzarlo, aviso persistente de subárbol incompleto (no recorte silencioso). El aviso es informativo puro (sin acción ni cifras del tipo "N de M"), no bloqueante, entre la cabecera y el lienzo del grafo, sobre el componente de alerta en variante de advertencia, con `role="status"` y `aria-live="polite"`.
- **Hija reutilizada en dos pasos del padre**: el nodo del grafo sigue siendo único por sesión, pero aporta **varios intervalos de invocación** y participa en **dos lotes**; nunca un único intervalo largo que fusione pasos.
- **Pasos secuenciales de un mismo padre**: el agrupamiento usa el solape real de las invocaciones; no deben caer en la misma fila.
- **Barra del nodo frente a la ventana de la invocación**: la barra temporal del nodo sigue el intervalo de la sesión mientras las filas y el badge lo hacen por invocación; la diferencia se documenta (la paridad exigida es solo fila ↔ badge) y no se unifica en esta feature.
- **Tiempos de cierre de una invocación**: el fin de la invocación es el fin de la **tool call del padre**; cuando difiere del fin de la sesión hija (mediana 10 ms en foreground) gana el de la tool call; si alguna vez aparece una invocación en segundo plano, el fin pasa a ser el máximo entre el fin de la tool call y el fin de la sesión hija.
- **Skills identificadas por nombre o por identificador**: ambas formas de nombrar la skill en la carga deben reconocerse; perder una de las dos ocultaría skills reales.
- **Skills en estado de error o denegadas**: se excluyen del conteo de skills cargadas.
- **Estimación de tokens no disponible**: la fila muestra solo el nombre, sin inventar un número.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El listado de sesiones MUST componerse de todas las **raíces** del proyecto; las hijas MUST NOT ocupar la ventana del listado.
- **FR-002**: El listado MUST ser completo con independencia del volumen del proyecto, o declarar de forma visible que se truncó. El listado MUST paginarse con un tope acotado (**200 raíces por página × 25 páginas; techo de 5.000 raíces por directorio**), siguiendo el patrón de paginación por cursor ya existente; al alcanzar el tope, el corte MUST declararse de forma visible con el **mismo aviso informativo puro** que el subárbol (no bloqueante, sin acción y sin cifras) y las mismas garantías de anuncio.
- **FR-003**: El directorio de una sesión MUST resolverse a partir de la propia sesión cuando esta no está en el listado.
- **FR-004**: Todo estado de carga de la vista de grafo MUST tener salida (datos, error o vacío con acción); MUST NOT existir un estado de carga terminal sin salida.
- **FR-005**: Una sesión inexistente MUST distinguirse de "sin agentes" y MUST ofrecer una acción para volver al listado.
- **FR-006**: El subárbol cargado para una sesión MUST ser completo; si se trunca, el truncamiento MUST declararse de forma persistente y no intrusiva. El tope MUST ser un **presupuesto global** de nodos/peticiones por carga del subárbol (no un tope por padre), enlazado al techo de fluidez (~200 agentes) ya fijado en los contratos previos. El aviso MUST ser **informativo puro** (sin acción y sin cifras del tipo "N de M"), no bloqueante, situado entre la cabecera y el lienzo del grafo, pintado sobre el componente de alerta compartido en variante de advertencia, con `role="status"` y `aria-live="polite"` para no interrumpir; el grafo MUST seguir usable con el aviso visible.
- **FR-007**: La unidad de paralelismo MUST ser la **invocación** (una llamada de subagente/tarea del padre); una sesión reutilizada en varios pasos MUST aportar varias invocaciones, no una sola. El nodo del grafo MUST seguir siendo único por sesión, pero MUST participar en tantos lotes como pasos la invocaron.
- **FR-008**: Las filas y el badge de paralelismo MUST derivarse de la misma unidad (paridad fila ↔ badge), incluyendo la actualización cuando llegan los datos del padre aunque la estructura del grafo no cambie. La paridad exigida es fila ↔ badge, **no** barra ↔ fila: la barra temporal del nodo MUST mantener el intervalo de la sesión y su diferencia con la ventana de la invocación MUST quedar explícita y documentada en los contratos; MUST NOT unificarse en esta feature.
- **FR-009**: El Inspector MUST listar las skills **cargadas** por la sesión, con el conteo de repeticiones y una estimación de tokens.
- **FR-010**: La estimación de tokens MUST rotularse como aproximada (nunca como coste real) y MUST NOT usarse como métrica de coste.
- **FR-011**: El agrupamiento MUST NOT fusionar en una misma fila pasos secuenciales de un mismo padre.
- **FR-012**: El sistema MUST mantener un comportamiento de respaldo para los casos en que los datos de invocación aún no estén disponibles, de modo que el grafo estructural no regresione.
- **FR-013**: El contrato de carga del grafo (spec `006-graph-render-performance`) MUST actualizarse: el origen estructural deja de ser el listado global del proyecto y pasa a ser el subárbol de la sesión abierta.
- **FR-014**: El contrato de filas de ejecución (spec `007-fix-parallel-lanes-live`) MUST actualizarse: el agrupamiento de paralelos deja de ser únicamente por solape de intervalos de sesión y pasa a basarse en invocaciones (con respaldo por sesión).
- **FR-015**: El costo de refresco de la lista al crearse sesiones nuevas MUST NOT aumentar respecto del comportamiento actual (la lista es más pequeña que la ventana reemplazada).
- **FR-016**: El fin de una invocación MUST definirse como el fin de la tool call del padre en la sesión padre; si la invocación corre en segundo plano, el fin MUST ser el máximo entre el fin de la tool call y el fin de la sesión hija.

### Key Entities *(include if data involved)*

- **Sesión raíz**: sesión del proyecto sin padre; unidad listable y punto de entrada al grafo.
- **Sesión descendiente (hija)**: sesión creada por una invocación de otra sesión; no es listable por sí misma, pero es un nodo del subárbol.
- **Directorio de proyecto**: contexto al que pertenece una sesión; determina qué raíces se listan.
- **Subárbol**: conjunto de la raíz y todos sus descendientes alcanzables; puede estar completo o truncado.
- **Invocación**: llamada de subagente/tarea hecha por una sesión padre; expone sesión hija, paso que la origina, instante de inicio y de fin (fin = fin de la tool call del padre), y estado.
- **Lote paralelo**: conjunto de invocaciones lanzadas en el mismo paso del padre (2 o más); unidad de la fila paralela y del badge.
- **Skill cargada**: skill que entró al contexto de una sesión; expone nombre, cantidad de cargas, primer instante de carga y estimación aproximada de tokens.
- **Aviso de truncamiento**: señal persistente, no intrusiva y no bloqueante de que el resultado mostrado (subárbol o listado de raíces) está incompleto; informativa pura (sin acción ni cifras), anunciada como estado y situada entre la cabecera y el lienzo del grafo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las raíces del proyecto aparecen en el listado; 0 hijas aparecen en el listado. (El número de raíces del proyecto medido es un blanco móvil: el criterio habla de "todas las raíces", no de una cifra fija.)
- **SC-002**: 0 casos de carga terminal sin salida (esqueleto indefinido) al abrir cualquier sesión por enlace directo, incluida una raíz que no está en el listado.
- **SC-003**: 0 casos de pasos secuenciales de un mismo padre presentados como una misma fila paralela en las ejecuciones revisadas.
- **SC-004**: El 100% de las sesiones observadas cumple paridad entre fila y badge de paralelismo (mismo veredicto en ambos).
- **SC-005**: El volumen de datos descargados por refresco del listado se reduce al de las raíces del proyecto (≥70 % menos en el proyecto medido).
- **SC-006**: El 100% de los subárboles abiertos es completo o muestra el aviso persistente de truncamiento; 0 recortes silenciosos. El truncamiento MUST activarse por el presupuesto global de nodos/peticiones, nunca por un tope por padre.
- **SC-007**: El inspector muestra las skills cargadas en el 100% de las sesiones observadas que cargaron al menos una skill, con estimación rotulada como aproximada.
- **SC-008**: La suite de pruebas del proyecto pasa sin cambios en los comportamientos preexistentes más allá de los agregados y las actualizaciones de contrato previstas.
- **SC-009**: 0 listados de raíces mostrados como completos estando truncados: el 100% de los cortes por presupuesto (de la lista de raíces o del subárbol) se declara al usuario mediante un aviso visible, no bloqueante y anunciado como estado (`role="status"`, `aria-live="polite"`), sin acción ni cifras.

## Assumptions

- El pedido original aprobado (`.opencode/runs/20261012-fix-session-list-parent-window/pedido.md`) es fuente de alcance cuando este documento es silencioso.
- La cifra de sesiones/raíces/hijas del store es un blanco móvil; los criterios se redactan sobre "todas las raíces" y no sobre un número fijo.
- El árbol del proyecto medido es **plano** (raíces con hijos directos y sin nietos); el comportamiento para árboles profundos se soporta pero se valida con el bosque medido.
- El caso de invocación en segundo plano (`background`) no está presente en los datos medidos (0 casos): el fin de la invocación es el de la tool call del padre; el respaldo `max(tool call, sesión hija)` se documenta y no se generaliza.
- Está fuera de alcance: el modelo de datos del grafo, el layout y las métricas derivadas; la paginación de mensajes; las vistas de Chat/History; las skills **permitidas/configuradas** por la definición del agente (solo las cargadas); coalescer las invalidaciones en vivo (queda como seguimiento).
- Es frontend + pruebas: no hay backend propio; se consume el servidor de OpenCode existente.
- Se respeta la arquitectura y las convenciones vigentes (Principios II–VII de la constitución): datos vía hooks, lógica pura y testeable fuera de componentes, estados de pantalla explícitos, sin encarecer el refresco por evento.
- La utilidad existente de filtrado de subárbol se conserva por compatibilidad de la API pública del dominio y recibe su propia cobertura de pruebas.
