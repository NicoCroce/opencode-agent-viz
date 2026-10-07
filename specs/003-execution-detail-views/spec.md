# Feature Specification: Detalle de ejecución de agentes

**Feature Branch**: `003-execution-detail-views`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Visualizar con más detalle las ejecuciones multi-agente: respuestas y razonamiento de cada agente, modal con el histórico completo de la sesión de un agente o subagente, estado de ejecución enriquecido (retry, compactación, espera de input, interrupción) y aprovechar los datos de sesión aún no explotados (diff de archivos, estadísticas de herramientas, formularios/preguntas, inbox, compactación)"

## Clarifications

### Session 2026-10-06

- Q: ¿Cómo debe mostrarse el texto de las respuestas y del razonamiento de un agente? → A: Con formato enriquecido (bloques de código, listas, énfasis y tablas), neutralizando el contenido no confiable.
- Q: ¿Desde qué puntos de la interfaz debe poder abrirse el histórico de un agente? → A: Desde el detalle del agente y mediante un atajo directo (doble clic) sobre el nodo del grafo; la lista de sesiones no gana un acceso nuevo.
- Q: Cuando la actividad de una sesión supera lo que el visor puede recuperar de una vez, ¿cómo debe comportarse el histórico? → A: Ampliando la actividad recuperada a medida que el usuario se desplaza, sin tope y sin volcar todo de golpe; se advierte solo si el servidor no permite continuar. El resumen del grafo conserva su carga acotada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leer las respuestas y el razonamiento de un agente (Priority: P1)

Como desarrollador que revisa una ejecución multi-agente, quiero leer el texto que produjo cada agente (sus respuestas) y, cuando me interese, su razonamiento, para entender qué decidió y con qué fundamento, en lugar de deducirlo a partir de métricas y nombres de herramientas.

**Why this priority**: Es la limitación más grave del visor actual: el contenido de las respuestas ya está disponible pero no se muestra en ninguna parte. Sin esto, la herramienta sirve para ver *cuándo* corrió un agente, no *qué hizo*.

**Independent Test**: Abrir el detalle de un agente que haya producido al menos una respuesta de texto y comprobar que se lee el texto completo, en orden, junto a sus llamadas a herramienta; activar y desactivar la vista de razonamiento.

**Acceptance Scenarios**:

1. **Given** un agente que produjo varias respuestas de texto, **When** el usuario consulta su detalle, **Then** ve cada respuesta en el orden en que fue producida, junto a las llamadas a herramienta intercaladas en su posición correcta.
2. **Given** un detalle de agente con razonamiento disponible, **When** el usuario activa la vista de razonamiento, **Then** el razonamiento se hace visible sin ocultar las respuestas; al desactivarla, el razonamiento se oculta y las respuestas permanecen.
3. **Given** una llamada a herramienta ya finalizada, **When** el usuario la expande, **Then** ve su entrada y su resultado completo y, si falló, el error.
4. **Given** una respuesta que aún no se ha consolidado porque el agente sigue generándola, **When** el usuario consulta el detalle, **Then** se indica que está en curso y no se muestra un texto parcial como si estuviera completo.
5. **Given** un mensaje escrito por el usuario, **When** el usuario consulta el detalle, **Then** ve ese mensaje como una entrada propia del histórico, distinguible de las respuestas del agente.

---

### User Story 2 - Abrir el histórico completo de un agente o subagente (Priority: P1)

Como desarrollador, quiero abrir la sesión completa de un agente o subagente en un espacio grande y dedicado, para revisar con comodidad toda su conversación, su contexto y sus herramientas, y moverme entre el agente que lo invocó y los agentes que él invocó.

**Why this priority**: El panel lateral es demasiado estrecho y ya está saturado de secciones resumidas; el histórico completo solo cabe en una vista propia. Es la pieza que convierte los datos disponibles en algo realmente navegable.

**Independent Test**: Abrir el histórico de un subagente desde el grafo, comprobar que se ve toda su actividad en orden, expandir una herramienta, navegar al agente padre y volver, y cerrar el histórico volviendo al grafo con la misma selección.

**Acceptance Scenarios**:

