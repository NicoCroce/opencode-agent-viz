# Feature Specification: Filtros de proyecto y recencia en el listado de sesiones

**Feature Branch**: `005-session-filters`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Quiero que en el listado de sesiones, agregues un filtro para poder seleccionar los proyectos que puedo visualizar. También un filtro temporal para filtrar por sesiones más recientes."

## Clarifications

### Session 2026-10-07

- Q: ¿Sobre qué fecha debe evaluarse el rango temporal? → A: Última actividad de la sesión (no su creación).
- Q: ¿El rango temporal debe recalcularse en vivo mientras la página está abierta, o congelarse al aplicar el filtro? → A: Ventana rodante en vivo: se recalcula contra la hora actual mientras la página está abierta.
- Q: ¿Cómo se identifica cada proyecto dentro del filtro? → A: Nombre de carpeta como etiqueta principal y ruta completa como texto secundario, para resolver homónimos.
- Q: ¿Dónde viven los controles de filtro en la página? → A: Barra de filtros siempre visible, entre el título de la página y el listado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver solo las sesiones de los proyectos que me interesan (Priority: P1)

Como persona que observa ejecuciones de OpenCode en varias carpetas de trabajo, al abrir el listado de sesiones quiero elegir cuáles de esos proyectos quiero ver, para dejar fuera el ruido de los proyectos que no estoy revisando en este momento.

**Why this priority**: Es la primera mitad explícita de la petición. Hoy el listado muestra siempre todos los proyectos que OpenCode conoce, y en cuanto hay más de tres o cuatro carpetas la vista deja de ser legible.

**Independent Test**: Abrir el listado con sesiones en varios proyectos, seleccionar un único proyecto y comprobar que solo permanecen visibles sus sesiones y que los grupos del resto desaparecen. Entrega valor por sí sola: la vista ya queda acotada.

**Acceptance Scenarios**:

1. **Given** un listado con sesiones en tres proyectos y ningún filtro aplicado, **When** se muestra la vista, **Then** aparecen los tres grupos de proyecto con todas sus sesiones y el control de proyectos no tiene ninguno marcado.
2. **Given** el listado sin filtros, **When** selecciono un proyecto en el control, **Then** solo se muestran las sesiones de ese proyecto y desaparecen los grupos de los demás.
3. **Given** dos proyectos seleccionados, **When** se aplica el filtro, **Then** se muestran las sesiones de ambos proyectos y no las de un tercero.
4. **Given** un proyecto seleccionado, **When** lo deselecciono hasta no dejar ninguno marcado, **Then** vuelven a mostrarse todos los proyectos.
5. **Given** el listado filtrado, **When** reviso el control de proyectos, **Then** aparece como opción cada proyecto que tiene al menos una sesión, con independencia del rango temporal activo, sin proyectos vacíos.
6. **Given** dos proyectos distintos con la misma carpeta contenedora, **When** abro el control de proyectos, **Then** cada opción muestra el nombre de la carpeta junto a su ruta completa y puedo distinguirlos sin ambigüedad.

---

### User Story 2 - Ver solo las sesiones recientes (Priority: P1)

Como persona que observa ejecuciones, quiero acotar el listado a las sesiones de las últimas horas o días, para encontrar rápido lo que acabo de ejecutar sin recorrer semanas de historial.

**Why this priority**: Es la segunda mitad explícita de la petición. Resuelve el caso de uso más frecuente —volver a una ejecución reciente— sin depender de la fecha exacta.

**Independent Test**: Abrir el listado con sesiones de hoy y sesiones antiguas, elegir el rango "últimas 24 horas" y comprobar que solo quedan las de hoy. Entrega valor por sí sola.

**Acceptance Scenarios**:

