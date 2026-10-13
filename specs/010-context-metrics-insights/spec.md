# Feature Specification: Context Composition, Parallel Speedup & Latency Insights

**Feature Branch**: `010-context-metrics-insights`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "(1) Segmentar el contenido del contexto por cada nodo (p. ej. resultados de herramientas 47%, razonamiento 26%, entradas de herramientas 22%); (2) aceleración real por paralelismo: cómo obtenerla y cómo mostrarla; (3) que el nodo del grafo visualice el contexto que entró y el que salió y, al hacer click, ver cómo impactó en el contexto del nodo padre; (4) ver todas las métricas de contexto posibles en el detalle lateral; (5) mostrar la velocidad de respuesta, cómo varía y alertar cuando el tiempo de respuesta se reduce respecto de la ejecución anterior (anomalía)."

## Clarifications

### Session 2026-10-12

- Q: No existen tokens por categoría de contenido en los datos observados. ¿Cómo se calculan los porcentajes de composición del contexto? → A: Se toman los tokens reales del agente y se reparten de forma proporcional al peso de caracteres de cada categoría; los porcentajes suman 100% sobre el contexto real.
- Q: ¿Contra qué referencia se compara la latencia para disparar la alerta de anomalía? → A: Contra la mediana histórica del propio nodo; si el nodo no tiene historial, contra la mediana del mismo agente. La alerta es bidireccional (lentitud o rapidez anómala).
- Q: El pedido pide alertar cuando la respuesta es más rápida "que la ejecución anterior". ¿Se mantiene ese criterio? → A: Se generaliza a mediana histórica del nodo (robusta ante valores atípicos) y se marca la rapidez anómala como caso explícito de alerta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entender de qué está hecho el contexto de un agente (Priority: P1)

Un usuario que analiza el consumo de un agente quiere saber **de qué está compuesto** su contexto sin leer el texto crudo. El visor desglosa el contexto acumulado del agente en categorías —resultados de herramientas, entradas de herramientas, razonamiento y texto del propio agente, y texto del usuario— y las presenta como proporciones sobre el total (por ejemplo: resultados de herramientas 47%, razonamiento 26%, entradas de herramientas 22%).

**Why this priority**: Es la aportación analítica central del pedido: permite responder "¿por qué este agente gastó tanto contexto?" de un vistazo. Sin ella, el usuario debe leer manualmente el histórico del agente.

**Independent Test**: Con un agente cuyo contexto conocido tenga una categoría claramente dominante, comprobar que el desglose la muestra primera, que las proporciones suman 100% y que los valores coinciden con el reparto esperado sobre los tokens reales del agente.

**Acceptance Scenarios**:

1. **Given** un agente con resultados de herramientas, razonamiento y entradas de herramientas, **When** el usuario abre su detalle, **Then** ve un desglose por categorías ordenado por peso descendente, con porcentaje y valor absoluto.
2. **Given** un desglose mostrado, **When** el usuario suma los porcentajes, **Then** el total es 100%.
3. **Given** un agente con tokens medibles, **When** se calcula el desglose, **Then** los tokens atribuidos a cada categoría se reparten proporcionalmente sobre el total real de tokens del agente.
4. **Given** un agente sin tokens medibles, **When** se calcula el desglose, **Then** se muestra el peso relativo disponible o "no disponible", sin inventar un total.

---

### User Story 2 - Medir la aceleración real del paralelismo (Priority: P2)

Un usuario que orquesta varios agentes quiere saber **cuánto tiempo ganó realmente** al correr tareas en paralelo. El visor calcula, por cada grupo de agentes que se solaparon en el tiempo, el tiempo que habrían tardado en serie frente al tiempo real de pared, y expresa la relación como un factor de aceleración y una eficiencia respecto del tamaño del grupo. Muestra también una aceleración global de la sesión.

**Why this priority**: Convierte "corrió en paralelo" en una cifra comparable ("×2.4"), que es justamente lo que el usuario pidió: cómo obtenerla y cómo mostrarla. Depende de datos de tiempo y de agrupación que ya existen, por lo que es de complejidad media y alto valor.

**Independent Test**: Con un grupo de tres agentes de duraciones conocidas que se solapan parcialmente, comprobar que el factor de aceleración y la eficiencia coinciden con el cálculo serie/real esperado, y que la aceleración global de la sesión es coherente.

**Acceptance Scenarios**:

