# Feature Specification: Reordenar y agrupar el panel de detalles

**Feature Branch**: `004-inspector-panel-layout`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Quiero que en el panel de detalles se visualice la información en este orden: Modelo, Métricas, Recursos, Duración mediana por herramienta, Subagentes, Archivos, Avanzado (Herramientas, Respuestas, ...). 'Avanzado' quiero que sea un desplegable más, no quiero que se muestre directamente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Orden predecible de las secciones principales (Priority: P1)

Como persona que observa una ejecución multi-agente, al seleccionar un nodo en el grafo quiero ver primero los datos de identificación y salud del agente (Modelo, Métricas, Recursos) y después su impacto y su estructura (Duración mediana por herramienta, Subagentes, Archivos), para entender de un vistazo qué hizo el agente y con qué recursos, sin tener que recorrer una lista larga.

**Why this priority**: Es el núcleo de la petición. Sin el orden correcto, el resto (el desplegable) no aporta valor.

**Independent Test**: Seleccionar un nodo y comprobar, de arriba a abajo, que las secciones aparecen en el orden Modelo → Métricas → Recursos → Duración mediana por herramienta → Subagentes → Archivos. Entrega valor por sí sola: el panel ya queda ordenado.

**Acceptance Scenarios**:

1. **Given** un nodo seleccionado con datos, **When** se muestra el panel de detalles, **Then** las secciones aparecen exactamente en el orden: Modelo, Métricas, Recursos, Duración mediana por herramienta, Subagentes, Archivos, Avanzado.
2. **Given** un nodo seleccionado, **When** se muestra el panel, **Then** la cabecera de identidad del agente (título, agente, estado, directorio, invocado por) permanece en la parte superior, por encima de Modelo.
3. **Given** un nodo con evidencia de reintentos, **When** se muestra la sección Métricas, **Then** el aviso de Loop se muestra dentro de Métricas.

---

### User Story 2 - "Avanzado" colapsado por defecto (Priority: P1)

Como persona que observa una ejecución, quiero que el contenido técnico y detallado (Herramientas, Respuestas, Preguntas y permisos, Errores) quede dentro de un desplegable "Avanzado" cerrado por defecto, para que el panel no me abrume con detalle y yo decida cuándo abrirlo.

**Why this priority**: Es la segunda parte explícita de la petición ("no quiero que se muestre directamente"). Sin esto, el panel seguiría siendo tan largo como antes.

**Independent Test**: Seleccionar un nodo y comprobar que Herramientas, Respuestas, Preguntas y permisos y Errores no son visibles hasta expandir "Avanzado", y que al expandirlo aparecen. Entrega valor por sí sola.

**Acceptance Scenarios**:

1. **Given** un nodo seleccionado, **When** se muestra el panel por primera vez, **Then** la sección "Avanzado" aparece colapsada y su contenido no es visible.
2. **Given** "Avanzado" colapsado, **When** el usuario lo expande, **Then** se muestran, en este orden: Herramientas, Respuestas, Preguntas y permisos, Errores.
3. **Given** "Avanzado" expandido, **When** el usuario lo colapsa, **Then** su contenido vuelve a ocultarse y el resto del panel no cambia de orden.

---

### User Story 3 - "Subagentes" agrupa tareas y paralelismo (Priority: P2)

Como persona que observa una ejecución, quiero que las tareas delegadas y los agentes que corren en paralelo se muestren juntos bajo un único encabezado "Subagentes", para entender la estructura de delegación en un solo bloque.

**Why this priority**: Mejora la claridad, pero es secundaria frente al orden general y al desplegable.

**Independent Test**: Seleccionar un nodo con tareas de subagente y con agentes en paralelo y comprobar que ambos contenidos conviven bajo "Subagentes". Entrega valor por sí sola.

**Acceptance Scenarios**:

1. **Given** un nodo con tareas de subagente y/o agentes en paralelo, **When** se muestra la sección Subagentes, **Then** ambos contenidos aparecen bajo ese único encabezado.
2. **Given** un nodo sin tareas de subagente ni agentes en paralelo, **When** se muestra la sección Subagentes, **Then** se muestra un estado vacío explícito.

---

### Edge Cases

