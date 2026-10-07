# Feature Specification: Refinamientos de experiencia del visor

**Feature Branch**: `002-viz-ux-refinements`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "(1) Que pueda hacer resize del bloque de agente visual porque se tapa la imagen. (2) Que en las herramientas solo muestre las 10 primeras, con una flecha hacia abajo para mostrar más. (3) Que al seleccionar un nodo, el resto desaparezca y lo muestre en una sola línea, para entender mejor cómo fue la cadena de ejecución. (4) Quiero que muestres el nombre de la sesión arriba y abajo el agente ejecutado. (5) Que la hora muestre inicio - última ejecución."

## Clarifications

### Session 2026-10-03

- Q: ¿Qué debe poder ajustar el usuario exactamente al redimensionar el bloque de un agente? → A: Ancho y alto, arrastrando la esquina o el borde del nodo directamente en el grafo.
- Q: Para nodos y sesiones, ¿qué significa la hora de "última ejecución" del rango "inicio – última ejecución"? → A: Es la hora de fin real de la ejecución; si el agente todavía corre, el rango se muestra como "inicio – en curso" en lugar de una hora que cambia sola. Para la tarjeta de sesión, el fin es la última marca de tiempo que el servidor reporta para la sesión.
- Q: Estando en el modo cadena (solo la cadena visible), ¿cómo vuelve el usuario al grafo completo? → A: Con clic en el fondo del grafo o la tecla Escape (deselecciona y restaura todos los nodos).
- Q: En el historial de herramientas, ¿cuáles son esas "10 primeras" que deben quedar visibles? → A: Las 10 primeras en el orden cronológico actual, sin invertir la lista; la flecha despliega las restantes hacia abajo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el nodo completo sin que se tape el contenido (Priority: P1)

Como desarrollador que revisa el grafo, quiero poder agrandar el bloque de un agente cuando su contenido no entra, para poder leer el nombre del modelo, la herramienta actual y las métricas sin que se superpongan entre sí.

**Why this priority**: Hoy el contenido del nodo se corta o se pisa (imagen 1), lo que impide leer datos básicos del agente. Es un defecto de legibilidad del elemento más importante de la pantalla.

**Independent Test**: Abrir una sesión con un nodo cuyo contenido exceda el ancho/alto actual, ajustar su tamaño y comprobar que todo el contenido se ve completo y sin superposición.

**Acceptance Scenarios**:

1. **Given** un nodo cuyo contenido no entra en su tamaño actual, **When** el usuario agranda el bloque arrastrando su esquina o borde, **Then** todo el contenido del nodo se muestra completo y sin superponerse.
2. **Given** un nodo agrandado por el usuario, **When** llega nueva actividad en vivo del agente, **Then** el tamaño elegido se mantiene y no se revierte.
3. **Given** un nodo en el grafo, **When** el usuario pasa el cursor sobre él, **Then** percibe que el bloque se puede redimensionar.

---

### User Story 2 - Aislar la cadena de ejecución de un nodo (Priority: P1)

Como desarrollador, quiero que al seleccionar un nodo el resto del grafo desaparezca y quede visible solo la cadena que llevó hasta él, en una sola línea, para entender de un vistazo cómo se orquestó esa ejecución.

**Why this priority**: Es la mejora de mayor valor analítico del pedido: convierte un grafo denso e ilegible (imagen 3) en la historia concreta de un agente.

**Independent Test**: Seleccionar un nodo con al menos un ancestro y comprobar que solo se ven los nodos de la cadena raíz→nodo, alineados en una fila y en orden de ejecución; volver a la vista completa.

**Acceptance Scenarios**:

1. **Given** un grafo con varios nodos y ramas, **When** el usuario selecciona un nodo, **Then** solo permanecen visibles los nodos y conexiones de la cadena raíz→nodo seleccionado.
2. **Given** el modo cadena activo, **When** el usuario observa la disposición, **Then** los nodos aparecen en una sola línea, en el orden raíz→…→nodo seleccionado.
3. **Given** el modo cadena activo, **When** el usuario hace clic en el fondo del grafo o presiona Escape, **Then** vuelve a ver el grafo completo con todos sus nodos y conexiones.
4. **Given** un nodo seleccionado, **When** el usuario lo inspecciona dentro de la cadena, **Then** puede distinguir cuál es el nodo seleccionado y cuáles sus ancestros.

---

### User Story 3 - Ver el historial de herramientas sin una lista infinita (Priority: P2)

Como desarrollador que inspecciona un agente, quiero que el historial de herramientas muestre solo las primeras diez y me ofrezca desplegar el resto, para no recorrer una lista larguísima (imagen 2) antes de llegar a otras secciones del panel.

**Why this priority**: Reduce el ruido y el scroll en el panel de inspector, pero no bloquea ningún diagnóstico: todo sigue accesible.

**Independent Test**: Abrir el inspector de un nodo con más de diez herramientas y comprobar que se ven diez, un control para desplegar el resto y el total oculto.

**Acceptance Scenarios**:

1. **Given** un nodo con más de diez ejecuciones de herramientas, **When** el usuario abre su inspector, **Then** ve solo las diez primeras en el orden cronológico actual y un control para mostrar más.
2. **Given** la lista colapsada, **When** el usuario activa el control, **Then** se muestran hacia abajo las herramientas restantes y el control permite volver a contraer.
3. **Given** un nodo con diez herramientas o menos, **When** el usuario abre su inspector, **Then** no aparece el control de expansión y se ven todas.

---

### User Story 4 - Identificar la sesión y su agente de un vistazo (Priority: P2)

Como desarrollador, quiero que cada tarjeta de la lista muestre arriba el nombre de la sesión y abajo el agente que la ejecutó, para reconocer de qué se trata antes de mirar detalles técnicos.

**Why this priority**: El título es el identificador natural para una persona; hoy el agente ocupa el lugar principal (imagen 4) y obliga a leer la segunda línea.

**Independent Test**: Observar la lista de sesiones y comprobar que en cada tarjeta el título de la sesión aparece en la línea principal y el agente en la línea secundaria.

**Acceptance Scenarios**:

1. **Given** una sesión con título y agente, **When** el usuario mira su tarjeta, **Then** el título aparece arriba y el agente debajo.
2. **Given** una sesión sin agente reportado, **When** el usuario mira su tarjeta, **Then** la línea del agente muestra "agente no disponible" en lugar de quedar en blanco.

---

### User Story 5 - Ver el rango horario de la ejecución (Priority: P3)

Como desarrollador, quiero ver desde qué hora hasta qué hora corrió una sesión o un agente, para ubicar la ejecución en el tiempo y estimar su ventana real.

**Why this priority**: Aporta contexto temporal útil, pero es información secundaria frente a la duración y las métricas ya existentes.

**Independent Test**: Comprobar que la tarjeta de sesión y el nodo del grafo muestran "inicio – última ejecución" con las horas del servidor.

**Acceptance Scenarios**:

1. **Given** una sesión terminada con hora de inicio y de fin, **When** el usuario mira su tarjeta, **Then** ve ambas horas en formato "inicio – última ejecución".
2. **Given** un nodo terminado con hora de inicio y de fin, **When** el usuario mira el nodo, **Then** ve el mismo rango horario.
3. **Given** un nodo que sigue en ejecución, **When** el usuario mira el nodo, **Then** el rango se muestra como "inicio – en curso".
4. **Given** un origen que no reporta alguna de las horas (y la ejecución no está en curso), **When** el usuario mira la tarjeta o el nodo, **Then** se indica "no disponible" en lugar de mostrar una hora inventada.

---

### Edge Cases

