# Feature Specification: Detalle del nodo por secciones (tablist) en el Inspector

**Feature Branch**: `014-inspector-detail-tabs`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Reemplazar el desplegable «Avanzado» del panel de detalle del nodo por un tablist segmentado al final del detalle con siete pestañas (Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia); las siete secciones salen del scroll principal y el desplegable se elimina. PRD: `.opencode/runs/20261013-inspector-detail-tabs/prd.md`."

## Clarifications

### Session 2026-10-13

- Q: ¿El encabezado interno de cada sección debe declararse como encabezado semántico real (nivel de título) o se mantiene como rótulo visual? (FR-005) → A: Se mantiene como está (rótulo de texto, sin promoverlo a encabezado h3); no se toca el componente de encabezado compartido. Opción A.
- Q: ¿Se corrige el contraste del texto inactivo en tema claro (4.39:1, por debajo de 4.5:1) en este cambio o se deja latente? (FR-007) → A: Se deja latente y se registra como hallazgo; no se modifica ningún token compartido de color en este cambio. Opción B.
- Q: ¿La limpieza documental cubre solo los contratos vigentes superseded y los comentarios de los archivos de código tocados, o barre además el resto de documentos de las specs afectadas? (FR-010) → A: Solo los contratos vigentes superseded y los comentarios de los archivos de código tocados; el resto queda histórico. Opción A.

