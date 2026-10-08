# Feature Specification: Rendimiento del visualizador de grafo

**Feature Branch**: `006-graph-render-performance`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Veo que demora mucho en cambiar entre sesiones. Más cuando tiene muchos nodos en el grafo. Existe alguna oportunidad de mejorar la performance de este visualizador? Puedes usar canvas o algo por el estilo?" — Dirección elegida: optimizaciones incrementales primero (sin migrar el render a canvas).

## Clarifications

### Session 2026-10-08

- Q: ¿Cuál es la cantidad máxima de agentes por sesión que el grafo debe poder mostrar con fluidez? → A: Hasta ~200 nodos.
- Q: ¿Es aceptable que el grafo aparezca de forma progresiva (estructura primero, métricas/detalles a medida que llegan) en lugar de esperar a tener todo el subárbol listo? → A: Sí, mostrar progresivo.
- Q: ¿Te parecen adecuados los objetivos de tiempo propuestos en Success Criteria? → A: Aceptar los propuestos (sesión grande ≤1.5 s, revisitar ≤300 ms, interacción <100 ms con ≥100 nodos).
- Q: ¿Cómo se verifican los objetivos de rendimiento? → A: Con medición reproducible (instrumentar tiempos de apertura, revisita y fluidez, y capturar línea base antes/después).
- Q: ¿Cuál es el desfase máximo aceptable en los datos en vivo mientras se prioriza la fluidez del grafo? → A: ≤1 s, igual que hoy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar de sesión sin esperas largas (Priority: P1)

Un usuario que monitorea varias ejecuciones cambia de una sesión a otra en la lista lateral y espera ver el grafo de la sesión elegida lo antes posible, incluso cuando esa sesión tiene un subárbol grande (muchos agentes y subagentes).

**Why this priority**: Es el síntoma principal reportado. El cambio de sesión es la acción más frecuente y hoy se percibe lento justo cuando la sesión es "interesante" (muchos agentes). Resolver esto entrega el mayor valor inmediato.

**Independent Test**: Abrir una sesión con un subárbol grande y medir el tiempo hasta que el grafo está visible y encuadrado; repetir en una sesión pequeña. El tiempo de la sesión grande debe quedar dentro del objetivo y no crecer desproporcionadamente frente a la pequeña.

**Acceptance Scenarios**:

1. **Given** una sesión con subárbol grande ya visitada en esta sesión de trabajo, **When** el usuario la selecciona de nuevo, **Then** el grafo aparece de forma percibida como inmediata, sin volver a descargar lo que ya se tenía.
2. **Given** una sesión con subárbol grande nunca visitada, **When** el usuario la selecciona, **Then** la interfaz responde al cambio de inmediato (selección y estado de carga visibles) y el grafo aparece dentro del objetivo de tiempo sin congelar la UI.
3. **Given** que el usuario cambia de sesión, **When** el grafo de la nueva sesión aún se está preparando, **Then** el usuario ve un estado de carga claro y puede seguir interactuando con el resto de la pantalla (lista, cabecera).

---

### User Story 2 - Mantener fluidez con grafos de muchos nodos (Priority: P1)

Un usuario explora un grafo con varios cientos de agentes: panea, hace zoom, pasa el cursor sobre nodos para trazar relaciones y selecciona nodos para ver su linaje; todo debe sentirse fluido.

**Why this priority**: Es el segundo síntoma reportado ("más cuando tiene muchos nodos") y define si el visualizador sigue siendo usable en ejecuciones multi-agente grandes.

**Independent Test**: Cargar una sesión con un grafo de muchos nodos y realizar una secuencia de pan, zoom, hover y selección, verificando que no hay pausas perceptibles ni caídas visibles de fluidez.

**Acceptance Scenarios**:

1. **Given** un grafo con muchos nodos, **When** el usuario panea y hace zoom, **Then** la vista responde de forma fluida sin pausas perceptibles.
2. **Given** un grafo con muchos nodos, **When** el usuario pasa el cursor sobre un nodo, **Then** las relaciones directas se resaltan sin que se perciba una pausa.
3. **Given** un grafo con muchos nodos, **When** el usuario selecciona un nodo, **Then** el linaje se resalta y el resto se atenúa de forma fluida.

---

### User Story 3 - Actualizaciones en vivo sin degradar la interacción (Priority: P2)

Un usuario observa una ejecución en curso: la interfaz actualiza tiempos, estados y métricas periódicamente mientras el usuario sigue navegando el grafo; las actualizaciones no deben hacer que el grafo "salte" ni que la interacción se ponga lenta.

