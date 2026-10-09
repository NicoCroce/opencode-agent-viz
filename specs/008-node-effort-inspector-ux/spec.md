# Feature Specification: Live Node Feedback, Effort Levels & Detail Panel UX

**Feature Branch**: `008-node-effort-inspector-ux`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Mejoras del visor: (1) animación 'pensando' en nodos en curso; (2) follow/zoom al último nodo en curso, no al padre; (3) resize del panel de detalle; (4) fullscreen del panel de detalle; (5) diff de archivos modificados estilo VSCode; (6) sistema de 5 niveles de esfuerzo por nodo."

## Clarifications

### Session 2026-10-09

- Q: ¿Cómo se calculan exactamente los 5 niveles de esfuerzo? → A: Acumulativo por condiciones: nivel base 1; +1 si lanza al menos un paralelo; +1 si supera 2× el nodo más rápido de su línea; +2 por forma alta; tope 5.
- Q: ¿Cómo se alcanza el nivel 5 con la fórmula acumulativa? → A: La forma alta vale +2 (un nivel por volumen de hijos y otro por volumen de invocaciones de herramientas): 1 + 1 (paralelos) + 1 (tiempo) + 2 (forma) = 5, alcanzable y testeable.
- Q: ¿Qué significa "el nodo activo más reciente" que enfoca el seguimiento? → A: El que empezó a ejecutarse más tarde (mayor hora de inicio).
- Q: ¿Con qué estado deben aparecer los bloques de cambios al abrir un diff? → A: Todos expandidos por defecto.
- Q: ¿El ancho del panel y su fullscreen se recuerdan entre sesiones? → A: Persistir solo el ancho; el fullscreen no se persiste y arranca cerrado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identificar el esfuerzo de cada nodo de un vistazo (Priority: P1)

Un usuario que observa una ejecución multiagente quiere saber, sin abrir el panel de detalle ni leer etiquetas, qué nodos han consumido más esfuerzo y cuáles han orquestado trabajo paralelo. Cada nodo muestra una marca de esfuerzo en una escala de 5 niveles, derivada de su comportamiento real en la ejecución.

**Why this priority**: Es la aportación nueva de mayor valor analítico: convierte el grafo en una lectura de "dónde se fue el esfuerzo". Sin ella, el usuario debe inspeccionar nodo por nodo.

**Independent Test**: Con una sesión de ejemplo que contenga nodos en serie, un nodo que lance paralelos y un nodo que dure más del doble que el más rápido de su línea, comprobar que cada uno recibe un nivel distinto y que el nivel es legible sin abrir el detalle.

**Acceptance Scenarios**:

1. **Given** un nodo sin paralelos y con duración similar al más rápido de su línea, **When** se visualiza el grafo, **Then** se muestra el nivel de esfuerzo más bajo.
2. **Given** un nodo que levantó al menos un nodo paralelo, **When** se visualiza el grafo, **Then** su nivel de esfuerzo sube respecto al mínimo.
3. **Given** un nodo cuya duración supera el doble del nodo más rápido de su misma línea, **When** se visualiza el grafo, **Then** su nivel de esfuerzo sube respecto al mínimo.
4. **Given** una ejecución aún en curso cuyos tiempos no están cerrados, **When** el usuario mira el nivel de esfuerzo, **Then** el nivel se presenta como provisional y se actualiza al cerrarse los tiempos.

---

### User Story 2 - Ver qué agentes están trabajando ahora (Priority: P1)

Un usuario que sigue una ejecución en vivo quiere distinguir de inmediato los nodos que están trabajando en este momento del resto. Los nodos activos muestran una animación continua de "pensando" que los diferencia de los completados, fallidos o pendientes.

**Why this priority**: Es el refresco de feedback más básico para leer una ejecución en vivo y hoy no existe una animación clara.

**Independent Test**: Con una sesión en vivo con varios nodos en estados distintos, comprobar que solo los activos muestran la animación, que se detiene al completarse y que respeta la preferencia de movimiento reducido.

**Acceptance Scenarios**:

1. **Given** un nodo en estado activo, **When** se muestra en el grafo, **Then** presenta una indicación continua de actividad (barrido, o marca rayada si está en bucle/reintento).
2. **Given** un nodo que pasa de activo a completado o a error, **When** cambia su estado, **Then** la animación se detiene.
3. **Given** un usuario con preferencia de movimiento reducido activada, **When** se muestran nodos activos, **Then** no hay animación en movimiento (se usa una indicación estática equivalente).

---

