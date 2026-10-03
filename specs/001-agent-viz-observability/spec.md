# Feature Specification: OpenCode Agent Viz — Observabilidad Multi-Agente

**Feature Branch**: `001-agent-viz-observability`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Implementar el visor de ejecuciones multi-agente de OpenCode descrito en docs/agent-viz-plan.md, y agregar si es posible: (1) el tiempo que demandó ejecutar cada agente y subagente, (2) las skills, instructions, MCP, etc. que utilizó, (3) costo por token o dinero, (4) cuántas veces se ejecutó o si entró en un loop. Diseño de front con estilo Dark Mode - Flat Design."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el estado de conexión con OpenCode (Priority: P1)

Como desarrollador que ejecuta un flujo multi-agente, quiero ver de un vistazo si el visor está conectado al servidor de OpenCode, para saber si los datos que veo están vivos o congelados.

**Why this priority**: Sin conexión no hay datos. Es la base de confianza de todo el producto: el usuario debe distinguir entre "no hay actividad" y "perdí la conexión".

**Independent Test**: Abrir la app con el servidor disponible y ver "Conectado"; detener el servidor y ver "Desconectado"; reiniciarlo y ver "Reconectando" y luego "Conectado" de nuevo.

**Acceptance Scenarios**:

1. **Given** el servidor de OpenCode está disponible, **When** el usuario abre el visor, **Then** la interfaz muestra el estado "Conectado" de forma permanente y visible.
2. **Given** el visor está conectado, **When** el servidor deja de responder, **Then** el estado cambia a "Desconectado" sin que la interfaz quede bloqueada.
3. **Given** el visor está desconectado, **When** el servidor vuelve a estar disponible, **Then** el estado pasa por "Reconectando" y termina en "Conectado", y los datos se resincronizan con el servidor.

---

### User Story 2 - Listar y elegir sesiones raíz (Priority: P1)

Como desarrollador, quiero ver la lista de sesiones raíz con su agente, título, estado y hora, y elegir una para inspeccionarla.

**Why this priority**: Es el punto de entrada a cualquier ejecución. Sin selección de sesión no hay nada que visualizar.

**Independent Test**: Ejecutar al menos una sesión, abrir el visor y comprobar que aparece listada con agente, título, estado y hora; seleccionarla y ver que queda activa.

**Acceptance Scenarios**:

1. **Given** existen sesiones raíz, **When** el usuario abre el visor, **Then** ve una lista con agente, título, estado y hora de cada una.
2. **Given** la lista de sesiones, **When** el usuario selecciona una, **Then** esa sesión queda activa y su grafo se muestra.
3. **Given** el usuario no seleccionó ninguna sesión, **When** abre el visor, **Then** la sesión raíz más reciente queda activa por defecto.
4. **Given** no existen sesiones, **When** el usuario abre el visor, **Then** ve un estado vacío que explica la situación.

---

### User Story 3 - Ver el grafo jerárquico en vivo (Priority: P1)

Como desarrollador, quiero ver un grafo con un nodo por agente, la relación padre→hijo, y su estado en vivo (en curso, esperando permiso, terminado, error), para entender cómo se están orquestando los agentes.

**Why this priority**: Es el corazón del producto: hacer visible la topología de orquestación y su avance en tiempo real.

**Independent Test**: Lanzar un flujo que invoque al menos un subagente y comprobar que el nodo hijo aparece conectado a su padre y que ambos reflejan su estado mientras avanzan.

**Acceptance Scenarios**:

1. **Given** una sesión activa, **When** el usuario la selecciona, **Then** ve un nodo por agente con la relación padre→hijo correcta.
2. **Given** un agente en ejecución, **When** su estado cambia, **Then** el nodo refleja el nuevo estado (en curso, terminado, error) sin recargar la página.
3. **Given** un agente que invoca un subagente, **When** el subagente nace, **Then** su nodo aparece en el grafo en menos de 1 segundo.
4. **Given** un grafo ya desplegado, **When** cambia únicamente el estado de un nodo, **Then** la posición de los nodos se mantiene estable (no se reordena todo el grafo).

---

### User Story 4 - Inspeccionar el detalle de un nodo (Priority: P2)

Como desarrollador, quiero seleccionar un nodo y ver el detalle del agente: agente, modelo, duración, herramienta actual, historial de acciones, tareas pendientes y errores.

**Why this priority**: El grafo da el "dónde"; el inspector da el "qué pasó aquí". Juntos convierten la visualización en una herramienta de diagnóstico.

**Independent Test**: Seleccionar un nodo terminado y comprobar que el inspector muestra agente, modelo, duración, herramienta actual o última, historial, tareas y errores (si los hay).

**Acceptance Scenarios**:

1. **Given** un nodo en el grafo, **When** el usuario lo selecciona, **Then** el inspector muestra agente, modelo, duración, herramienta actual, historial y tareas.
2. **Given** un nodo con error, **When** el usuario lo selecciona, **Then** el inspector muestra el mensaje de error.
3. **Given** un nodo seleccionado que sigue en ejecución, **When** llega nueva actividad, **Then** el inspector se actualiza en vivo.

---

### User Story 5 - Ver la duración de cada agente y subagente (Priority: P2)

Como desarrollador, quiero ver cuánto tiempo demandó cada agente y subagente, para identificar cuellos de botella y agentes lentos.

**Why this priority**: El tiempo es la primera métrica que un desarrollador busca al optimizar un flujo multi-agente; explica dónde se va la espera.

**Independent Test**: Ejecutar una sesión con padre e hijo, y comprobar que ambos muestran una duración que crece mientras corren y se fija al terminar.

**Acceptance Scenarios**:

1. **Given** un agente en ejecución, **When** el usuario lo observa, **Then** su duración se muestra y avanza en vivo.
2. **Given** un agente que terminó, **When** el usuario lo inspecciona, **Then** su duración final queda fija.
3. **Given** una sesión con varios agentes, **When** el usuario los compara, **Then** puede ordenar o identificar el más lento por su duración.

---

### User Story 6 - Ver costo y consumo de tokens (Priority: P2)

Como desarrollador, quiero ver el costo y los tokens consumidos por agente y el total de la sesión, para entender el gasto de la ejecución.

**Why this priority**: Es la métrica económica que justifica priorizar o recortar agentes y modelos; alto valor para decidir.

**Independent Test**: Ejecutar una sesión y comprobar que cada agente muestra costo y tokens (entrada, salida, razonamiento, caché) y que el total de la sesión corresponde a la suma.

**Acceptance Scenarios**:

1. **Given** un agente que terminó, **When** el usuario lo inspecciona, **Then** ve su costo y su desglose de tokens.
2. **Given** una sesión con varios agentes, **When** el usuario revisa el resumen, **Then** ve el costo y tokens totales de la sesión.
3. **Given** un agente cuyo origen no reporta costo o tokens, **When** el usuario lo inspecciona, **Then** la interfaz indica que el dato no está disponible en lugar de mostrar un cero engañoso.

---

### User Story 7 - Detectar repeticiones y loops (Priority: P3)

Como desarrollador, quiero saber cuántas veces se ejecutó cada agente y si entró en un loop, para detectar flujos que se atascan y consumen recursos sin avanzar.

**Why this priority**: Detectar un loop evita gasto y tiempo perdido, pero es una señal derivada y de menor frecuencia que las métricas principales.

**Independent Test**: Ejecutar una sesión en la que el proveedor reintente una llamada (reintento reportado) y comprobar que la interfaz muestra el conteo de invocaciones del agente y marca el reintento como posible loop.

**Acceptance Scenarios**:

1. **Given** un agente invocado varias veces, **When** el usuario lo inspecciona, **Then** ve cuántas veces se ejecutó.
2. **Given** un agente con uno o más reintentos reportados por el proveedor, **When** el sistema recibe esa señal, **Then** el nodo se marca visualmente como posible loop.
3. **Given** un nodo marcado como posible loop, **When** el usuario lo abre, **Then** ve la evidencia que originó la marca (número de reintentos y mensaje del proveedor).

---

### User Story 8 - Ver las skills, instructions y MCP disponibles (Priority: P3)

Como desarrollador, quiero ver qué skills, archivos de instrucciones y servidores MCP están disponibles para cada agente, para entender el contexto con el que opera.

**Why this priority**: Enriquecer el diagnóstico es valioso, pero se limita a información de configuración fiable; se aborda después de las métricas sólidas.

**Independent Test**: Configurar al menos un MCP y un archivo de instrucciones, ejecutar una sesión y comprobar que el inspector muestra esos recursos etiquetados explícitamente como "disponible".

**Acceptance Scenarios**:

1. **Given** un agente con recursos configurados, **When** el usuario lo inspecciona, **Then** ve las skills, instructions y MCP disponibles listados.
2. **Given** un recurso listado, **When** el usuario lo mira, **Then** está etiquetado inequívocamente como "disponible" (configurado), sin inferir ni afirmar que se usó.
3. **Given** un agente sin recursos configurados, **When** el usuario lo inspecciona, **Then** ve un estado vacío explicativo, no una sección en blanco.

---

### User Story 9 - Seguir la ejecución (Priority: P3)

Como desarrollador, quiero activar un modo "seguir ejecución" que centre la vista en el nodo activo, y poder desactivarlo, para no perder el hilo en grafos grandes.