**Why this priority**: El grafo se refresca continuamente; si cada refresco cuesta trabajo proporcional al grafo completo, la fluidez lograda en la Historia 2 se pierde en sesiones activas.

**Independent Test**: Con una sesión activa y un grafo grande, mantener la vista abierta durante varios ciclos de actualización comprobando que la interacción sigue fluida y que solo se refresca lo que efectivamente cambió.

**Acceptance Scenarios**:

1. **Given** una sesión activa con muchos agentes, **When** llega una actualización que afecta a un solo agente, **Then** la vista se actualiza sin degradar la fluidez del resto del grafo.
2. **Given** una sesión activa, **When** transcurre un ciclo de actualización de tiempo, **Then** los tiempos visibles avanzan sin que el grafo se reacomode ni parpadee.
3. **Given** una sesión activa, **When** llegan ráfagas de eventos, **Then** la interfaz los agrupa y no se bloquea.

---

### User Story 4 - Paridad funcional sin regresiones (Priority: P2)

Un usuario que ya conoce el visualizador debe seguir viendo exactamente la misma información y las mismas interacciones después de las optimizaciones.

**Why this priority**: Una mejora de rendimiento que cambie lo que se muestra o rompa interacciones no es aceptable; la paridad es el contrato de no-regresión.

**Independent Test**: Comparar un conjunto de sesiones representativas antes y después de los cambios y verificar que nodos, aristas, carriles, estados, métricas, linaje, selección, hover y redimensionado coinciden.

**Acceptance Scenarios**:

1. **Given** cualquier sesión soportada, **When** se abre el grafo, **Then** se muestran las mismas tarjetas, estados, métricas y carriles que antes de la optimización.
2. **Given** un nodo seleccionado, **When** el usuario revisa el linaje y abre el histórico, **Then** el comportamiento es idéntico al actual.
3. **Given** una sesión con resize de nodos aplicado, **When** se cambia de sesión y se vuelve, **Then** el reseteo de tamaños se comporta como hoy.

---

### Edge Cases

- **Sesión sin agentes**: la vista debe mostrar el estado vacío actual sin coste de render de grafo.
- **Sesión con subárbol muy grande nunca visitada**: la UI no debe congelarse; debe mostrar progreso y permitir cancelar/cambiar de sesión.
- **Sesión activa que emite eventos mientras se carga**: los eventos en vivo deben integrarse sin rehacer el trabajo de carga ya hecho.
- **Cambiar de sesión repetidamente y rápido**: el trabajo de sesiones abandonadas no debe degradar la sesión finalmente elegida.
- **Fallo de red al cargar una sesión**: debe conservarse el estado de error actual, sin dejar la vista bloqueada.
- **Sesión en otro proyecto/directorio**: el cambio de contexto de proyecto no debe disparar recargas innecesarias ya resueltas.
- **Redimensionado de nodos extremo**: un nodo muy grande no debe multiplicar el coste de la vista.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE responder de forma inmediata al cambio de sesión (selección resaltada en la lista y cabecera actualizada), sin esperar a que el grafo esté listo. La aparición progresiva del grafo y sus estados quedan cubiertos por FR-010 (detalle progresivo).
- **FR-002**: El sistema DEBE presentar el grafo de una sesión con subárbol grande dentro de un objetivo de tiempo acotado (ver Success Criteria), de forma independiente del número total de mensajes del subárbol.
- **FR-003**: El coste de preparar una sesión NO DEBE crecer de forma lineal con el volumen total de contenido de sus agentes; debe existir una carga por demanda que priorice lo visible.
- **FR-004**: El sistema DEBE reutilizar la información de una sesión ya visitada, de modo que volver a ella no requiera una nueva carga completa.
- **FR-005**: Con grafos de muchos nodos, la interacción (pan, zoom, hover, selección, abrir histórico) DEBE mantenerse fluida y sin pausas perceptibles.
- **FR-006**: Las actualizaciones periódicas y por eventos DEBEN refrescar únicamente lo que cambió, sin reprocesar ni repintar el grafo completo cuando el cambio es local.
- **FR-007**: El sistema DEBE mantener exactamente la misma información y comportamiento visible que la versión actual (paridad funcional): nodos, aristas, carriles de ejecución, estados, métricas, linaje, selección, hover, redimensionado e histórico.
- **FR-008**: El sistema DEBE conservar los estados de pantalla obligatorios (error, carga, vacío, datos) durante y después de las optimizaciones.
- **FR-009**: El sistema NO DEBE degradar la frescura de los datos en vivo (estados activos, tiempos y métricas) como consecuencia de reducir el trabajo de render; el desfase máximo aceptable es de **≤ 1 s** (igual que hoy).
- **FR-010**: El sistema DEBE mostrar el grafo de forma progresiva: la estructura (nodos, aristas, carriles y estados) aparece en cuanto está disponible, y las métricas/detalles se completan a medida que llegan, sin bloquear la vista.
- **FR-011**: El sistema DEBE permitir medir de forma reproducible los tiempos de apertura de sesión, de revisita y de interacción, para poder capturar una línea base y comparar antes/después.

