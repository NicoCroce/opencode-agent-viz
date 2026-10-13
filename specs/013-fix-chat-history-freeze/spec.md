# Feature Specification: Histórico de sesiones en espera de respuesta sin congelar la interfaz

**Feature Branch**: `013-fix-chat-history-freeze`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Al abrir el histórico de una sesión que está esperando una respuesta del usuario (estado «waiting-input»), la interfaz se congela: el panel deja de responder y el navegador se queda al 100 % de CPU hasta colgarse. Ocurre siempre que esa sesión tiene preguntas pendientes, y hace que el histórico sea inutilizable justo en el caso en el que más se necesita para entender qué está preguntando el agente. Cualquier otra sesión abre su histórico con normalidad. Se necesita que abrir el histórico funcione igual para cualquier sesión, con o sin preguntas pendientes, sin congelar la interfaz, y que una sesión que espera respuesta siga mostrando en su histórico sus preguntas abiertas con el mismo contenido que hoy."

## Clarifications

### Session 2026-10-13

- Q: ¿El contenido del histórico que debe conservarse incluye solo las preguntas abiertas de la sesión que se abre, o también las de sesiones hijas/dependientes que hoy alimentan los badges de atención del Chat? → A: Opción B — conservar el contenido del histórico tal como es hoy, incluidas las preguntas de sesiones hijas que alimentan los badges de atención (no solo las de la sesión abierta).
- Q: ¿Basta con «sin bloqueo observable» o debe fijarse un presupuesto explícito de ms/CPU para «termina y la interfaz responde»? → A: Opción A — ausencia de bloqueo observable (la prueba termina dentro del timeout y no hay reciclado de render), sin presupuesto explícito de ms/CPU.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir el histórico de una sesión que espera respuesta sin que la interfaz se congele (Priority: P1)

Quien observa una sesión que está esperando una respuesta del usuario abre su histórico de mensajes para entender qué está preguntando el agente, y la apertura termina: el historial se muestra y la interfaz sigue respondiendo con normalidad.

**Why this priority**: es el defecto de origen. Hoy, cuando la sesión está en espera de respuesta y tiene preguntas pendientes, abrir el histórico bloquea la interfaz (el panel deja de responder y el navegador se queda al 100 % de CPU hasta colgarse). El histórico queda inutilizable justo en el caso en el que más se necesita: entender qué está preguntando el agente.

**Independent Test**: abrir el histórico de una sesión en estado de espera de respuesta que tiene al menos una pregunta pendiente y comprobar que el historial se muestra, que la interfaz responde y que no hay un consumo sostenido de CPU.

**Acceptance Scenarios**:

1. **Given** una sesión en espera de respuesta con una o más preguntas pendientes, **When** se abre su histórico, **Then** el historial se muestra y la interfaz sigue respondiendo (no se bloquea el hilo ni hay consumo sostenido de CPU).
2. **Given** ese mismo historial ya abierto, **When** el usuario filtra, busca o cierra el historial, **Then** cada interacción responde con normalidad.
3. **Given** una sesión en espera de respuesta cuyas preguntas pendientes se resuelven mientras el histórico está abierto, **When** llega el cambio, **Then** el historial sigue respondiendo y refleja el estado nuevo sin bloquearse.

---

### User Story 2 - El histórico sigue mostrando las preguntas abiertas como hoy (Priority: P1)

Quien observa una sesión en espera de respuesta sigue viendo, en su histórico, las preguntas abiertas de esa sesión con el mismo contenido y la misma ubicación que hoy.

**Why this priority**: la corrección no puede vaciar ni alterar el contenido que da valor al histórico. El motivo por el que el usuario abre el histórico en este caso es precisamente leer qué está preguntando el agente; resolver el bloqueo eliminando o mutilando ese contenido sería una regresión funcional.

**Independent Test**: abrir el histórico de una sesión en espera de respuesta y comprobar que las preguntas abiertas aparecen como entradas del histórico con el mismo texto, la misma etiqueta de autor y la misma posición relativa que tienen hoy.