**Why this priority**: Mejora la usabilidad en flujos largos, pero no es imprescindible para el MVP de visualización.

**Independent Test**: Activar el modo seguir durante una ejecución y comprobar que la vista se centra en el nodo activo; desactivarlo y comprobar que la vista deja de moverse sola.

**Acceptance Scenarios**:

1. **Given** el modo seguir desactivado, **When** el usuario lo activa, **Then** la vista se centra en el nodo activo actual y lo sigue.
2. **Given** el modo seguir activo, **When** el usuario lo desactiva, **Then** la vista deja de recentrarse automáticamente.

---

### User Story 10 - Destacar nodos esperando permiso (Priority: P3)

Como desarrollador, quiero que los nodos que están esperando una acción del usuario se destaquen, para no dejar ejecuciones detenidas sin darme cuenta.

**Why this priority**: Evita bloqueos silenciosos, pero depende de que el flujo llegue a pedir permisos.

**Independent Test**: Provocar una solicitud de permiso y comprobar que el nodo correspondiente se resalta de forma inconfundible.

**Acceptance Scenarios**:

1. **Given** un agente que solicita permiso, **When** la solicitud llega, **Then** su nodo se resalta visualmente como "esperando".
2. **Given** un nodo resaltado, **When** el permiso se resuelve, **Then** el resaltado desaparece.

---

### Edge Cases

- ¿Qué ocurre cuando el origen de la ejecución no reporta costo ni tokens de un agente? Se muestra "no disponible", nunca un valor cero que parezca real.
- ¿Qué ocurre cuando un subagente aparece antes de que su padre esté en el grafo? El nodo se coloca igualmente sin romper el layout.
- ¿Qué ocurre cuando la sesión termina con un permiso pendiente? El nodo conserva su estado destacado y el inspector lo explica.
- ¿Qué ocurre si se pierde la conexión en medio de una ejecución activa? Al reconectar, el grafo debe reflejar exactamente el estado del servidor.
- ¿Qué ocurre con sesiones sin subagentes? El grafo muestra un único nodo raíz de forma legible.
- ¿Qué ocurre con un grafo muy grande? La interacción debe seguir siendo fluida con decenas de nodos y cientos de acciones.
- ¿Qué ocurre cuando un agente es invocado muchas veces seguidas con el mismo objetivo? Se cuenta cada invocación (FR-010); el marcado de loop se reserva para los reintentos reportados por el proveedor (FR-011).
- ¿Qué ocurre si no hay ningún MCP configurado? La sección de recursos muestra un estado vacío explicativo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar el estado de conexión con OpenCode (conectado, reconectando, desconectado) de forma permanente y visible.
- **FR-002**: El sistema MUST listar las sesiones raíz con agente, título, estado y hora.
- **FR-003**: El sistema MUST permitir seleccionar una sesión y activar la más reciente por defecto.
- **FR-004**: El sistema MUST mostrar un grafo con un nodo por agente y las relaciones padre→hijo.
- **FR-005**: El sistema MUST reflejar en cada nodo su estado en vivo (en curso=`running`, esperando permiso=`waiting`, inactivo=`idle`, terminado=`done`, error).
- **FR-006**: El sistema MUST mostrar el detalle de un nodo seleccionado: agente, modelo, duración, herramienta actual, historial, tareas y errores.
- **FR-007**: El sistema MUST mostrar la duración de ejecución de cada agente y subagente, actualizándose en vivo mientras corre y fijándose al terminar.
- **FR-008**: El sistema MUST mostrar el costo por agente y el costo total de la sesión.
- **FR-009**: El sistema MUST mostrar el consumo de tokens por agente (entrada, salida, razonamiento y caché) y el total de la sesión.
- **FR-010**: El sistema MUST mostrar cuántas veces se ejecutó cada agente dentro de la sesión.
- **FR-011**: El sistema MUST marcar visualmente como posible loop a todo agente con uno o más reintentos reportados por el proveedor, y explicar en su detalle la evidencia que originó la marca (número de reintentos y mensaje del proveedor).
- **FR-012**: El sistema MUST mostrar los recursos **disponibles/configurados** de cada agente (archivos de instrucciones y servidores MCP siempre; skills cuando el entorno las exponga como configuración derivable), etiquetados inequívocamente como "disponible", sin inferir ni afirmar su uso real. Cuando un tipo de recurso no sea derivable de la configuración, el sistema MUST mostrar un estado que lo indique en lugar de una sección vacía o inventada.
- **FR-013**: El sistema MUST permitir activar y desactivar un modo "seguir ejecución" que centra la vista en el nodo activo.
- **FR-014**: El sistema MUST destacar los nodos que están esperando una acción del usuario (permiso).
- **FR-015**: El sistema MUST presentar toda la interfaz en modo oscuro con estética flat (sin sombras ni gradientes decorativos, superficies planas y bordes claros), manteniendo legibilidad y contraste accesible.
- **FR-016**: El sistema MUST ser de solo lectura: no envía prompts, no aborta sesiones ni responde permisos.
- **FR-017**: El sistema MUST presentar los estados de pantalla en este orden para toda vista con datos: error, cargando, vacío, datos.
- **FR-018**: El sistema MUST resincronizar el estado visual con el servidor tras una reconexión.
- **FR-019**: El sistema MUST adaptar su presentación a pantallas pequeñas sin duplicar la lógica de negocio.