- ¿Qué ocurre cuando el nodo seleccionado es la raíz? La cadena es de un solo nodo y la vista debe seguir siendo legible.
- ¿Qué ocurre cuando la cadena tiene muchos ancestros? Debe poder leerse completa sin perder el orden, ajustando la vista si hace falta.
- ¿Qué ocurre si el nodo seleccionado desaparece del grafo (por ejemplo, al cambiar de sesión)? La vista vuelve al grafo completo sin quedar en un estado vacío inconsistente.
- ¿Qué ocurre con un historial de exactamente diez herramientas? No se muestra el control de expansión.
- ¿Qué ocurre si llegan herramientas nuevas mientras el historial está colapsado? El total oculto se actualiza y las diez visibles siguen siendo las más antiguas de la lista.
- ¿Qué ocurre cuando el usuario redimensiona un nodo y luego cambia de sesión? El tamaño ajustado no debe afectar a nodos de otras sesiones.
- ¿Qué ocurre en pantallas pequeñas? Las mejoras deben seguir siendo utilizables sin duplicar la lógica de la vista de escritorio.
- ¿Qué ocurre con un nodo o una sesión que sigue en ejecución? El rango se muestra como "inicio – en curso", sin una hora final que cambie sola.
- ¿Qué ocurre si una sesión no tiene hora de última actividad y no está en curso? Se muestra el inicio y se indica "no disponible" en el extremo faltante.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir al usuario ajustar el ancho y el alto del bloque de un nodo de agente arrastrando su esquina o su borde directamente sobre el grafo.
- **FR-002**: El sistema MUST mostrar el contenido del nodo sin superposición ni recorte ilegible una vez ajustado su tamaño.
- **FR-003**: El sistema MUST preservar el tamaño ajustado por el usuario durante las actualizaciones en vivo y hasta que el usuario cambie de sesión.
- **FR-004**: El sistema MUST mostrar un tirador visible en el nodo que haga perceptible que el bloque se puede redimensionar.
- **FR-005**: Al seleccionar un nodo, el sistema MUST ocultar todos los nodos y conexiones que no pertenezcan a la cadena de ejecución entre la raíz de la sesión y el nodo seleccionado.
- **FR-006**: El sistema MUST disponer la cadena visible en una sola línea, ordenada de raíz a nodo seleccionado.
- **FR-007**: El sistema MUST permitir volver al grafo completo, con todos sus nodos y conexiones, dejando de estar en modo cadena mediante un clic en el fondo del grafo o la tecla Escape.
- **FR-008**: El sistema MUST distinguir visualmente el nodo seleccionado del resto de los nodos de la cadena.
- **FR-009**: El sistema MUST mostrar como máximo diez entradas del historial de herramientas antes de cualquier expansión, respetando el orden cronológico actual de la lista.
- **FR-010**: El sistema MUST ofrecer un control para expandir el historial y ver las entradas restantes hacia abajo, y para volver a contraerlo.
- **FR-011**: El sistema MUST mostrar el control de expansión solo cuando existan más de diez entradas.
- **FR-012**: El sistema MUST indicar cuántas entradas del historial permanecen ocultas.
- **FR-013**: La tarjeta de sesión MUST mostrar el nombre de la sesión como texto principal y el agente ejecutado como texto secundario.
- **FR-014**: La tarjeta de sesión MUST mostrar el rango horario "inicio – última ejecución" usando la última marca de tiempo reportada por el servidor para la sesión; si la sesión está activa, MUST mostrarse como "inicio – en curso".
- **FR-015**: El nodo del grafo MUST mostrar el rango horario "inicio – última ejecución" usando la hora de fin real; mientras el agente siga en curso (incluye cuando espera permiso), MUST mostrarse como "inicio – en curso".
- **FR-016**: Cuando falte alguna de las horas, el sistema MUST indicar "no disponible" en lugar de un valor inventado o en blanco.
- **FR-017**: El sistema MUST mantener los estados obligatorios de pantalla (error, cargando, vacío, datos) en todas las vistas afectadas.
- **FR-018**: El sistema MUST mantener la estética de modo oscuro y diseño flat, con contraste legible.
- **FR-019**: El sistema MUST seguir siendo de solo lectura: ninguna de estas mejoras envía prompts, aborta sesiones ni responde permisos.
- **FR-020**: El sistema MUST adaptar las mejoras a pantallas pequeñas sin duplicar la lógica de negocio.