### User Story 3 - Seguir automáticamente al nodo activo más reciente (Priority: P1)

Un usuario que sigue una ejecución larga quiere que el visor mantenga a la vista lo que está ocurriendo ahora mismo. Con el seguimiento activado, el visor enfoca el nodo activo más reciente, no el primero que se activó.

**Why this priority**: El seguimiento es la forma principal de no perder de vista un run largo; hoy apunta al nodo equivocado.

**Independent Test**: Con una sesión donde dos nodos se activan en momentos distintos y el seguimiento activado, comprobar que el enfoque se mueve al nodo activo más reciente sin reposicionar el resto del grafo.

**Acceptance Scenarios**:

1. **Given** el seguimiento activado y un nodo activo anterior, **When** un nuevo nodo pasa a activo, **Then** el visor enfoca ese nodo más reciente.
2. **Given** el seguimiento activado, **When** no hay nodos activos, **Then** el viewport no se mueve.
3. **Given** el seguimiento desactivado y luego reactivado, **When** se reactiva, **Then** enfoca al nodo activo más reciente en ese momento.
4. **Given** el seguimiento activado, **When** llegan eventos sin cambio de nodo activo, **Then** el viewport no se reposiciona.

---

### User Story 4 - Leer el diff de archivos con formato de editor (Priority: P2)

Un usuario que inspecciona un nodo quiere entender qué cambió en cada archivo sin salir del visor. El diff se muestra con el formato de un editor: líneas añadidas/eliminadas diferenciadas por color, encabezados de bloque con su rango de líneas y numeración.

**Why this priority**: Aporta mucho valor de lectura, pero depende de que el panel de detalle sea cómodo (Usuario 5/6) y no bloquea el resto.

**Independent Test**: Con un nodo que modifica un archivo, comprobar que el diff muestra líneas añadidas y eliminadas distinguibles por color, encabezados de bloque y numeración, y que se puede colapsar un bloque.

**Acceptance Scenarios**:

1. **Given** un archivo modificado con líneas añadidas y eliminadas, **When** se abre su diff, **Then** cada tipo de línea es visualmente distinguible.
2. **Given** un diff con varios bloques de cambios, **When** se muestra, **Then** cada bloque tiene un encabezado con su rango de líneas y puede colapsarse y expandirse.
3. **Given** un archivo añadido o eliminado, **When** se muestra, **Then** su estado se distingue del de un archivo modificado.
4. **Given** un cambio sin salto de línea final o un archivo sin cambios de contenido, **When** se muestra, **Then** el diff no se rompe ni muestra líneas espurias.

---

### User Story 5 - Ajustar el ancho del panel de detalle (Priority: P2)

Un usuario que inspecciona contenido ancho (diffs, invocaciones) quiere adaptar el panel de detalle a lo que está leyendo, arrastrando su borde para ensancharlo o estrecharlo.

**Why this priority**: Mejora la lectura pero el panel sigue siendo usable sin ello.

**Independent Test**: Con un nodo seleccionado, arrastrar el separador del panel y comprobar que el ancho cambia dentro de límites razonables y que el contenido no se altera.

**Acceptance Scenarios**:

1. **Given** el panel de detalle visible, **When** el usuario arrastra el separador, **Then** el ancho del panel cambia siguiendo el arrastre.
2. **Given** un arrastre más allá de los límites, **When** el usuario suelta, **Then** el ancho queda dentro del mínimo y el máximo definidos.
3. **Given** un cambio de ancho, **When** el usuario sigue navegando, **Then** el grafo y el contenido del panel no se ven alterados.

---

### User Story 6 - Ver el panel de detalle a pantalla completa (Priority: P3)

Un usuario que necesita leer un diff o un contenido largo quiere expandir el panel de detalle a toda el área de trabajo y volver al layout normal.

**Why this priority**: Es una comodidad de lectura puntual; el resto de mejoras ya aportan valor sin ella.

**Independent Test**: Con un nodo seleccionado, expandir el panel a pantalla completa, comprobar que conserva el contenido, y volver al layout normal con el mismo control y con Escape.

**Acceptance Scenarios**:

1. **Given** el panel de detalle con contenido, **When** el usuario lo expande, **Then** ocupa toda el área de trabajo conservando el mismo contenido y estados.
2. **Given** el panel expandido, **When** el usuario pulsa el control de salir o Escape, **Then** vuelve al layout normal.
3. **Given** el panel expandido mientras llegan eventos, **When** el contenido se actualiza, **Then** el estado de pantalla correcto (carga, error, vacío, datos) se mantiene.