1. **Given** un listado con sesiones de distintas fechas y ningún filtro temporal, **When** se muestra la vista, **Then** se ven todas las sesiones y el rango activo es "todo".
2. **Given** el listado completo, **When** elijo el rango "últimas 24 horas", **Then** solo se muestran las sesiones con actividad dentro de las últimas 24 horas.
3. **Given** el listado completo, **When** elijo el rango "última hora", **Then** solo se muestran las sesiones con actividad en los últimos 60 minutos.
4. **Given** un rango temporal activo, **When** vuelvo a elegir "todo", **Then** se muestran otra vez todas las sesiones.
5. **Given** un rango temporal activo, **When** una sesión queda fuera del rango, **Then** no aparece en la lista ni se cuenta en el encabezado de su grupo.
6. **Given** el rango "última hora" activo y la página abierta, **When** transcurre el tiempo suficiente para que una sesión visible deje de cumplirlo, **Then** la sesión desaparece del listado sin que yo toque nada.
7. **Given** una ejecución en curso que comenzó antes del rango activo, **When** sigue generando actividad, **Then** permanece visible dentro del rango.

---

### User Story 3 - Conservar los filtros al entrar y salir de una sesión (Priority: P2)

Como persona que revisa varias ejecuciones seguidas de un mismo proyecto, quiero que los filtros que dejé puestos sigan aplicados cuando vuelvo del detalle de una sesión, para no tener que rehacerlos cada vez.

**Why this priority**: Multiplica el valor de los dos filtros anteriores, pero sin ellos no existe nada que conservar. Es una mejora de continuidad, no el núcleo.

**Independent Test**: Aplicar un filtro de proyecto, abrir una sesión del listado, volver atrás y comprobar que el filtro sigue aplicado y la vista sigue acotada. Entrega valor por sí sola.

**Acceptance Scenarios**:

1. **Given** un filtro de proyecto aplicado, **When** abro una sesión desde el listado y vuelvo a la lista, **Then** el filtro sigue aplicado tal como lo dejé, sin volver a seleccionarlo.
2. **Given** un filtro temporal aplicado, **When** recargo la página, **Then** el rango sigue siendo el mismo.
3. **Given** un enlace al listado con filtros incluidos, **When** otra persona lo abre, **Then** ve exactamente la misma selección de proyectos y de rango temporal.
4. **Given** filtros aplicados, **When** los limpio, **Then** el listado vuelve a mostrar todas las sesiones y la dirección deja de contener filtros.

---

### Edge Cases