1. **Given** un grafo con agentes y subagentes, **When** el usuario pide ver el histórico de un agente, **Then** se abre una vista dedicada con toda la actividad de esa sesión en orden cronológico, incluyendo mensajes del usuario, respuestas, razonamiento, herramientas, cambios de agente o modelo y avisos del sistema.
2. **Given** el histórico abierto de un agente, **When** el usuario lo observa, **Then** la cabecera muestra la identidad del agente, su modelo, su estado, su coste, sus tokens, su resultado final y su directorio.
3. **Given** el histórico abierto de un agente que fue invocado por otro y que a su vez invocó a otros, **When** el usuario usa la navegación de linaje, **Then** puede abrir el histórico del agente que lo invocó y el de los agentes que él invocó.
4. **Given** el histórico abierto de una sesión larga, **When** el usuario lo recorre, **Then** la interfaz responde con fluidez y no vuelca toda la actividad de golpe.
5. **Given** el histórico abierto, **When** el usuario lo cierra, **Then** vuelve al grafo con la misma selección y la misma disposición que tenía.
6. **Given** un agente sin actividad registrada, **When** el usuario abre su histórico, **Then** ve un estado vacío explícito en lugar de una vista en blanco.

---

### User Story 3 - Distinguir el estado real de cada ejecución (Priority: P1)

Como desarrollador, quiero distinguir de un vistazo si un agente está ejecutando, reintentando, compactando su contexto, esperando un permiso o una respuesta del usuario, terminado con éxito, fallido o interrumpido, para localizar en segundos dónde está el problema o el bloqueo.

**Why this priority**: El visor solo expone unas pocas etiquetas agregadas y un fallo antiguo tiñe de error a un agente que sigue trabajando. En ejecuciones largas con reintentos es la diferencia entre diagnosticar y adivinar.

**Independent Test**: Provocar (o reproducir con datos grabados) una ejecución con un reintento, una compactación, una espera de permiso, un fallo y una interrupción, y comprobar que cada situación se distingue con su propia etiqueta.

**Acceptance Scenarios**:

1. **Given** un agente reintentando tras un fallo, **When** el usuario mira su nodo, **Then** ve que está reintentando, con el número de intento y, si el servidor lo reporta, cuándo será el próximo intento.
2. **Given** un agente que ya falló en una herramienta pero continúa ejecutando, **When** el usuario mira su nodo, **Then** el nodo se muestra en ejecución y no como fallido.
3. **Given** un agente que terminó correctamente, **When** el usuario mira su nodo, **Then** se distingue claramente de uno que nunca llegó a ejecutar.
4. **Given** un agente interrumpido por el usuario o por el sistema, **When** el usuario mira su nodo, **Then** se distingue de un fallo propio del agente y se indica el motivo cuando el servidor lo reporta.
5. **Given** un agente esperando, **When** el usuario mira su detalle, **Then** se indica si espera un permiso o una respuesta del usuario, y no ambas cosas de forma ambigua.

---

### User Story 4 - Ver el resumen de toda la sesión (Priority: P2)

Como desarrollador, quiero ver un resumen agregado de la sesión completa (cuántos agentes hay en cada estado, cuánto se ha gastado y cuánto tiempo lleva), para valorar la ejecución sin sumar nodo por nodo.

**Why this priority**: Aporta contexto inmediato y evita aritmética mental, pero el detalle por agente ya cubre el diagnóstico principal.

**Independent Test**: Abrir una sesión con varios agentes y comprobar que el resumen muestra los contadores por estado, el coste y los tokens acumulados y el tiempo transcurrido, y que se actualiza al llegar actividad nueva.

**Acceptance Scenarios**:

1. **Given** una sesión con agentes en distintos estados, **When** el usuario mira el resumen, **Then** ve la cantidad de agentes en curso, esperando, con error y el total.
2. **Given** una sesión con actividad, **When** el usuario mira el resumen, **Then** ve el coste y los tokens acumulados de todos los agentes.
3. **Given** una sesión en curso, **When** llega actividad nueva, **Then** el resumen se actualiza sin provocar un reordenamiento ni un salto de la vista.

---

### User Story 5 - Ver el impacto de un agente en el repositorio (Priority: P2)

Como desarrollador, quiero ver qué archivos tocó un agente, cuántas líneas añadió y quitó, y su parche, para evaluar el cambio sin abrir otra herramienta.

**Why this priority**: Responde directamente a la pregunta "¿qué dejó hecho este agente?" y el dato ya lo reporta el servidor, pero no es imprescindible para seguir una ejecución.

**Independent Test**: Inspeccionar un agente que haya modificado archivos y comprobar la lista de archivos con su estado y líneas añadidas/quitadas, y el parche de uno de ellos.