---

### Edge Cases

- Ejecución sin nodos activos: ni animación ni movimiento de viewport.
- Cambio rápido entre varios nodos activos: el enfoque no debe "temblar" ni encadenar movimientos por cada evento.
- Un nodo activo que se completa justo cuando el enfoque iba hacia él: el enfoque no debe fallar ni dejar la vista fuera de sitio.
- Nivel de esfuerzo con duración aún abierta (nodo activo) o desconocida: se trata como provisional, nunca como valor final.
- Línea con un solo nodo: el más rápido es el propio nodo; no debe inflarse el nivel artificialmente.
- Nodos paralelos sin duración registrada: el nivel no debe quedar indefinido.
- Diff vacío, binario o de solo renombrado: no debe romper el render ni mostrar contenido engañoso.
- Resize en ventanas pequeñas/móvil: el patrón de presentación debe seguir siendo usable.
- Fullscreen con el panel en estado de error o vacío: debe conservar el estado de pantalla correcto.

## Requirements *(mandatory)*

### Functional Requirements

**Feedback de nodos activos**

- **FR-001**: Todo nodo en estado activo DEBE mostrar una indicación continua de que está trabajando: la animación de barrido del rail, o la marca rayada de bucle/reintento como indicación estática equivalente.
- **FR-002**: La animación DEBE detenerse en cuanto el nodo deja de estar activo.
- **FR-003**: La animación DEBE respetar la preferencia de movimiento reducido del sistema, ofreciendo una indicación estática equivalente.
- **FR-004**: Los nodos no activos NO deben mostrar la animación de actividad.

**Seguimiento del nodo activo**

- **FR-005**: Con el seguimiento activado, el visor DEBE enfocar el nodo activo más reciente (el que empezó a ejecutarse más tarde, según su hora de inicio de ejecución, y solo como último recurso la fecha de creación de la sesión), no el primero que se activó.
- **FR-006**: El enfoque DEBE actualizarse cuando cambia el nodo activo, sin reposicionar el conjunto del grafo.
- **FR-007**: Con el seguimiento activado y sin nodos activos, el viewport NO debe moverse.
- **FR-008**: Al reactivar el seguimiento, el visor DEBE enfocar al nodo activo más reciente en ese momento.
- **FR-009**: Llegada de eventos sin cambio de nodo activo NO debe producir movimiento de viewport.

**Panel de detalle: ancho**

- **FR-010**: El usuario DEBE poder redimensionar el ancho del panel de detalle arrastrando un separador, y el ancho ajustado DEBE persistirse entre sesiones.
- **FR-011**: El ancho DEBE respetar un mínimo y un máximo que garanticen legibilidad.
- **FR-012**: El redimensionado NO debe alterar el contenido del panel ni el grafo.

**Panel de detalle: pantalla completa**

- **FR-013**: El usuario DEBE poder expandir el panel de detalle a toda el área de trabajo y volver al layout normal (presentación de escritorio). La expansión NO se persiste: al abrir la app el panel arranca en layout normal.
- **FR-014**: La expansión DEBE conservar el mismo contenido y los estados de pantalla (carga, error, vacío, datos).
- **FR-015**: La expansión DEBE poder cerrarse con el mismo control y con la tecla Escape.

**Diff de archivos**

- **FR-016**: El diff DEBE distinguir visualmente líneas añadidas, eliminadas y de contexto mediante color y estilo.
- **FR-017**: El diff DEBE mostrar, por cada bloque de cambios, un encabezado con su rango de líneas y permitir colapsarlo y expandirlo. Por defecto, todos los bloques DEBEN aparecer expandidos.
- **FR-018**: El diff DEBE mostrar la numeración de línea del archivo anterior y del nuevo.
- **FR-019**: El diff DEBE distinguir el estado del archivo (añadido, eliminado, modificado).
- **FR-020**: El diff DEBE manejar de forma segura casos límite (sin salto de línea final, sin cambios de contenido, contenido no textual) sin romper el render.

**Niveles de esfuerzo**