- **Combinación sin resultados**: si la intersección de proyecto y rango temporal no deja ninguna sesión, se muestra un estado vacío específico de filtros, con una acción visible para limpiarlos; no se muestra el estado vacío de "no hay sesiones todavía".
- **Ningún proyecto seleccionado**: se interpreta como "todos", nunca como "ninguno". Un control sin marcas jamás deja la lista vacía.
- **Proyecto seleccionado que deja de tener sesiones**: si un proyecto sigue seleccionado pero ya no tiene sesiones que cumplan el rango, su grupo no se muestra; el proyecto permanece seleccionado por si vuelve a tener sesiones.
- **Sesión fuera de la lista de proyectos conocidos**: una sesión cuyo proyecto no aparece entre las opciones se muestra cuando no hay filtro de proyecto y se oculta al filtrar, sin romper la vista.
- **Dirección con un proyecto inexistente**: si el enlace apunta a un proyecto que ya no existe, ese valor se ignora y se muestran los proyectos restantes, sin error visible.
- **Dirección con un rango inválido o desconocido**: se cae al rango por defecto "todo" en lugar de mostrar una lista vacía o un error.
- **Muchos proyectos**: con muchas carpetas, la barra de filtros sigue siendo utilizable y permite llegar a todas las opciones sin desplazar el listado fuera de la vista.
- **Sesiones sin actividad registrada**: una sesión sin marca de actividad se trata como fuera de cualquier rango salvo "todo"; nunca provoca un fallo de la vista.
- **Cambio de filtro mientras cargan los datos**: el filtro elegido se aplica en cuanto llegan las sesiones, sin dejar la vista en un estado inconsistente.
- **Ventana en vivo durante la lectura**: cuando una sesión entra o sale del rango por el mero paso del tiempo, la lista se recompone sin recargar la página, sin perder la posición de scroll y sin robar el foco al control que se esté usando.
- **Ventana en vivo con el rango "todo" activo**: al no haber corte temporal, el paso del tiempo no altera la composición de la lista.
- **Sesión abierta que sale del rango**: si la sesión que se está visualizando deja de cumplir el rango, se mantiene la navegación ya iniciada; el filtro solo afecta a lo que lista esta página.
- **Sin sesiones en absoluto**: se mantiene el estado vacío actual ("Sin sesiones" con la invitación a iniciar una ejecución) y los controles de filtro no se muestran.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página del listado de sesiones MUST ofrecer un control de filtro por proyecto.
- **FR-002**: El filtro de proyecto MUST permitir seleccionar varios proyectos a la vez.
- **FR-003**: El filtro de proyecto MUST mostrar, por defecto, las sesiones de todos los proyectos cuando no hay ninguna selección activa.
- **FR-004**: El filtro de proyecto MUST ofrecer como opciones los proyectos que tienen al menos una sesión en el catálogo del listado, con independencia del rango temporal activo, sin opciones vacías.
- **FR-005**: Cuando hay proyectos seleccionados, el listado MUST mostrar únicamente las sesiones de esos proyectos.
- **FR-006**: El listado MUST ofrecer un control de filtro temporal de recencia.
- **FR-007**: El filtro temporal MUST ofrecer rangos predefinidos: última hora, últimas 24 horas, últimos 7 días, últimos 30 días y todo.
- **FR-008**: El filtro temporal MUST estar en "todo" por defecto.
- **FR-009**: El filtro temporal MUST evaluar la última actividad registrada de cada sesión, no su creación; una ejecución en curso MUST permanecer dentro de cualquier rango mientras siga generando actividad, aunque haya comenzado antes del inicio del rango.
- **FR-010**: Ambos filtros MUST combinarse por intersección: se muestran las sesiones que cumplen a la vez el proyecto y el rango temporal elegidos.
- **FR-011**: Cuando la combinación de filtros no deja ninguna sesión, el listado MUST mostrar un estado vacío específico con una acción para limpiar los filtros.
- **FR-012**: El listado MUST ofrecer una acción para limpiar todos los filtros de una vez, devolviendo la vista al estado sin filtrar.
- **FR-013**: Los filtros activos MUST quedar reflejados en la dirección de la página, de forma que recargarla o compartirla reproduzca la misma selección.
- **FR-014**: Al abrir una dirección que ya contiene filtros, el listado MUST restaurarlos y aplicarlos.
- **FR-015**: Valores de filtro desconocidos o inválidos en la dirección MUST ignorarse y sustituirse por el valor por defecto, sin mostrar errores.
- **FR-016**: Cada grupo de proyecto del listado MUST indicar cuántas sesiones está mostrando con los filtros aplicados.
- **FR-017**: Un grupo de proyecto sin sesiones que cumplan los filtros MUST ocultarse por completo, incluido su encabezado.
- **FR-018**: Los filtros MUST aplicarse únicamente en la página del listado de sesiones; el listado lateral del espacio de trabajo MUST permanecer sin cambios.
- **FR-019**: El listado MUST conservar sus estados de pantalla actuales en este orden: error → carga → vacío sin sesiones → datos.
- **FR-020**: El orden de las sesiones dentro de cada grupo MUST mantenerse tal como está hoy (la actividad más reciente primero) con independencia de los filtros aplicados.
- **FR-021**: Los controles de filtro MUST ser operables con teclado y anunciar su estado (marcado / no marcado, rango activo) a tecnologías de asistencia.
- **FR-022**: El rango temporal MUST recalcularse en vivo mientras la página está abierta: una sesión que deja de cumplir el rango activo MUST desaparecer del listado, y una que pasa a cumplirlo MUST aparecer, sin intervención del usuario ni recarga.
- **FR-023**: Cada opción del filtro de proyecto MUST identificarse con el nombre de la carpeta como etiqueta principal y la ruta completa como texto secundario, de modo que dos proyectos homónimos en ubicaciones distintas sean distinguibles.
- **FR-024**: La página del listado MUST presentar los controles de filtro en una barra siempre visible, situada entre el título de la página y el listado, sin requerir una acción previa para acceder a ellos.
- **FR-025**: Mientras haya filtros activos, la barra MUST mostrar un resumen de lo seleccionado y mantener visible la acción de limpiar, sin depender de expandir ningún control.
- **FR-026**: Volver al listado desde el detalle de una sesión MUST conservar los filtros activos, sin que el usuario tenga que volver a seleccionarlos.