1. **Given** un grupo de agentes solapados, **When** el usuario lo observa, **Then** ve el tamaño del grupo, el tiempo en serie, el tiempo real y la aceleración.
2. **Given** un grupo con solape perfecto y duraciones iguales, **When** se calcula, **Then** la eficiencia es 1,0 y la aceleración es igual al tamaño del grupo.
3. **Given** un grupo con solape parcial, **When** se calcula, **Then** la aceleración es menor que el tamaño del grupo y la eficiencia refleja el desaprovechamiento.
4. **Given** una ejecución con algún agente aún activo, **When** se muestra la aceleración, **Then** se marca como provisional.
5. **Given** un agente que corrió solo (sin hermanos solapados), **When** se muestra su nodo, **Then** no se muestra aceleración para ese nodo.

---

### User Story 3 - Ver el contexto que entra y sale de un nodo y su impacto en el padre (Priority: P2)

Un usuario que sigue el grafo quiere, sin abrir nada, ver cuánto contexto **entró** y cuánto **salió** de cada nodo, y al seleccionar un nodo entender **cuánto de su resultado fue a parar al contexto de su agente padre** y qué proporción del padre representa.

**Why this priority**: Es la lectura pedida directamente sobre el grafo y el detalle ("visualizar el contexto que entró y el que salió… ver cómo impactó en el contexto del nodo padre"). Depende de que las métricas de contexto existan (US1/US4).

**Independent Test**: Con un nodo hijo cuyo resultado se inyectó en su padre, comprobar que el nodo muestra contexto entrante y saliente, y que el detalle indica cuánto aportó al padre y qué porcentaje del padre representa, con navegación al padre.

**Acceptance Scenarios**:

1. **Given** un nodo con actividad, **When** se muestra en el grafo, **Then** expone de forma resumida el contexto entrante y el saliente.
2. **Given** un nodo hijo seleccionado, **When** el usuario abre su detalle, **Then** ve el volumen de contexto aportado al padre y su porcentaje sobre el contexto del padre.
3. **Given** un nodo raíz o un hijo cuyo punto de invocación en el padre no se identifica, **When** se abre el detalle, **Then** se indica "sin padre" o "no disponible".
4. **Given** el indicador de aporte al padre visible, **When** el usuario interactúa con él, **Then** el visor navega al nodo padre.

---

### User Story 4 - Reunir todas las métricas de contexto en el detalle (Priority: P3)

Un usuario que inspecciona un agente quiere tener **todo lo relacionado con su contexto** en un único bloque del panel de detalle, sin cambiar de vista: tamaño de la ventana de contexto, caché y su tasa de acierto, composición, evolución del contexto, salida y su relación con el razonamiento, compactaciones y coste por volumen de contexto.

**Why this priority**: Es el pedido "ver todas las métricas relacionadas al context como sea posible". Consolida y amplía lo que US1/US3 introducen, y por eso va después: primero el dato, después la cobertura completa.

**Independent Test**: Con cualquier nodo, comprobar que el panel de detalle contiene el bloque de contexto con todos los apartados enumerados y que cada apartado respeta los cuatro estados de pantalla.

**Acceptance Scenarios**:

1. **Given** un nodo seleccionado, **When** el usuario abre su detalle, **Then** ve un bloque de contexto con ventana, caché, composición, evolución, salida y compactaciones.
2. **Given** un nodo con cache read/write, **When** se muestra el bloque, **Then** se muestra la tasa de acierto de caché.
3. **Given** un nodo con compactaciones, **When** se muestra el bloque, **Then** se indica cuántas hubo y su efecto sobre el contexto.
4. **Given** un nodo sin datos de contexto, **When** se muestra el bloque, **Then** se representa el estado vacío correspondiente en lugar de valores en cero.

---

### User Story 5 - Ver la velocidad de respuesta y detectar anomalías (Priority: P2)

Un usuario que sigue una ejecución en vivo quiere ver **cómo varía la velocidad de respuesta** de un agente y ser avisado cuando una respuesta se desvía de su comportamiento histórico, tanto si es anómalamente lenta como si es anómalamente rápida (una respuesta inusualmente rápida puede señalar una respuesta truncada o un error).

**Why this priority**: El usuario lo pidió de forma explícita y con énfasis en la alerta. Aporta detección proactiva de degradaciones en lugar de exigir comparación manual.

**Independent Test**: Con un agente cuyas respuestas previas definen una mediana, comprobar que una respuesta posterior muy por encima (lentitud) y otra muy por debajo (rapidez anómala) del umbral se marcan como anomalía, con su magnitud y referencia, y que se registran en el detalle.

**Acceptance Scenarios**:

1. **Given** un agente con varias respuestas, **When** el usuario abre su detalle, **Then** ve una serie temporal del tiempo hasta el primer token y de la latencia total.
2. **Given** una respuesta cuya latencia se desvía de la mediana histórica del nodo más allá del umbral, **When** ocurre, **Then** el visor la marca como anomalía y la registra en el detalle con su magnitud y la referencia usada.
3. **Given** una respuesta inusualmente rápida y un nodo sin historial propio, **When** ocurre, **Then** se compara contra la mediana del mismo agente antes de decidir.
4. **Given** un nodo sin historial alguno, **When** llega la primera respuesta, **Then** no se marca anomalía.
5. **Given** un umbral configurado por el usuario, **When** cambia, **Then** las marcas de anomalía se recalculan con el nuevo umbral.

### Edge Cases

- Agente sin mensajes cargados: el desglose y las métricas muestran "no disponible", nunca ceros que aparenten datos reales.
- Contexto total real igual a cero o desconocido: no se pueden repartir tokens; se ofrece solo el peso relativo por caracteres.
- Agente aún activo: composición, aceleración y latencia se marcan como provisionales y se recalculan al cerrarse.
- Grupo de paralelismo de un solo miembro: no hay aceleración que mostrar.
- Duración ausente o cero de alguno de los miembros de un grupo: la aceleración de ese grupo no es calculable y se indica como no disponible.
- Nodo raíz, o hijo cuyo punto de invocación no aparece en el padre: sin aporte al padre calculable.
- Compactación durante la vida del agente: el crecimiento del contexto puede decrecer; se refleja el efecto de la compactación en lugar de presentar un crecimiento monótono falso.
- Respuesta con error o interrumpida: la latencia puede ser anómalamente baja; se marca como anomalía y se distingue de una mejora real en lo posible.
- Varios modelos o agentes con velocidades muy distintas: la referencia se calcula por agente, no mezclando agentes distintos.
- Umbral de anomalía sin configurar: se usa el valor por defecto documentado.

## Requirements *(mandatory)*

### Functional Requirements

**Composición del contexto (US1)**

- **FR-001**: El visor MUST desglosar el contexto acumulado de un agente en, al menos, estas categorías: resultados de herramientas, entradas/llamadas de herramientas, razonamiento del agente, texto del agente y texto del usuario.
- **FR-002**: El desglose MUST presentarse como proporción sobre el total del contexto del agente, de modo que los porcentajes sumen 100%.
- **FR-003**: La proporción MUST derivarse de los tokens reales del agente, repartidos proporcionalmente al peso relativo de caracteres de cada categoría, dado que no existen tokens por categoría.
- **FR-004**: El desglose MUST ordenar las categorías por peso descendente y mostrar, junto al porcentaje, el valor absoluto asociado.
- **FR-005**: Cuando el agente no tenga tokens medibles, el visor MUST mostrar solo el peso relativo disponible o el estado "no disponible", sin inventar totales.

**Aceleración por paralelismo (US2)**

- **FR-006**: El visor MUST calcular, por cada grupo de agentes que se solaparon en el tiempo, el tiempo teórico en serie (suma de duraciones de los miembros), el tiempo real de pared (ventana de solape del grupo) y su relación como factor de aceleración.
- **FR-007**: El visor MUST exponer la eficiencia del grupo como la aceleración dividida por el tamaño del grupo.
- **FR-008**: El visor MUST mostrar una aceleración global de la sesión, comparando la suma de duraciones de todos los agentes con el tiempo total activo de la sesión.
- **FR-009**: La aceleración MUST mostrarse en el nodo cuando el agente participa de un grupo de paralelismo, en el detalle del agente con el desglose del grupo, y de forma global en el resumen de la sesión.
- **FR-010**: Cuando algún miembro del grupo siga activo o su duración no esté cerrada, la aceleración MUST marcarse como provisional.

**Contexto entrante/saliente e impacto en el padre (US3)**

- **FR-011**: Cada nodo del grafo MUST exponer de forma resumida el volumen de contexto entrante y saliente del agente.
- **FR-012**: Al seleccionar un nodo, el detalle MUST indicar cuánto contexto aportó su resultado al contexto de su agente padre y qué porcentaje del contexto del padre representa.
- **FR-013**: Cuando el nodo sea raíz, o su punto de invocación no se identifique en el padre, el detalle MUST indicar "sin padre" o "no disponible".
- **FR-014**: El indicador de aporte al padre MUST permitir navegar al nodo padre.