**Acceptance Scenarios**:

1. **Given** un agente que modificó archivos, **When** el usuario mira su detalle, **Then** ve la lista de archivos con su estado (añadido, modificado, borrado) y las líneas añadidas y quitadas.
2. **Given** esa lista de archivos, **When** el usuario selecciona un archivo, **Then** ve su parche completo.
3. **Given** un agente que no reporta cambios en archivos, **When** el usuario mira su detalle, **Then** se indica explícitamente que no hay cambios, en lugar de dejar la sección vacía.

---

### User Story 6 - Entender por qué una ejecución está esperando (Priority: P2)

Como desarrollador, quiero ver las preguntas que un agente dirigió al usuario —y sus respuestas, si las hubo— y el motivo de los permisos solicitados, para comprender por qué la ejecución se detuvo.

**Why this priority**: Hoy "esperando" es opaco: el usuario ve que algo está detenido pero no qué se pidió ni quién debe responder. Explicar la espera convierte un estado incomprensible en accionable.

**Independent Test**: Reproducir una ejecución que pide permiso y otra que hace una pregunta al usuario, y comprobar que el detalle muestra el motivo, el texto de la pregunta y la respuesta cuando existe.

**Acceptance Scenarios**:

1. **Given** un agente esperando un permiso, **When** el usuario mira su detalle, **Then** ve que el motivo es un permiso solicitado, con la operación y los recursos afectados.
2. **Given** un agente que hizo una pregunta al usuario, **When** el usuario mira su detalle, **Then** ve el texto de la pregunta y las opciones ofrecidas.
3. **Given** una pregunta ya respondida, **When** el usuario recorre el histórico, **Then** la encuentra en su posición cronológica junto a la respuesta dada.
4. **Given** una pregunta cancelada o sin responder, **When** el usuario mira su detalle, **Then** se indica que quedó pendiente o cancelada, sin mostrarla como respondida.

---

### User Story 7 - Diagnosticar contexto, cola y rendimiento de herramientas (Priority: P3)

Como desarrollador, quiero ver cuándo se compactó el contexto de un agente, cuántos turnos tiene en cola y cuánto tardan sus herramientas, para diagnosticar pérdida de contexto y cuellos de botella.

**Why this priority**: Es información de diagnóstico avanzado, valiosa para ejecuciones problemáticas pero secundaria frente a entender qué hizo el agente y en qué estado está.

**Independent Test**: Inspeccionar un agente que haya compactado contexto y que tenga herramientas registradas, y comprobar que la compactación aparece marcada con su estado, el contador de turnos en cola y la duración mediana por herramienta.

**Acceptance Scenarios**:

1. **Given** un agente que compactó su contexto, **When** el usuario recorre su histórico, **Then** el episodio de compactación aparece marcado en su posición cronológica con su estado (en curso, completada o fallida).
2. **Given** un agente con turnos pendientes en cola, **When** el usuario mira su detalle, **Then** ve cuántos turnos esperan.
3. **Given** herramientas con duración registrada, **When** el usuario mira el historial de herramientas, **Then** ve la duración mediana por herramienta, además de las ejecuciones individuales.

---

### Edge Cases

- ¿Qué ocurre si un agente no produjo ninguna respuesta de texto (solo llamadas a herramienta)? El detalle muestra las herramientas y un estado vacío explícito para el texto, sin secciones fantasma.
- ¿Qué ocurre con sesiones tan largas que su actividad no cabe entera en memoria? La vista debe seguir siendo fluida y permitir recorrer la actividad sin volcarla toda a la vez (ver FR-013).
- ¿Qué ocurre si la actividad de una sesión es tan extensa que no puede recuperarse de una vez? El histórico la amplía a medida que el usuario se desplaza y, si el servidor deja de permitir la recuperación, se indica explícitamente que puede faltar actividad.
- ¿Qué ocurre si un agente no reporta modelo, título o directorio? Se muestra "no disponible" en ese dato, sin dejar la cabecera rota.
- ¿Qué ocurre si un mensaje del usuario trae adjuntos (archivos, agentes o skills)? Se muestra su presencia y su nombre; el visor sigue siendo de solo lectura.
- ¿Qué ocurre si una herramienta termina sin resultado (por ejemplo, interrumpida)? Se muestra su estado real (en curso o incompleta) sin inventar un resultado.
- ¿Qué ocurre si un agente desaparece del grafo mientras su histórico está abierto? La vista se cierra o se marca como no disponible, sin quedar inconsistente.
- ¿Qué ocurre si el usuario cambia de sesión con un histórico abierto? El histórico se cierra y la nueva sesión se abre en su vista por defecto.
- ¿Qué ocurre con un archivo modificado sin parche disponible o con un parche muy grande? Se sigue mostrando su estado y sus líneas añadidas/quitadas; el parche se muestra de forma legible o se indica que no está disponible.
- ¿Qué ocurre si un reintento no reporta el momento del próximo intento? Se muestra el número de intento y se omite la cuenta atrás.
- ¿Qué ocurre si una interrupción no reporta motivo? Se muestra como interrupción y se indica que el motivo es "no disponible".
- ¿Qué ocurre con una compactación que falló? Se marca como fallida, sin presentarla como un episodio exitoso.
- ¿Qué ocurre en pantallas pequeñas? El histórico se ofrece a pantalla completa y el resto de capacidades siguen siendo utilizables, sin duplicar la lógica de la vista de escritorio.