### Key Entities *(include if feature involves data)*

- **Sesión**: una ejecución de OpenCode. Relevantes para los filtros: su identificador, su título, el proyecto al que pertenece, su marca de creación y su marca de última actividad.
- **Grupo de proyecto**: el conjunto de sesiones de una misma carpeta de trabajo, con el encabezado que las agrupa. Es la unidad sobre la que actúa el filtro de proyecto.
- **Selección de filtros**: el estado que combina el conjunto de proyectos marcados (vacío = todos) y el rango temporal activo. Es el dato que se refleja en la dirección de la página y que determina qué grupos y sesiones son visibles.

No introduce entidades de datos nuevas ni fuentes de datos nuevas: reutiliza las sesiones y los proyectos ya disponibles en el listado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede dejar visible un único proyecto en un máximo de 2 interacciones desde que abre el listado.
- **SC-002**: El 100% de las sesiones visibles cumplen simultáneamente el proyecto y el rango temporal seleccionados; ninguna sesión fuera de los filtros queda visible.
- **SC-003**: Los filtros sobreviven a abrir una sesión y volver al listado, y a recargar la página, sin pérdidas ni pasos manuales extra.
- **SC-004**: Sin ningún filtro aplicado, el listado muestra exactamente las mismas sesiones que hoy (0 regresiones de contenido ni de orden).
- **SC-005**: Ante una combinación de filtros sin resultados, el usuario ve un estado vacío accionable en el 100% de los casos, y nunca el estado de "no hay sesiones todavía".
- **SC-006**: Un usuario puede volver al listado completo desde cualquier estado filtrado en 1 interacción.
- **SC-007**: Con un rango temporal distinto de "todo" activo, el 100% de las sesiones que cruzan el límite del rango desaparecen del listado en menos de 5 segundos desde que dejan de cumplirlo, sin acción del usuario.
- **SC-008**: Dos proyectos con el mismo nombre de carpeta son distinguibles en el filtro en el 100% de los casos, sin abrir ninguna vista adicional.

## Assumptions

- El filtro temporal se evalúa sobre la última actividad de la sesión (su marca de actualización), porque el caso de uso declarado es "sesiones más recientes" y no la fecha en que se crearon. Confirmado en la sesión de clarificación del 2026-10-07.
- El rango temporal es una ventana rodante que se reevalúa contra la hora actual mientras la página está abierta. La frecuencia concreta de reevaluación se deja al plan técnico; el único límite observable es el de SC-007 (menos de 5 segundos).
- Los rangos se calculan con el reloj local de quien visualiza la app, sin conversión de zona horaria.
- La etiqueta de cada proyecto en el filtro combina el nombre de la carpeta y su ruta completa, para evitar ambigüedad entre proyectos homónimos.
- Los filtros se presentan en una barra siempre visible sobre el listado, y no dentro de un desplegable.
- Los filtros viven solo en la página del listado de sesiones; el listado lateral del espacio de trabajo se mantiene tal cual para no ocultar la sesión que se está viendo en el grafo.
- Los filtros se reflejan en la dirección de la página; no se persisten como preferencia del navegador más allá de eso.
- Un filtro de proyecto vacío significa "todos", nunca "ninguno".
- Los grupos de proyecto sin sesiones que cumplan los filtros se ocultan en lugar de mostrarse vacíos.
- El alcance no incluye búsqueda por texto ni ordenación configurable por el usuario.
- El alcance no incluye un rango de fechas personalizado (desde/hasta); solo los rangos predefinidos.
- El conjunto de rangos predefinidos es cerrado y conocido de antemano, lo que permite validar la dirección sin consultar al servidor.
- Se mantienen las convenciones del proyecto: arquitectura por dominios, lógica pura y testeable separada de los componentes, estados de pantalla obligatorios y tests junto al código.