### Key Entities *(include if feature involves data)*

- **Nodo de agente**: representación visual de un agente; incorpora un tamaño ajustable por el usuario que no altera sus datos.
- **Cadena de ejecución**: secuencia de ancestros desde la raíz de la sesión hasta un nodo seleccionado, en orden de ejecución.
- **Modo cadena**: estado de la vista en el que solo se muestra la cadena del nodo seleccionado, en una sola línea.
- **Historial de herramientas**: secuencia de ejecuciones de herramientas de un agente, mostrada de forma truncable.
- **Tarjeta de sesión**: resumen de una sesión con su nombre, agente, estado y rango horario.
- **Rango horario de ejecución**: par formado por la hora de inicio y la hora de fin real reportadas por el servidor; mientras la ejecución avanza, el extremo final se expresa como "en curso".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para el 100% de los nodos con contenido que excede su tamaño por defecto, el usuario consigue ver el contenido completo ajustando el bloque, sin superposiciones.
- **SC-002**: Ningún ajuste de tamaño se revierte por una actualización en vivo (0 reversiones observadas durante una ejecución activa).
- **SC-003**: Tras seleccionar un nodo, el usuario identifica la cadena de ejecución completa en menos de 10 segundos, sin hacer zoom ni scroll manual.
- **SC-004**: El usuario vuelve a la vista completa del grafo con un solo gesto (clic en el fondo o tecla Escape) desde el modo cadena.
- **SC-005**: El usuario accede a la herramienta número 11 de un historial con un solo clic.
- **SC-006**: El usuario reconoce el nombre y el agente de una sesión en menos de 3 segundos por tarjeta.
- **SC-007**: El rango horario "inicio – última ejecución" se muestra correctamente en el 100% de las sesiones y nodos que reportan ambas horas.
- **SC-008**: El usuario distingue "no disponible" de una hora real en el 100% de los casos en que falta un dato.
- **SC-009**: Ninguna de las mejoras introduce regresiones en los estados de conexión, carga, vacío o error de las vistas afectadas.

## Assumptions

- El ajuste de tamaño es iniciado por el usuario, se aplica por nodo y no se persiste entre recargas, en línea con la ausencia de persistencia ya asumida en el producto.
- El tamaño ajustado sobrevive a las actualizaciones en vivo mientras el usuario permanece en la misma sesión.
- La cadena de ejecución considerada es la de ancestros (raíz → nodo seleccionado); no incluye descendientes del nodo.
- "Historial de herramientas" se refiere a la sección de herramientas del panel de inspector.
- El rango horario usa la hora de inicio y la hora de fin real reportadas por el servidor; mientras la ejecución está en curso se muestra "inicio – en curso" y, si falta un dato sin estar en curso, se indica "no disponible".
- El fin horario de la tarjeta de sesión es la última marca de tiempo que el servidor reporta para la sesión, no una derivación del último mensaje: evita consultas adicionales por cada sesión listada. El nodo del grafo sí usa el fin real reportado por su propia ejecución.
- El historial de herramientas conserva su orden cronológico actual: las diez visibles son las más antiguas de la lista y las ocultas son las más recientes.
- En el nodo del grafo, el rango horario convive con la duración ya existente, sin reemplazarla.
- El umbral de diez entradas del historial es fijo en esta versión y no es configurable por el usuario.
- Se mantiene la estética Dark Mode / Flat Design y la condición de aplicación de solo lectura.
- Las mejoras se priorizan para escritorio, pero deben seguir siendo utilizables en pantallas pequeñas.