- **FR-021**: Cada nodo DEBE mostrar un nivel de esfuerzo en una escala de 5 niveles, garantizando el nivel base 1 incluso en nodos sin duración registrada.
- **FR-022**: El nivel DEBE calcularse de forma acumulativa sobre un nivel base 1, sumando las condiciones cumplidas y con un tope de 5 niveles; con todas las condiciones cumplidas se alcanza el nivel 5 (ver FR-024 y FR-025).
- **FR-023**: "Misma línea" se define como la tanda de ejecución a la que pertenece el nodo.
- **FR-024**: Sobre el nivel base 1, un nodo DEBE subir un nivel si levanta al menos un nodo paralelo, y subir otro nivel si su duración supera el doble de la del nodo más rápido de su misma línea.
- **FR-025**: Un nodo DEBE subir hasta dos niveles adicionales por su forma alta: un nivel si lanza un número elevado de hijos y otro nivel si realiza un número elevado de invocaciones de herramientas. El resultado nunca supera el nivel 5.
- **FR-026**: El nivel DEBE identificarse de un vistazo mediante una marca visual (medidor de 5 muescas), con una descripción accesible por nodo que enumere los motivos que fijan su nivel. Una leyenda global de los 5 niveles es opcional y no sustituye a la descripción por nodo.
- **FR-027**: El nivel DEBE ser informativo y de solo lectura, nunca editable por el usuario.
- **FR-028**: Con la ejecución en curso, el nivel DEBE tratarse como provisional y recalcularse al cerrarse los tiempos.

### Key Entities *(include if feature involves data)*

- **Nivel de esfuerzo**: valor en una escala de 5 niveles asignado a cada nodo, derivado de su paralelismo, su duración relativa dentro de su línea y su forma. No editable.
- **Línea (tanda de ejecución)**: agrupación de nodos usada como referencia para comparar duraciones.
- **Cambio de archivo**: archivo tocado por un nodo, con su estado (añadido, eliminado, modificado) y su contenido de cambios.
- **Bloque de cambios (hunk)**: fragmento contiguo de cambios dentro de un archivo, con rango de líneas.
- **Línea de diff**: línea individual clasificada como añadida, eliminada o de contexto, con su numeración anterior y nueva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario identifica qué agentes están trabajando en este momento en menos de 2 segundos desde que un nodo pasa a activo.
- **SC-002**: Un usuario distingue el nivel de esfuerzo de un nodo en menos de 2 segundos y sin abrir su panel de detalle.
- **SC-003**: Con el seguimiento activado, el nodo activo más reciente permanece visible sin intervención manual en el 100% de los cambios de nodo activo.
- **SC-004**: Un diff de hasta 20 archivos permite identificar añadidos y eliminados por color en menos de 1 segundo.
- **SC-005**: Un usuario adapta el panel a la lectura que necesita (ancho a medida o pantalla completa) en una sola interacción y recupera el layout normal en una sola interacción.
- **SC-006**: La fluidez del grafo no se degrada respecto al comportamiento actual con ejecuciones grandes (del orden de 150 nodos): el coste de las nuevas marcas y animaciones no debe ser perceptible.
- **SC-007**: Todos los controles nuevos (separador de resize, expandir/colapsar, colapsar bloques de diff) son operables por teclado y anunciados de forma accesible.
- **SC-008**: El comportamiento está cubierto por pruebas de reglas reales (derivación de niveles, selección del nodo a seguir, formato del diff, límites del resize).

## Assumptions

- Las 6 mejoras se entregan como **una sola feature** con historias independientes.
- **"Misma línea" = tanda de ejecución** del nodo (la agrupación de nodos lanzados en la misma tanda), decisión del usuario.
- **Esfuerzo = duración + forma**: la base son paralelismo y duración relativa; el número de hijos e invocaciones de herramientas puede modular el nivel dentro de la misma escala.
- **El diff reproduce el formato de un editor completo**: color por línea, numeración, encabezados de bloque colapsables.
- El **ancho** del panel de detalle se **persiste entre sesiones**; el estado de **pantalla completa** no se persiste y arranca cerrado.
- El nivel de esfuerzo es **acumulativo**: base 1, más un nivel por paralelismo, más un nivel por superar 2× el más rápido de su línea, más **dos** niveles por forma alta (hijos e invocaciones), con tope en 5 y máximo alcanzable.
- La app sigue siendo un **observador de solo lectura**: ninguna mejora envía datos al servidor ni modifica el estado de la ejecución.
- El **resize** y el **fullscreen** del panel son de presentación de escritorio; en presentaciones compactas (móvil) el panel sigue siendo una pestaña, con una sola fuente de lógica y dos presentaciones.
- La **dirección visual** (paleta de los 5 niveles, estilo de la animación, colores del diff y del panel) se define en la fase de planificación con criterios de diseño de interfaz, partiendo de los tokens existentes del visor.
- La paleta y los tokens de estado actuales del visor se reutilizan; no se introduce una identidad visual paralela.