Las tres preguntas abiertas que la spec dejó marcadas quedan resueltas; no queda ningún `[NEEDS CLARIFICATION]`. Ver notas de validación en `checklists/requirements.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir cada sección técnica por separado (Priority: P1)

Quien investiga un nodo abre su detalle y, al final del panel, encuentra una lista de siete secciones nombradas; al elegir una ve únicamente esa sección, sin el ruido de las demás.

**Why this priority**: es el núcleo de la petición. Hoy el contenido técnico está detrás de un desplegable colapsado y, al expandirlo, las ocho vistas se apilan en un único scroll donde hay que buscar la que interesa. Separar las secciones es lo que hace utilizable el diagnóstico de la ejecución.

**Independent Test**: abrir el detalle de un nodo y comprobar que al final aparece una lista con las siete secciones nombradas (Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia) y que al elegir una solo esa sección queda visible.

**Acceptance Scenarios**:

1. **Given** el detalle de un nodo abierto, **When** miro al final del detalle, **Then** veo siete pestañas nombradas y ninguna sección técnica está oculta tras un control que haya que expandir.
2. **Given** la lista de secciones visible, **When** elijo "Errores", **Then** veo la sección de Errores y ninguna de las otras seis.
3. **Given** una sección distinta de Subagentes activa, **When** elijo otra pestaña, **Then** la sección recién elegida sustituye a la anterior (exactamente una activa en todo momento).

---

### User Story 2 - Llegar al contenido técnico sin un paso previo (Priority: P1)

Quien abre un nodo recién abierto ve contenido técnico de inmediato: la sección activa por defecto es la primera y su contenido se pinta sin ninguna acción adicional.

**Why this priority**: la vista inicial no debe depender de un paso previo (expandir un control) para mostrar información. Un nodo recién abierto debe rendir valor técnico desde el instante en que el detalle termina de pintarse.

**Independent Test**: abrir un nodo y comprobar que, sin tocar nada, la pestaña activa es Subagentes y su contenido es visible.

**Acceptance Scenarios**:

1. **Given** un nodo recién abierto, **When** el detalle termina de pintarse, **Then** la sección activa es "Subagentes" y su contenido es visible sin ninguna acción adicional.
2. **Given** el detalle de un nodo abierto con cualquier sección activa, **When** cambio a otro nodo y vuelvo, **Then** la sección activa se mantiene entre nodos y el estado no se persiste entre aperturas del detalle (al cerrarlo y reabrirlo vuelve a "Subagentes").

---

### User Story 3 - El resumen del nodo sigue leyéndose como una secuencia continua (Priority: P1)

Quien recorre el detalle de arriba abajo encuentra el resumen del nodo (Identidad, Modelo, Métricas, Contexto con Paralelismo y Aporte al padre, Recursos y Duración mediana por herramienta) como una lectura continua, y las siete secciones técnicas ya no se apilan dentro de ese recorrido.

**Why this priority**: la petición reordena presentación, no rediseña el panel. El resumen es la parte que hoy funciona y debe quedar libre de las secciones técnicas para que ninguna información aparezca dos veces ni se pierda en el scroll.

**Independent Test**: recorrer el detalle de arriba abajo y comprobar que el resumen aparece como una secuencia continua sin pestañas y que ninguna de las siete secciones técnicas aparece dentro de ese recorrido.

**Acceptance Scenarios**:

1. **Given** el detalle abierto, **When** recorro el panel de arriba abajo, **Then** encuentro Identidad, Modelo, Métricas, Contexto (Paralelismo y Aporte al padre), Recursos y Duración mediana por herramienta, sin pestañas entre ellos.
2. **Given** el detalle abierto, **When** busco cualquiera de las siete secciones técnicas, **Then** no aparece en el recorrido del resumen; solo es visible a través de la sección elegida en la lista de pestañas.
3. **Given** el detalle abierto, **When** inspecciono todo el panel, **Then** ninguna sección aparece dos veces (no hay bloques duplicados entre resumen y pestañas).

---

### User Story 4 - Recorrer y elegir sección con el teclado (Priority: P2)

Quien navega con teclado recorre la lista de secciones y cambia la sección activa sin ratón.

**Why this priority**: la accesibilidad por teclado es requisito del patrón de pestañas y del proyecto; sin ella, la nueva lista sería inoperable para parte de los usuarios. Es menos crítica que el contenido en sí, pero no opcional.

**Independent Test**: con el foco en la lista de secciones, moverse con las flechas y con Inicio/Fin y comprobar que la sección activa se actualiza.

**Acceptance Scenarios**:

1. **Given** el foco en la lista de secciones, **When** uso las flechas izquierda/derecha, **Then** muevo la selección entre las siete y la sección activa se actualiza.
2. **Given** el foco en la lista de secciones, **When** uso Inicio o Fin, **Then** la sección activa pasa a la primera o a la última, respectivamente.
3. **Given** que navego con teclado, **When** miro la sección activa, **Then** distingo dónde está el foco.

---

### User Story 5 - Leer todas las pestañas en cualquier ancho del panel (Priority: P2)

Quien trabaja con el panel en su ancho mínimo o máximo ve las siete etiquetas completas.

**Why this priority**: el panel es lateral, de ancho variable y redimensionable; una lista que recorte etiquetas o exija desplazamiento horizontal impediría elegir sección con seguridad. Es una condición de uso, no una mejora.

**Independent Test**: poner el panel en su ancho mínimo y en su ancho máximo y comprobar que las siete etiquetas se leen completas, sin recortes ni desplazamiento horizontal.

**Acceptance Scenarios**:

1. **Given** el panel en su ancho mínimo, **When** miro la lista de secciones, **Then** las siete etiquetas se leen completas, sin recortes ni abreviaturas y sin desplazamiento horizontal.
2. **Given** el panel en su ancho máximo, **When** miro la lista de secciones, **Then** las siete etiquetas se leen completas y la lista se organiza en filas sin recortes.

---

### User Story 6 - No confundir "sin datos" con "cargando" (Priority: P2)

Quien abre una sección cuyos datos aún se están obteniendo ve el estado de carga (o de error), no un mensaje que afirme que la sección está vacía.

**Why this priority**: un falso "vacío" mientras los datos llegan hace creer que el nodo no tiene esa información y lleva a conclusiones erróneas durante el diagnóstico. Afecta a cuatro de las siete secciones.

**Independent Test**: con la actividad del nodo aún en vuelo, abrir Subagentes, Herramientas, Respuestas y Errores y comprobar que muestran carga o error, nunca vacío.

**Acceptance Scenarios**:

1. **Given** que el detalle aún está obteniendo la actividad del nodo, **When** abro Subagentes, Herramientas, Respuestas o Errores, **Then** veo el estado de carga (o de error) y no un mensaje de "sin datos".
2. **Given** que la obtención de la actividad falla, **When** abro cualquiera de esas cuatro secciones, **Then** veo el estado de error, coherente con el resto del panel.
3. **Given** que la actividad se ha resuelto sin contenido para una sección, **When** la abro, **Then** veo su estado vacío (ya no carga).

---

### User Story 7 - Mantener activo y foco distinguibles en alto contraste (Priority: P3)

Quien usa contraste forzado o tema claro distingue cuál es la sección activa y dónde está el foco.

**Why this priority**: requisito de accesibilidad; hoy el indicador activo del primitivo compartido de pestañas y su foco no se distinguen con suficiente separación en todos los entornos. Es de prioridad menor porque el runtime se sirve en tema oscuro y el fallo es latente.

**Independent Test**: en un entorno de contraste forzado, mirar la sección activa y recorrer con el teclado, y comprobar que se distinguen activo y foco.

**Acceptance Scenarios**:

1. **Given** un entorno de contraste forzado, **When** miro la sección activa, **Then** la distingo del resto con una separación suficiente.
2. **Given** un entorno de contraste forzado, **When** recorro la lista con el teclado, **Then** distingo dónde está el foco.

---

### Edge Cases

- **Ancho mínimo y máximo del panel**: las siete etiquetas deben leerse completas y la lista debe envolver en filas sin recorte, abreviatura ni desplazamiento horizontal.
- **Sección sin contenido**: el estado vacío solo debe aparecer después de que la fuente haya resuelto (no durante la carga ni tras un error).
- **Actividad del nodo en error**: las cuatro secciones que hoy no exponen error deben mostrar el estado de error, no vacío.
- **Nodo con anomalías de latencia**: la sección de Latencia (referencia de umbral, control del umbral y listado de respuestas medidas) debe seguir completa y operativa; las anomalías no la filtran ni la deshabilitan.
- **Cambio de nodo**: la sección activa se mantiene entre nodos; no se persiste entre aperturas del detalle.
- **Cierre y reapertura del detalle**: la sección activa vuelve a "Subagentes".
- **Anidamiento en escritorio**: dos listas de pestañas coexisten (la de vistas del panel y la de secciones); cada una debe conservar su etiqueta propia y su comportamiento.
- **Redimensionado en vivo del panel**: si la lista de secciones está a la vista, debe refluir a nuevas filas sin recortar etiquetas ni dejar contenido inaccesible.
- **Contraste forzado**: activo y foco deben seguir distinguiéndose aunque el entorno ignore los colores de fondo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El detalle del nodo MUST terminar con una lista de siete pestañas en este orden exacto: Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia.
- **FR-002**: Exactamente una pestaña MUST estar activa y su sección MUST ser la única visible; las otras seis MUST NOT mostrarse.
- **FR-003**: La pestaña activa al abrir un nodo MUST ser Subagentes; el estado es efímero (no persistido) y MUST sobrevivir al cambio de nodo, restaurándose a Subagentes al cerrar y reabrir el detalle.
- **FR-004**: El resumen (Identidad, Modelo, Métricas, Contexto con Paralelismo y Aporte al padre, Recursos, Duración mediana por herramienta) MUST permanecer como recorrido continuo, sin pestañas, y las siete secciones técnicas MUST salir de ese recorrido.
- **FR-005**: Cada sección MUST conservar su encabezado interno y su denominación actual (incluida "Respuestas"); MUST NOT renombrarse ninguna sección ni su etiqueta de pestaña. El encabezado interno se mantiene como rótulo de texto tal como está hoy (no se promueve a encabezado semántico de nivel de título ni se toca el componente de encabezado compartido); queda registrado como hallazgo fuera de alcance.
- **FR-006**: La lista de pestañas MUST envolver en varias filas; ninguna etiqueta MUST cortarse, truncarse ni abreviarse y MUST NOT haber desplazamiento horizontal.
- **FR-007**: La selección MUST funcionar con puntero y con teclado (flechas, Inicio/Fin); el foco MUST ser visible. El contraste del texto inactivo en tema claro (4.39:1, por debajo del 4.5:1 exigido) queda latente y registrado como hallazgo: MUST NOT modificarse ningún token compartido de color en este cambio (el runtime se sirve en tema oscuro).
- **FR-008**: Las cuatro secciones sin estado propio (Subagentes, Herramientas, Respuestas, Errores) MUST mostrar error y carga además de vacío, coherentes con el resto del panel.
- **FR-009**: La sección de Latencia MUST conservar su contenido completo (referencia de umbral, control del umbral y listado de respuestas medidas con sus anomalías); MUST NOT filtrarse ni deshabilitarse por haber anomalías.
- **FR-010**: El archivo y los documentos que describían el desplegable "Avanzado" MUST dejar de describirlo y MUST pasar a describir este comportamiento. El alcance de esta limpieza documental MUST limitarse a los contratos vigentes superseded y a los comentarios de los archivos de código tocados; el resto de documentos de las specs afectadas (spec/plan/tasks/quickstart/data-model/research) queda histórico y MUST NOT reescribirse.
- **FR-011**: El tablist externo "Detalle | Chat" MUST NOT cambiar de comportamiento ni de aspecto.
- **FR-012**: En móvil, el mismo detalle MUST ofrecer las siete pestañas, sin lista de destinos adicional ni navegación paralela.
- **FR-013**: La lista de secciones MUST respetar el patrón de pestañas para accesibilidad: un solo panel visible a la vez, etiqueta de la lista propia y distinta de la de la lista externa de vistas, y navegación por foco itinerante.

### Key Entities *(include if data involved)*

- **Nodo (detalle del nodo)**: unidad de observación de la ejecución multi-agente; su detalle agrupa el resumen y las secciones técnicas.
- **Resumen del nodo**: bloque continuo formado por Identidad, Modelo, Métricas, Contexto (Paralelismo y Aporte al padre), Recursos y Duración mediana por herramienta.
- **Sección técnica**: cada una de las siete vistas del detalle (Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia); conserva su encabezado interno, su denominación y su resolución de estados (error → carga → vacío → datos).
- **Pestaña del tablist**: control que nombra una sección técnica y gobierna cuál está visible; expone su estado activo/inactivo y participa en la navegación por puntero y teclado. Sin contadores ni insignias.
- **Estado de sección activa**: elección efímera de la pestaña visible; se inicia en Subagentes, se mantiene entre nodos y no se persiste.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las siete secciones son alcanzables con una sola acción desde el detalle: 0 desplegables y 0 pasos intermedios.
- **SC-002**: Ninguna sección aparece dos veces en el panel: 0 bloques duplicados entre el resumen y las pestañas, y 0 secciones del resumen dentro del área de pestañas.
- **SC-003**: Las siete etiquetas se leen completas (0 recortes, 0 abreviaturas, 0 desplazamiento horizontal) en los anchos mínimo y máximo del panel.
- **SC-004**: Cero regresiones en el flujo "Detalle | Chat" y en la navegación móvil.
- **SC-005**: Ninguna pestaña afirma "sin datos" mientras su fuente está en carga o en error: 0 casos de vacío falso en las cuatro secciones con estados hilados.
- **SC-006**: El 100 % de las secciones se alcanza con teclado (flechas, Inicio/Fin) y con puntero, con foco visible; en contraste forzado, activo y foco siguen distinguiéndose.

## Assumptions

- El usuario llega al detalle desde el panel lateral (escritorio) o desde el destino Inspector (móvil); no hay un tercer punto de entrada.
- El estado de la sección activa es de sesión de uso, no un dato de la ejecución: se inicia en Subagentes, se mantiene al cambiar de nodo y no se persiste entre aperturas del detalle.
- Aceptar una pestaña vacía por defecto es preferible a esconder las secciones tras un desplegable (apuesta del norte, coste de fricción asumido).
- El solapamiento parcial entre "Respuestas", "Herramientas" y "Preguntas y permisos" se acepta tal cual (decisión del usuario), aun siendo una fuente conocida de ambigüedad; la etiqueta "Respuestas" no se renombra.
- El descubrimiento de las secciones al final del scroll es aceptable: son las secciones técnicas y el resumen sigue siendo lo primero.
- La lista de secciones no lleva contadores ni insignias (decisión del usuario): se documenta como coste conocido de descubrimiento.
- El tamaño táctil de las pestañas mantiene la paridad visual con el tablist "Detalle | Chat" (cumple el mínimo de accesibilidad aplicable; no se agranda solo en la lista de secciones).
- Las siete secciones conservan su contenido, sus datos y su lógica interna; esta feature reordena presentación y no rediseña las secciones.
- Se asume un panel de escritorio de ancho variable y redimensionable por el usuario, y un detalle móvil como destino de pantalla completa.
- El comportamiento de la lista de pestañas (envoltura en filas, contraste del estado activo y foco visible) se corrige de forma consistente para toda la aplicación, no como excepción de esta pantalla.