### Key Entities *(include if data involved)*

- **Sesión (raíz)**: la unidad que el usuario selecciona; contiene un subárbol de agentes y subagentes.
- **Subárbol de agentes**: conjunto de agentes descendientes de una sesión raíz, la unidad que se dibuja como grafo.
- **Nodo de agente**: tarjeta que representa un agente, con estado, métricas y metadatos relevantes para la vista.
- **Vista de grafo**: proyección visible del subárbol (nodos posicionados, aristas, carriles), con selección y foco de linaje.
- **Señal en vivo**: actualizaciones periódicas y por eventos que modifican el estado visible de uno o más agentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Abrir una sesión con un subárbol de ~50 agentes muestra el grafo encuadrado en **≤ 1.5 s (percentil 90)** en el equipo de referencia, frente a la línea base medida.
- **SC-002**: El tiempo de apertura de una sesión grande (subárbol de ~50 agentes) es **≤ 2×** el de una sesión pequeña (≤ 5 agentes) bajo las mismas condiciones de caché fría.
- **SC-003**: Volver a una sesión ya visitada muestra el grafo en **≤ 300 ms** (percentil 90), sin recarga de datos.
- **SC-004**: Con un grafo de **100 hasta ~200 nodos visibles** (techo objetivo de las Assumptions), la interacción (pan, zoom, hover, selección) mantiene una respuesta perceptible por debajo de **100 ms** y sin pausas visibles; el criterio debe cumplirse en todo ese rango, no solo en el mínimo de 100.
- **SC-005**: Una actualización que afecta a **1 de 100** agentes no degrada la fluidez de la interacción ni provoca reacomodo del grafo.
- **SC-006**: El **100 %** de los elementos visibles (nodos, aristas, carriles, estados, métricas, linaje) coincide con la línea base en una muestra de sesiones representativas.
- **SC-007**: La interfaz principal permanece responsiva (< 100 ms de retraso perceptible) durante la carga de una sesión grande; no hay bloqueos ni congelamientos.
- **SC-008**: Abrir una sesión no repite trabajo de carga ya realizado ni carga contenido que no se muestra, tomando la línea base como referencia.

## Assumptions

- El objetivo de rendimiento se mide en el equipo de desarrollo de referencia con caché fría salvo donde se indique "ya visitada".
- "Muchos nodos" se interpreta como el orden de magnitud de **≥ 100 agentes** en una sesión; el techo objetivo a soportar con fluidez es de **hasta ~200 agentes** (definido en la sesión de clarificación del 2026-10-08).
- Se mantiene la tecnología de render actual (grafo basado en DOM) y **no** se migra a canvas en esta feature; la migración queda fuera de alcance y se reevalúa solo si los objetivos no se alcanzan.
- La causa principal de lentitud al cambiar de sesión es la cantidad de trabajo de carga y de render, no la latencia de red del entorno del usuario.
- Los objetivos cuantitativos (SC-001..SC-007) son metas de referencia razonables y quedaron **confirmados** en la sesión de clarificación del 2026-10-08.
- La paridad funcional se valida contra el comportamiento actual antes de los cambios (línea base).

### Out of Scope

- Migración del render del grafo a canvas/WebGL u otra tecnología de dibujo distinta de la actual.
- Rediseño de la interfaz del grafo, sus tarjetas, carriles o interacciones visuales.
- Cambios en lo que el servidor expone o en el modelo de datos de OpenCode.
- Optimizaciones de otras pantallas (lista de sesiones, inspector, histórico) más allá de lo necesario para el cambio de sesión y el grafo.

## Dependencies

- La aplicación depende de la fuente de datos de OpenCode para sesiones, agentes, mensajes y estados en vivo; los objetivos de carga asumen esa fuente disponible.
- La validación de paridad depende de disponer de una línea base medible del comportamiento actual.