## Requirements *(mandatory)*

### Functional Requirements

**Respuestas y razonamiento**

- **FR-001**: El sistema MUST mostrar el texto de las respuestas producidas por cada agente, en el orden en que fueron producidas, con formato enriquecido (bloques de código, listas, énfasis y tablas) y sin ejecutar como activo el contenido no confiable proveniente de la sesión.
- **FR-002**: El sistema MUST permitir mostrar y ocultar el razonamiento del agente de forma independiente, sin que ocultarlo afecte a las respuestas.
- **FR-003**: El sistema MUST distinguir visualmente, dentro de una misma ejecución, entre mensaje del usuario, respuesta del agente, razonamiento y llamada a herramienta, respetando su orden de producción.
- **FR-004**: El sistema MUST mostrar la entrada y el resultado de cada llamada a herramienta, y su error cuando haya fallado.
- **FR-005**: El sistema MUST NOT mostrar texto a medida que se genera palabra a palabra; MUST mostrar el texto consolidado de cada respuesta.
- **FR-006**: Mientras una respuesta no esté consolidada, el sistema MUST indicarla como "en curso" y no MUST presentar un texto parcial como si estuviera completo.
- **FR-007**: El sistema MUST mostrar los adjuntos de un mensaje del usuario (archivos, agentes y skills) al menos por su nombre, e indicar cuándo no tienen nombre.

**Histórico completo**

- **FR-008**: El sistema MUST permitir abrir el histórico completo de la sesión de cualquier agente o subagente visible en el grafo, incluida la sesión raíz, tanto desde el detalle del agente como mediante un atajo directo sobre el nodo en el grafo.
- **FR-009**: El histórico MUST mostrar la actividad de la sesión en orden cronológico, incluyendo mensajes del usuario, respuestas, razonamiento, llamadas a herramienta, cambios de agente o modelo, cambios de ubicación, avisos del sistema y entradas sintéticas o de skill.
- **FR-010**: La cabecera del histórico MUST mostrar la identidad del agente (título o nombre), su modelo, su estado, su coste, sus tokens, su resultado final y su directorio.
- **FR-011**: El histórico MUST permitir expandir y contraer cada llamada a herramienta para ver su entrada y su resultado completos.
- **FR-012**: El histórico MUST permitir abrir el histórico del agente que invocó al agente actual y el de los agentes invocados por él, cuando existan.
- **FR-013**: El sistema MUST permitir recorrer históricos largos ampliando la actividad recuperada a medida que el usuario se desplaza, sin un tope fijo, sin volcar toda la actividad de una sola vez y sin bloquear la interacción.
- **FR-014**: El sistema MUST cerrar el histórico y devolver al usuario al grafo conservando la selección y la disposición previas.
- **FR-015**: El histórico MUST mostrar los estados de carga, error, vacío y datos, de forma coherente con el resto de vistas.
- **FR-016**: Cuando el servidor no permita continuar recuperando la actividad de una sesión, el sistema MUST indicarlo de forma explícita, sin presentar lo recuperado como si fuera la sesión completa.

**Estado de ejecución**