**Acceptance Scenarios**:

1. **Given** una sesión en espera de respuesta con preguntas pendientes, **When** se abre su histórico, **Then** las preguntas abiertas aparecen como entradas del histórico con el mismo contenido (texto y etiqueta de autor) que hoy.
2. **Given** una sesión sin preguntas pendientes, **When** se abre su histórico, **Then** su contenido es idéntico al actual (ni entradas añadidas ni quitadas).

---

### User Story 3 - El resto de sesiones no cambia (Priority: P2)

Quien observa cualquier otra sesión obtiene exactamente el mismo comportamiento de histórico y de badges de atención que antes de la corrección.

**Why this priority**: acota el arreglo al defecto. Una corrección que altere el histórico o los badges de las sesiones que hoy funcionan sería un retroceso en la observabilidad general.

**Independent Test**: abrir el histórico de sesiones que no están en espera de respuesta (incluidas las que tienen permisos pendientes) y comprobar que su historial y sus badges de atención se comportan igual que hoy.

**Acceptance Scenarios**:

1. **Given** una sesión en cualquier otro estado (incluido espera de permiso), **When** se abre su histórico, **Then** se comporta igual que hoy.
2. **Given** los badges de atención del Chat para cualquier sesión, **When** se observan, **Then** sus conteos y etiquetas no cambian respecto de hoy.

---

### User Story 4 - El defecto queda cubierto por una prueba que hoy cuelga (Priority: P2)

Quien mantiene el visor cuenta con una prueba que reproduce la apertura del histórico de una sesión en espera de respuesta y que hoy no termina; tras la corrección pasa y protege frente a la reintroducción del defecto.

**Why this priority**: el defecto es observable y reproducible; sin una prueba que hoy cuelgue, nada impide que vuelva. Es menos crítico que el arreglo en sí, pero es la garantía de cierre.

**Independent Test**: ejecutar la prueba que reproduce el caso: sobre el estado previo no termina; tras la corrección pasa, y el resto de la batería de pruebas sigue verde.

**Acceptance Scenarios**:

1. **Given** el estado actual sin la corrección, **When** se ejecuta la prueba que abre el histórico de una sesión en espera de respuesta, **Then** la prueba no termina (cuelga o bloquea).
2. **Given** la corrección aplicada, **When** se ejecuta esa prueba y la batería completa de pruebas, **Then** pasa y no hay regresiones en los comportamientos preexistentes.

---

### Edge Cases

- **Sesión en espera de respuesta con varias preguntas pendientes**: el histórico debe abrirse y mostrarlas todas, sin bloquearse por el número de preguntas.
- **Pregunta pendiente sin llamada a herramienta que la origine**: la pregunta debe seguir apareciendo en el histórico (posición de respaldo), igual que hoy, sin bloquear la apertura.
- **Cambios en vivo mientras el histórico está abierto**: la llegada de una pregunta nueva, su resolución o la actualización del mensaje en curso no deben bloquear el histórico ni el panel.
- **Sesión en espera de permiso (no de respuesta)**: su histórico no debe verse afectado ni debe congelarse.
- **Sesión sin preguntas pendientes**: el histórico no debe cambiar en absoluto.
- **Histórico largo** (muchas entradas): la apertura no debe degradar a un bloqueo por el volumen de entradas.
- **Canal en vivo caído o reconectando**: la apertura del histórico debe seguir funcionando con independencia del estado de conexión.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Abrir el histórico de una sesión en espera de respuesta MUST terminar en un historial mostrado, y la interfaz MUST seguir respondiendo; MUST NOT existir un bloqueo del hilo principal ni un consumo sostenido de CPU al abrirlo.
- **FR-002**: MUST NOT existir un camino que entre en bucle (sin progreso) al proyectar o representar el histórico de una sesión con preguntas pendientes.
- **FR-003**: El histórico MUST seguir mostrando las preguntas abiertas con el mismo contenido y la misma ubicación que hoy, tal como es actualmente, incluidas las de sesiones hijas/dependientes que hoy alimentan los badges de atención del Chat (no solo las de la sesión abierta).
- **FR-004**: El resto de sesiones (incluidas las que esperan un permiso) MUST conservar el comportamiento actual de su histórico.
- **FR-005**: Los badges de atención del Chat MUST conservar sus conteos y etiquetas actuales para toda sesión.
- **FR-006**: La corrección MUST estar cubierta por una prueba que, sin la corrección, no termina (cuelga), y que con la corrección pasa.
- **FR-007**: La corrección MUST NOT cambiar la interfaz, los textos ni la superficie pública del dominio Chat.
- **FR-008**: La corrección MUST funcionar igual con independencia del estado del canal en vivo (conectado, reconectando o caído).
- **FR-009**: La batería de pruebas del proyecto MUST seguir verde y las suites protegidas de la feature `012-refactor-workspace-enrichment` MUST NOT regresar.