**Cobertura de métricas de contexto en el detalle (US4)**

- **FR-015**: El panel de detalle MUST reunir todas las métricas de contexto del agente en una sección propia.
- **FR-016**: La sección de contexto MUST incluir: tamaño de la ventana de contexto (entrada), tokens de lectura y escritura de caché con su tasa de acierto, el desglose de composición, la evolución del contexto a lo largo de la ejecución, la salida (respuesta y razonamiento) y su relación, el número y efecto de las compactaciones, y el coste por unidad de contexto.
- **FR-017**: Cada bloque de la sección de contexto MUST representar explícitamente sus cuatro estados de pantalla: error, cargando, vacío y datos.

**Velocidad de respuesta y anomalías (US5)**

- **FR-018**: El visor MUST medir, por cada respuesta del agente, el tiempo hasta el primer token y la latencia total, y construir con ellos una serie temporal por agente.
- **FR-019**: El visor MUST mostrar cómo evoluciona la velocidad de respuesta a lo largo de la ejecución del agente.
- **FR-020**: El visor MUST detectar anomalías comparando cada respuesta contra la mediana histórica del propio nodo y, cuando el nodo no tenga historial, contra la mediana del mismo agente.
- **FR-021**: El visor MUST marcar como anomalía tanto una desviación por lentitud como una desviación por rapidez anómala.
- **FR-022**: El umbral de desviación que dispara la anomalía MUST ser configurable, con un valor por defecto.
- **FR-023**: La anomalía MUST ser evidente en el nodo y quedar registrada en el detalle del agente con su magnitud y la referencia con la que se comparó.

### Key Entities *(include if feature involves data)*

- **Desglose de composición de contexto**: por agente y categoría; atributos: categoría, peso en caracteres, tokens atribuidos, porcentaje. Relaciona un agente con las partes de su contexto de conversación.
- **Métrica de paralelismo**: por grupo de agentes solapados; atributos: identificador de grupo, tamaño, tiempo en serie, tiempo real, factor de aceleración, eficiencia, marca de provisional. Se agrega además a nivel de sesión.
- **Aporte al contexto del padre**: por agente hijo; atributos: volumen aportado, porcentaje sobre el contexto del padre, identificador del padre. Relaciona un nodo con su nodo padre.
- **Muestra de latencia de respuesta**: por respuesta de agente; atributos: inicio, primer token, fin, tiempo hasta el primer token, latencia total, referencia (mediana), desviación y marca de anomalía.
- **Ventana de contexto**: por agente; atributos: entrada, lectura de caché, escritura de caché, tasa de acierto de caché.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario identifica las categorías dominantes del contexto de un agente en menos de 10 segundos, sin leer el texto crudo de la conversación.
- **SC-002**: Los porcentajes del desglose de composición suman 100% (±1 punto) para todo agente con contexto medible.
- **SC-003**: El factor de aceleración mostrado coincide con la relación entre el tiempo en serie y el tiempo real del grupo, verificable con datos de duración conocidos.
- **SC-004**: Un usuario obtiene el aporte de un nodo al contexto de su padre en un máximo de 2 interacciones desde el grafo.
- **SC-005**: Toda la información de contexto de un agente es accesible sin salir del panel de detalle.
- **SC-006**: El visor marca una anomalía de latencia ante cualquier desviación respecto de la mediana de referencia que supere el umbral, tanto por lentitud como por rapidez.
- **SC-007**: Ninguna métrica de contexto presenta un valor inventado: ante ausencia de datos muestra el estado "no disponible" en lugar de cero.

## Assumptions

- Los datos provienen del stream y del servidor de OpenCode que el visor ya consume; la feature no añade instrumentación ni cambios al servidor (Principio I: observador).
- No existen tokens por categoría de contenido en los datos observados; la composición reparte los tokens reales del agente por peso de caracteres (decisión del usuario en la clarificación).
- La referencia para la anomalía de latencia es la mediana histórica del nodo, y del mismo agente cuando el nodo no tiene historial (decisión del usuario en la clarificación).
- El umbral de anomalía tiene un valor por defecto y es configurable; el valor concreto se fija en la fase de plan.
- El visor es de solo lectura respecto de estos datos: no se persiste ni se envía nada al servidor.
- El alcance es frontend, incluidos tests; la presentación mobile reutiliza el patrón de doble presentación ya existente.
- Las duraciones y ventanas de tiempo no cerradas (agentes activos) se tratan como provisionales, coherente con el comportamiento actual del resumen de sesión.