- **FR-017**: El sistema MUST distinguir visualmente, como mínimo, estas situaciones de una ejecución: creada y aún sin actividad, ejecutando, reintentando, compactando contexto, esperando un permiso, esperando una respuesta del usuario, terminada con éxito, fallida e interrumpida.
- **FR-018**: Cuando una ejecución esté reintentando, el sistema MUST mostrar el número de intento y, si el servidor lo reporta, el momento del próximo intento.
- **FR-019**: El sistema MUST distinguir un fallo propio del agente de una interrupción provocada por el usuario o por el sistema, indicando el motivo de la interrupción cuando el servidor lo reporte.
- **FR-020**: El sistema MUST dejar de mostrar una ejecución como fallida por errores ya superados cuando esa ejecución siga en curso o haya terminado con éxito.
- **FR-021**: El sistema MUST distinguir una ejecución que todavía no ha empezado de una que ya terminó.
- **FR-022**: El sistema MUST hacer perceptible que una ejecución está avanzando, sin depender de mostrar texto en generación.
- **FR-023**: El sistema MUST mostrar el estado resultante en el nodo del grafo y en el detalle del agente, de forma consistente entre ambas vistas.

**Resumen de sesión**

- **FR-024**: El sistema MUST mostrar un resumen de la sesión con la cantidad de agentes en curso, esperando, con error y el total.
- **FR-025**: El resumen MUST mostrar el coste y los tokens acumulados de todos los agentes de la sesión.
- **FR-026**: El resumen MUST mostrar el tiempo transcurrido de la sesión.
- **FR-027**: El resumen MUST actualizarse con la actividad en vivo sin provocar reordenamientos ni saltos de la vista.

**Impacto en el repositorio**

- **FR-028**: El sistema MUST mostrar los archivos afectados por un agente, con su estado (añadido, modificado o borrado) y las líneas añadidas y quitadas.
- **FR-029**: El sistema MUST permitir ver el parche de un archivo afectado.
- **FR-030**: Cuando un agente no reporte cambios en archivos, el sistema MUST indicarlo explícitamente.

**Preguntas, permisos y cola**

- **FR-031**: Cuando una ejecución espere un permiso, el sistema MUST mostrar el motivo de la espera con la operación y los recursos afectados.
- **FR-032**: El sistema MUST mostrar el texto de las preguntas dirigidas al usuario, con las opciones ofrecidas.
- **FR-033**: El sistema MUST mostrar la respuesta dada a una pregunta en su posición cronológica y MUST distinguir una pregunta pendiente o cancelada de una respondida.
- **FR-034**: El sistema MUST mostrar cuántos turnos pendientes tiene en cola una ejecución.

**Diagnóstico de contexto y herramientas**

- **FR-035**: El sistema MUST marcar en el histórico los episodios de compactación de contexto con su estado (en curso, completada o fallida) y en su posición cronológica.
- **FR-036**: El sistema MUST mostrar la duración mediana por herramienta, además de las ejecuciones individuales de esa herramienta.

**Transversales**

- **FR-037**: El sistema MUST seguir siendo de solo lectura: ninguna de estas capacidades envía prompts, aborta sesiones ni responde permisos.
- **FR-038**: Cuando un dato no exista, el sistema MUST mostrar "no disponible" en lugar de un valor inventado o un espacio en blanco.
- **FR-039**: El sistema MUST mantener el diseño oscuro y plano con contraste legible.
- **FR-040**: El sistema MUST ofrecer estas capacidades en pantallas pequeñas sin duplicar la lógica de negocio.
- **FR-041**: El sistema MUST conservar los estados de conexión y de pantalla ya existentes, sin regresiones.

### Key Entities *(include if feature involves data)*