### Key Entities *(include if feature involves data)*

- **Sesión**: unidad de ejecución identificada por un id, con título, agente y relación opcional con una sesión padre que define la jerarquía.
- **Agente**: participante de la ejecución con nombre, modelo, tipo (principal/subagente) y capacidad de invocar subagentes.
- **Nodo del grafo**: representación visual de un agente dentro de una sesión, con padre, estado en vivo y métricas asociadas.
- **Estado de conexión**: condición del vínculo con el servidor (conectado, reconectando, desconectado).
- **Métrica de ejecución**: duración de un agente, con inicio y fin (o en curso).
- **Consumo**: costo y tokens (entrada, salida, razonamiento, caché) atribuidos a un agente; agregables a nivel de sesión.
- **Conteo de invocaciones**: número de veces que un agente fue ejecutado dentro de la sesión.
- **Reintento**: señal reportada por el proveedor cuando una llamada falla y se vuelve a intentar; su presencia marca un posible loop.
- **Recurso del agente**: skill, archivo de instrucciones o servidor MCP disponible para un agente, etiquetado como "disponible".
- **Permiso**: solicitud de autorización pendiente asociada a un nodo.
- **Tarea pendiente (todo)**: elemento de progreso reportado por una sesión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un subagente nuevo aparece en el grafo en menos de 1 segundo desde que se inicia.
- **SC-002**: La interfaz sigue siendo fluida e interactiva con 50 nodos y 1000 acciones registradas.
- **SC-003**: Tras una reconexión, el grafo mostrado coincide con el estado del servidor en el 100% de los casos observados.
- **SC-004**: Para toda ejecución terminada, el usuario puede identificar al agente más lento y al más costoso en menos de 5 segundos, mediante su orden o una marca visual explícita.
- **SC-005**: Los valores de duración, costo y tokens mostrados coinciden con los reportados por el servidor (sin discrepancias observables en las ejecuciones de prueba).
- **SC-006**: Un posible loop se marca en la interfaz en los primeros segundos tras recibir un reintento reportado por el proveedor, sin intervención del usuario.
- **SC-007**: El usuario distingue "no disponible" de "cero" en las métricas cuando el origen no reporta datos, en el 100% de esos casos.
- **SC-008**: La interfaz en modo oscuro flat mantiene contraste legible (equivalente a WCAG AA) en textos y estados clave.
- **SC-009**: Un usuario nuevo entiende el estado general de una ejecución (quién corre, quién terminó, quién espera) sin leer documentación.

## Assumptions

- Se asume un único servidor local de OpenCode accedido desde el visor; el soporte multi-proyecto queda fuera de alcance en esta versión.
- La aplicación es estrictamente de solo lectura: no se controlan ejecuciones (prompts, abortos, permisos).
- No se persiste historial: las métricas son de la sesión en vivo y desaparecen al recargar; la persistencia queda fuera de alcance.
- Las métricas (duración, costo, tokens, conteos) se derivan de lo que el servidor reporta; cuando un dato no existe, se muestra "no disponible" en lugar de inferirse silenciosamente.
- Se define "loop" exclusivamente como reintentos reportados por el proveedor; no se infieren bucles lógicos a partir de acciones o invocaciones repetidas en esta versión.
- El SDK de OpenCode no expone las skills como configuración; en v1 se listan solo si son derivables del entorno, y en caso contrario se indica "no disponible".
- Los recursos (skills, instructions, MCP) se muestran únicamente desde la configuración disponible en OpenCode; no se infiere el uso real por agente en esta versión.
- El costo se muestra en la unidad monetaria tal como la reporta el servidor (por defecto, dólares) sin conversión de divisa.
- El diseño objetivo es Dark Mode / Flat Design; no se incluye un tema claro en esta versión.
- Se prioriza escritorio, pero la presentación debe ser utilizable en pantallas pequeñas.
- La lista de agentes disponibles y la configuración de recursos (skills, instructions, MCP) existen en el entorno de OpenCode del usuario.