### Key Entities *(include if data involved)*

- **Sesión en espera de respuesta**: sesión cuyo estado es «waiting-input»; puede tener una o más preguntas pendientes dirigidas al usuario.
- **Pregunta abierta**: solicitud dirigida al usuario que aún no ha sido respondida por él; tiene un texto/etiqueta que el histórico muestra.
- **Entrada de histórico**: ítem mostrado en el histórico de una sesión, etiquetado por autor (usuario/agente), con texto y posición cronológica.
- **Badge de atención**: señal del Chat que resume los pendientes de una sesión; expone un conteo y una etiqueta textual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las aperturas del histórico de una sesión en espera de respuesta terminan y devuelven el control a la interfaz; 0 casos de bloqueo del hilo o de consumo sostenido de CPU al abrirlo.
- **SC-002**: Abrir el histórico de una sesión en espera de respuesta se percibe tan receptivo como abrirlo en una sesión sin preguntas pendientes: el criterio es la ausencia de bloqueo observable (la prueba de la apertura termina dentro de su timeout y no hay reciclado de render ni consumo sostenido de CPU), sin un presupuesto explícito de ms/CPU.
- **SC-003**: El 100 % de las preguntas abiertas que hoy aparecen en el histórico de la sesión en espera de respuesta —incluidas las de sesiones hijas/dependientes que alimentan los badges de atención— sigue apareciendo con el mismo contenido que hoy (0 diferencias de texto, etiqueta o posición).
- **SC-004**: 0 cambios observables en el histórico de las sesiones sin preguntas pendientes y en los conteos/etiquetas de los badges de atención.
- **SC-005**: La prueba de la corrección no termina sobre el estado previo y pasa tras la corrección; la batería completa de pruebas sigue verde y las suites protegidas de `012-refactor-workspace-enrichment` permanecen intactas.

## Assumptions

- El defecto es una corrección de un comportamiento observable, no un refactor: no se persiguen mejoras de rendimiento generales, ni cambios de interfaz, textos o superficie pública.
- El alcance de producto son el histórico y los badges de atención del dominio Chat; otras superficies del visor quedan fuera salvo en lo estrictamente necesario para no romper su comportamiento.
- Se asume que el estado del servidor de OpenCode (sesiones, preguntas y formularios pendientes) no cambia; la corrección es del visor.
- Las preguntas abiertas de una sesión en espera de respuesta ya tienen una representación en el histórico hoy; el objetivo es conservarla, no rediseñarla.
- Se asume un umbral razonable de "termina y la interfaz responde": ausencia de bloqueo observable del hilo principal, sin presupuesto explícito de ms/CPU.
- La app está verde en el estado actual (`lint`, `tsc`, `tsc:node` y la batería de 1976 pruebas) y las 4 suites protegidas de `012-refactor-workspace-enrichment` están intactas; no deben regresar.