- **Ejecución de agente**: cada agente o subagente que participa en la sesión; tiene identidad, modelo, directorio, estado en curso y métricas acumuladas.
- **Estado de ejecución**: situación actual de una ejecución, entre las definidas en FR-017; determina la etiqueta y el color tanto en el nodo como en el detalle.
- **Entrada del histórico**: cualquier elemento cronológico de la sesión de un agente (mensaje del usuario, respuesta, razonamiento, llamada a herramienta, cambio de agente o modelo, cambio de ubicación, aviso del sistema, entrada sintética, entrada de skill, compactación o cierre de turno).
- **Respuesta**: texto consolidado producido por un agente; puede estar todavía en curso.
- **Razonamiento**: texto de deliberación del agente, mostrable u ocultable con independencia de las respuestas.
- **Llamada a herramienta**: invocación de una herramienta por un agente, con su entrada, su resultado o error y su duración.
- **Reintento**: nuevo intento de una ejecución tras un fallo, con su número de intento y su próximo momento.
- **Compactación**: episodio en el que el agente reduce su contexto, con estado y posición temporal.
- **Cambio de archivos**: conjunto de archivos afectados por un agente, cada uno con su estado y sus líneas añadidas y quitadas, y opcionalmente su parche.
- **Pregunta al usuario**: solicitud de decisión formulada por un agente, con sus opciones, y su respuesta, estado pendiente o cancelada.
- **Solicitud de permiso**: petición de autorización que bloquea una ejecución, con su operación y recursos.
- **Turno en cola**: trabajo pendiente de una ejecución que todavía no ha comenzado.
- **Resumen de sesión**: agregado de una sesión con contadores por estado, coste, tokens y tiempo transcurrido.
- **Linaje de agentes**: relación padre–hijo entre agentes de una misma sesión, usada para navegar entre históricos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede leer la primera respuesta de un agente en menos de 3 clics desde que la sesión está abierta.
- **SC-002**: El 100% de los agentes que produjeron texto lo muestran en el orden correcto, sin entradas fuera de secuencia.
- **SC-003**: El usuario abre el histórico completo de cualquier agente o subagente del grafo en un solo gesto.
- **SC-004**: El usuario pasa del histórico de un agente al de su invocador en un solo gesto, sin cerrar la vista.
- **SC-005**: El usuario identifica el estado real de una ejecución (ejecutando, reintentando, compactando, esperando, terminada, fallida o interrumpida) en menos de 5 segundos por nodo.
- **SC-006**: Cero casos en que un error ya superado haga que una ejecución activa se muestre como fallida.
- **SC-007**: El usuario distingue una interrupción de un fallo propio en el 100% de los casos en que el servidor reporta la interrupción.
- **SC-008**: El usuario obtiene los contadores por estado, el coste y los tokens de una sesión completa sin inspeccionar ningún nodo individual.
- **SC-009**: El usuario ve los archivos afectados por un agente en un solo gesto desde su detalle.
- **SC-010**: El usuario explica por qué una ejecución está detenida (permiso o pregunta) sin salir del visor.
- **SC-011**: Recorrer el histórico de una sesión con miles de entradas se mantiene fluido (sin bloqueos perceptibles de la interfaz).
- **SC-012**: Ninguna de las mejoras introduce regresiones en los estados de conexión, carga, vacío o error de las vistas afectadas.

## Assumptions

- El visor sigue siendo de solo lectura: las nuevas vistas muestran información, nunca responden permisos ni preguntas.
- El texto de las respuestas se muestra una vez consolidado; no se muestra palabra a palabra. Esto es coherente con el criterio ya asumido por el producto de no procesar deltas de texto en vivo.
- Los datos necesarios (actividad de la sesión, estado en curso, archivos afectados, uso de herramientas, preguntas, permisos, compactaciones y cola de turnos) ya los reporta el servidor de OpenCode y ya son accesibles para la aplicación; esta feature los expone en la interfaz.
- La actividad de una sesión ya se recupera por paginación; el histórico la amplía a medida que el usuario se desplaza, sin tope fijo. Si el servidor no permite continuar, se advierte de que puede faltar actividad.
- El estado de ejecución se enriquece añadiendo situaciones nuevas: se conservan todas las situaciones ya visibles, aunque sus etiquetas literales se renombren dentro del nuevo conjunto de 9 estados (por ejemplo, "inactivo" pasa a "creada" y "terminado" a "terminada con éxito"). Ninguna situación deja de ser distinguible.
- El resumen de sesión agrega los datos de los agentes ya cargados en la vista; no introduce una carga de datos distinta a la del grafo.
- La navegación de linaje se apoya en la relación padre–hijo ya representada en el grafo.
- Los parches de archivos muy grandes o no disponibles se muestran de forma degradada (estado y líneas añadidas/quitadas) sin bloquear la vista.
- No hay persistencia de preferencias del usuario (por ejemplo, si el razonamiento estaba visible) más allá de la sesión de navegación actual.
- Se mantiene la estética Dark Mode / Flat Design y la prioridad de uso en escritorio, sin descuidar pantallas pequeñas.
- El texto enriquecido de las respuestas es contenido no confiable: se muestra como información y nunca se ejecuta ni se interpreta como activo.
- El formato enriquecido se aplica al texto del agente; no convierte al visor en un editor ni permite modificar lo mostrado.