- **Nodo sin datos**: si faltan métricas, recursos, herramientas, archivos, tareas o errores, cada sección muestra su estado vacío explícito sin desaparecer ni romper el orden.
- **Avanzado colapsado con contenido crítico**: cuando hay errores o preguntas pendientes pero "Avanzado" está cerrado, no se añade ningún aviso ni badge en este alcance; el desplegable permanece cerrado hasta que el usuario lo abre (ver Assumptions).
- **Cambio de nodo**: al seleccionar otro nodo, el panel se recompone con el nuevo contenido; el estado de expansión de "Avanzado" se conserva durante la sesión de UI.
- **Sin nodo seleccionado**: se mantiene el mensaje actual de "Selecciona un nodo del grafo".
- **Duración mediana sin datos de tiempo**: la sección Duración mediana debe seguir indicando "no disponible" para las herramientas sin tiempos, sin ocultar el resto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El panel de detalles MUST presentar sus secciones, de arriba a abajo, en este orden: Modelo, Métricas, Recursos, Duración mediana por herramienta, Subagentes, Archivos, Avanzado.
- **FR-002**: El panel MUST mantener la cabecera de identidad del agente (título, agente, estado, directorio e invocado por) en la parte superior, por encima de la sección Modelo.
- **FR-003**: La sección Modelo MUST mostrar el nombre del modelo (proveedor/modelo) y su variante de razonamiento, y colocarse inmediatamente después de la cabecera.
- **FR-004**: La sección Métricas MUST mostrar duración, costo, invocaciones y tokens (entrada, salida, razonamiento, caché), y MUST mostrar el aviso de Loop dentro de ella cuando exista evidencia de reintentos.
- **FR-005**: La sección Recursos MUST colocarse inmediatamente después de Métricas y conservar su contenido actual (MCP, instrucciones, skills y herramientas disponibles).
- **FR-006**: El panel MUST exponer una sección independiente "Duración mediana por herramienta", ubicada después de Recursos, con el nombre de cada herramienta, su número de llamadas y su duración mediana (o "no disponible" si no hay tiempos).
- **FR-007**: La sección "Subagentes" MUST colocarse después de Duración mediana por herramienta y agrupar bajo un único encabezado las tareas del subagente y los agentes en paralelo.
- **FR-008**: La sección Subagentes MUST mostrar un estado vacío explícito cuando no haya tareas de subagente ni agentes en paralelo.
- **FR-009**: La sección Archivos MUST colocarse después de Subagentes y conservar su comportamiento actual (lista de archivos con estado y líneas, y visualización del parche seleccionado).
- **FR-010**: El panel MUST incluir una sección "Avanzado" después de Archivos, presentada como un desplegable colapsado por defecto.
- **FR-011**: La sección Avanzado MUST agrupar, en este orden, las secciones Herramientas, Respuestas, Preguntas y permisos y Errores.
- **FR-012**: El usuario MUST poder expandir y colapsar la sección Avanzado mediante una acción explícita.
- **FR-013**: La sección Herramientas (dentro de Avanzado) MUST listar las ejecuciones de herramientas con su estado y duración, sin incluir el resumen de duración mediana, que pasa a ser una sección propia fuera de Avanzado.
- **FR-014**: La sección Respuestas MUST conservar su comportamiento actual (entradas conversacionales en orden cronológico, alternado de razonamiento y acceso al histórico completo).
- **FR-015**: La sección Errores MUST mostrarse dentro de Avanzado y MUST ofrecer un estado vacío explícito cuando no haya errores.
- **FR-016**: Tras el reordenamiento, todas las secciones con datos MUST conservar sus estados de pantalla (error → carga → vacío → datos).

### Key Entities

No introduce entidades de datos nuevas: reutiliza el nodo de ejecución ya existente y sus métricas, recursos, herramientas, archivos, tareas y errores. La feature es un cambio de presentación y agrupación de la información existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede localizar Modelo, Métricas, Recursos, Duración mediana por herramienta, Subagentes y Archivos sin expandir ningún desplegable.
- **SC-002**: El contenido técnico (Herramientas, Respuestas, Preguntas y permisos y Errores) permanece oculto por defecto y requiere una acción del usuario para mostrarse.
- **SC-003**: El orden visual de las secciones coincide al 100% con el orden especificado en FR-001, verificable por inspección del panel.
- **SC-004**: No se pierde ninguna sección ni dato presente en el panel actual (0 regresiones de contenido).

## Assumptions

- La cabecera de identidad del agente se mantiene siempre visible en la parte superior; no forma parte del reordenamiento solicitado.
- "Avanzado" se inicializa colapsado en cada apertura de la app; se conserva expandido/colapsado solo mientras dura la sesión de UI (p. ej., al cambiar de nodo).
- No se añaden avisos ni badges a la sección "Avanzado" cuando su contenido incluye errores o preguntas pendientes; el alcance se limita a agrupar y ocultar por defecto.
- "Subagentes" reutiliza los datos ya disponibles en el panel (tareas del subagente y agentes en paralelo); no requiere exponer datos nuevos desde el grafo.
- La feature no cambia el origen ni la obtención de datos: solo la organización y visibilidad de las secciones.
- Se mantienen las convenciones del proyecto (arquitectura por dominios, estados de pantalla, tests junto al código).
