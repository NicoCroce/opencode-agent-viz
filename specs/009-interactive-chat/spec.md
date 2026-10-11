# Feature Specification: Chat interactivo por sesión

**Feature Branch**: `009-interactive-chat`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "PRD — Chat interactivo por sesión (descubrimiento sddorch/20261010-chat-interactivo). Llevar el visor de solo lectura a poder enviar prompts, interrumpir y responder preguntas/permisos desde una interfaz de chat dentro de la columna del detalle, sin depender de la terminal."

## Clarifications

### Session 2026-10-10

- Q: Cuando el agente está en medio de un turno y envío un prompt nuevo, ¿qué debe pasar? → A: Encolar y aplicar al terminar el turno (no interrumpir).
- Q: Al pulsar Detener en una sesión con subagentes activos, ¿qué debe detenerse? → A: Solo el turno de la sesión abierta; los subagentes (sesiones hijas) siguen.
- Q: ¿Qué nivel de accesibilidad debe cumplir el chat? → A: WCAG 2.2 AA.
- Q: ¿Qué debe ver el operador cuando falla una acción de escritura? → A: Aviso efímero y accesible con el error, conservando el texto para reintentar.
- Q: ¿El compositor permite adjuntar archivos o imágenes en esta versión? → A: No; solo texto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enviar un prompt y ver la respuesta en vivo (Priority: P1)

El operador está siguiendo una sesión en el grafo. En la columna del detalle abre la pestaña Chat, escribe un prompt y lo envía. Su mensaje aparece en el hilo y el texto del agente se muestra progresivamente a medida que llega, hasta quedar como respuesta final.

**Why this priority**: es el núcleo de la propuesta: dirigir al agente sin volver a la terminal y sin perder el contexto visual.

**Independent Test**: abrir una sesión en pestaña Chat, enviar un texto y comprobar que el mensaje propio aparece y que el texto del agente se ve crecer hasta cerrarse como respuesta consolidada (sin duplicarse).

**Acceptance Scenarios**:

1. **Given** la pestaña Chat de una sesión abierta, **When** escribo un texto no vacío y lo envío, **Then** mi mensaje aparece en el hilo y el envío se confirma.
2. **Given** un turno del agente en curso, **When** llega texto nuevo, **Then** el texto se muestra progresivamente marcado "En curso".
3. **Given** un turno que termina, **When** se cierra, **Then** el texto provisional se reemplaza por la respuesta final consolidada y no se duplica.

---

### User Story 2 - Interrumpir un turno en curso (Priority: P1)

El operador ve que el agente va por un camino equivocado y quiere detenerlo sin ir a la terminal.

**Why this priority**: sin freno, una ejecución equivocada sigue consumiendo; es la acción de control mínima.

**Independent Test**: con un turno en curso, pulsar Detener y comprobar que el flujo se corta y que la interfaz vuelve a estado disponible.

**Acceptance Scenarios**:

1. **Given** un turno en curso, **When** pulso Detener, **Then** la ejecución se interrumpe.
2. **Given** una interrupción en curso, **When** se procesa, **Then** el control muestra estado de carga y luego vuelve a disponible.
3. **Given** que no hay turno en curso, **When** observo el control, **Then** no está disponible para interrumpir.

---

### User Story 3 - Responder preguntas y permisos, incluidos de subagentes (Priority: P1)

Un agente —o un subagente en una sesión hija— queda bloqueado esperando una respuesta. El operador la ve en la pestaña Chat, responde y la ejecución continúa.

**Why this priority**: una ejecución bloqueada sin señal se detiene silenciosamente; responder es lo que desbloquea el valor del visor.

**Independent Test**: provocar una pregunta/permiso (en la sesión raíz y en una hija), responderla desde el chat de la sesión abierta y comprobar que el pendiente se resuelve y desaparece.

**Acceptance Scenarios**:

1. **Given** un pendiente de la sesión abierta, **When** lo respondo, **Then** el pendiente se resuelve y deja de mostrarse.
2. **Given** un pendiente generado por una sesión hija (subagente), **When** lo respondo desde la sesión abierta, **Then** se resuelve identificando el origen (agente/sesión que lo generó).
3. **Given** un permiso con decisión "una vez", "siempre" o "rechazar", **When** elijo, **Then** la decisión se aplica y el control muestra el recurso/acción afectada antes de confirmar.
4. **Given** un pendiente ya resuelto por otra vía, **When** intento responderlo, **Then** el sistema avisa y no aplica una respuesta sobre un pendiente inexistente.

---

### User Story 4 - Elegir agente, modelo y razonamiento antes de enviar (Priority: P2)

El operador quiere decidir con qué agente, modelo y nivel de razonamiento responde la sesión.

**Why this priority**: da control sobre el resultado, pero el chat ya es útil sin cambiar la selección por defecto.

**Independent Test**: cambiar la selección y comprobar que el siguiente envío usa esa combinación y que el razonamiento se acota al modelo elegido.

**Acceptance Scenarios**:

1. **Given** el compositor, **When** abro el selector de agente, **Then** veo los agentes disponibles y puedo elegir uno.
2. **Given** un modelo elegido con variantes de razonamiento, **When** abro el selector de razonamiento, **Then** solo veo las variantes de ese modelo.
3. **Given** una selección hecha, **When** envío, **Then** el envío la usa y la selección queda reflejada como estado actual de la sesión.

---

### User Story 5 - Ser avisado de un pendiente y llegar a él (Priority: P2)

El operador está mirando el grafo y un agente queda esperando. Recibe una señal y puede ir a la request que la generó.

**Why this priority**: convierte un bloqueo silencioso en algo accionable; mejora clave sobre el estado actual.

**Independent Test**: provocar un pendiente en una sesión no enfocada y comprobar que aparece la señal (indicador en la sesión y en la pestaña Chat, aviso efímero y accesible) y que la acción lleva a la request origen.

**Acceptance Scenarios**:

1. **Given** un pendiente nuevo, **When** aparece, **Then** veo un indicador en la sesión, un banner en el panel y un aviso efímero y accesible.
2. **Given** la señal visible, **When** actúo sobre ella, **Then** navego/foco la request que la generó (aunque sea de una sesión hija).
3. **Given** un nodo del grafo afectado, **When** hay un pendiente, **Then** se resalta ese nodo y solo ese.
4. **Given** que el pendiente se resuelve, **When** se resuelve, **Then** todas las señales desaparecen.

---

### User Story 6 - Estado claro cuando el stream no llega (Priority: P3)

El operador abre el chat y necesita entender qué está pasando: cargando, sin datos, error o desconectado.

**Why this priority**: evita confundir "no hay respuesta" con "no hay conexión".

**Independent Test**: abrir la pestaña Chat en estados de carga, error y vacío, y simular que el stream no está conectado, y comprobar el mensaje correspondiente.

**Acceptance Scenarios**:

1. **Given** la pestaña Chat, **When** los datos cargan, **Then** veo carga; si fallan, error; si no hay nada, vacío; si hay, el contenido.
2. **Given** el stream desconectado, **When** intento enviar, **Then** se me avisa de que la respuesta en vivo puede no llegar aunque el envío se realice.

---

### User Story 7 - Usar el chat en móvil como una vista propia (Priority: P3)

El operador entra desde el móvil y accede al chat como un destino de primer nivel, sin tabbars anidadas, y no pierde lo que estaba escribiendo.

**Why this priority**: mantiene la paridad de acceso sin complicar la navegación.

**Independent Test**: en viewport móvil, abrir el chat desde la navegación principal, escribir algo, cambiar de vista y volver: el borrador sigue ahí.

**Acceptance Scenarios**:

1. **Given** un viewport móvil, **When** entro, **Then** el chat es un destino de primer nivel (no un tabbar dentro de otro tabbar).
2. **Given** texto a medio escribir en el compositor, **When** cambio de vista o roto el dispositivo, **Then** el borrador sobrevive.

---

### Edge Cases

- **Sesión sin actividad**: el chat muestra estado vacío y permite enviar el primer prompt.
- **Respuesta muy larga**: el texto en curso crece sin degradar la interacción ni provocar saltos en el grafo.
- **Reconexión durante el streaming**: si el canal se reconecta a mitad de un turno, el texto en curso no se pierde ni se duplica al consolidarse.
- **Envío con stream desconectado**: se permite enviar, con aviso de que la respuesta en vivo puede no llegar.
- **Prompt vacío o solo espacios**: no se envía.
- **Envío mientras el agente trabaja**: el prompt se encola y se aplica al terminar el turno, sin cortar el trabajo en curso.
- **Fallo de una acción de escritura**: se muestra un aviso accesible y se conserva lo escrito para reintentar.
- **Interrumpir sin turno en curso**: la acción no está disponible.
- **Interrumpir con subagentes activos**: se detiene solo el turno de la sesión abierta; las sesiones hijas siguen.
- **Pendiente resuelto por otra vía** (otra pestaña, el TUI): al intentar responder se avisa y no se aplica.
- **Modelo sin variantes de razonamiento**: el selector de razonamiento no ofrece opciones y el envío sigue funcionando.
- **Varias sesiones hijas con pendientes simultáneos**: cada uno se identifica por su origen y es accionable.
- **Envío simultáneo con el TUI en la misma sesión**: el turno puede quedar en cola; se documenta la limitación (la gestión de la cola no forma parte de esta versión).
- **Autorización "siempre"**: se muestra el recurso/acción que se autoriza antes de confirmar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir enviar a la sesión abierta un texto no vacío y reflejarlo en el hilo como mensaje propio.
- **FR-002**: El sistema MUST mostrar la respuesta del agente de forma progresiva durante el turno, etiquetada como "En curso" y nunca como respuesta final.
- **FR-003**: Al cerrarse el turno, el sistema MUST reemplazar el texto provisional por la versión consolidada sin duplicar contenido.
- **FR-004**: El sistema MUST permitir interrumpir el turno en curso de la sesión abierta (sin detener sus sesiones hijas/subagentes), mostrando estado de carga en el control mientras se procesa.
- **FR-005**: El sistema MUST permitir responder permisos con decisión explícita (una vez / siempre / rechazar) y formularios según sus opciones.
- **FR-006**: Antes de enviar una respuesta, el sistema MUST verificar que el pendiente siga abierto y, si no lo está, avisar sin aplicar la respuesta.
- **FR-007**: El sistema MUST hacer accionables los pendientes generados por sesiones hijas (subagentes) desde la sesión abierta, identificando el origen.
- **FR-008**: El sistema MUST ofrecer selectores de agente, modelo y variante de razonamiento; la variante MUST provenir del modelo elegido.
- **FR-009**: El sistema MUST señalar los pendientes con: indicador en la sesión, indicador en la pestaña Chat, banner en el panel, aviso efímero y accesible, y realce del nodo afectado del grafo.
- **FR-010**: La señal de atención MUST llevar a la request que la generó, aunque pertenezca a una sesión hija.
- **FR-011**: El sistema MUST resolver y limpiar todas las señales de un pendiente cuando este se resuelve.
- **FR-012**: La pestaña Chat MUST cumplir los estados de pantalla obligatorios (error → carga → vacío → datos) y MUST avisar cuando el canal en vivo no está conectado.
- **FR-013**: En viewport móvil, el chat MUST ser un destino de navegación de primer nivel, sin tabbars anidadas.
- **FR-014**: Una sola fuente de lógica MUST alimentar la presentación de escritorio y la de móvil.
- **FR-015**: El borrador del compositor MUST sobrevivir al cambio de pestaña/vista y a la rotación del dispositivo.
- **FR-016**: El grafo MUST NOT reaccionar a los deltas de texto ni re-layoutarse por ellos; la disposición actual se conserva.
- **FR-017**: Antes de confirmar una autorización persistente ("siempre"), el sistema MUST mostrar el recurso/acción que se autoriza.
- **FR-018**: El sistema MUST restringir el acceso al servidor de desarrollo a loopback y validar el origen de las peticiones, para que la capacidad de escritura no quede expuesta fuera de la máquina.
- **FR-019**: El sistema MUST validar la entrada del usuario (texto de prompt, decisión de permiso, selección de modelo) antes de enviarla.
- **FR-020**: Cuando el agente esté en medio de un turno, el sistema MUST encolar el prompt y aplicarlo al terminar el turno, sin interrumpirlo.
- **FR-021**: El chat MUST cumplir WCAG 2.2 AA: operable por teclado, foco visible, contraste ≥4.5:1 (texto) y ≥3:1 (UI no textual), roles ARIA correctos, sin trampas de foco y con anuncios de estado accesibles.
- **FR-022**: Si una acción de escritura falla, el sistema MUST mostrar un aviso efímero y accesible con el error y MUST conservar el texto/estado del compositor para reintentar.
- **FR-023**: El compositor MUST aceptar solo texto en esta versión (sin adjuntar archivos ni imágenes).

### Key Entities *(include if data involved)*

- **Mensaje de la sesión**: una intervención en el hilo, del usuario o del agente; tiene autor, contenido y momento.
- **Parte en curso**: fragmento de texto o razonamiento que se está recibiendo en vivo, asociado al turno y a su ordinal; se consolida al cerrarse.
- **Pendiente**: petición de entrada al usuario —pregunta de formulario o permiso— con su estado (abierta/resuelta), su sesión de origen y, en permisos, el recurso afectado y las decisiones posibles.
- **Opción de agente**: agente disponible para la sesión.
- **Opción de modelo**: modelo disponible, con sus variantes de razonamiento asociadas.
- **Selección activa**: combinación vigente de agente, modelo y variante de razonamiento de la sesión.
- **Señal de atención**: marca de que una sesión tiene un pendiente, con su tipo y su momento, consumida por indicadores, banner, aviso y realce del nodo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El operador completa un ciclo prompt→respuesta sin abandonar la web en el 100% de los casos de uso probados.
- **SC-002**: El operador recibe y resuelve un pendiente surgido en una sesión hija sin ir a la terminal.
- **SC-003**: La recepción de texto en vivo no provoca saltos de la disposición del grafo (0 reposicionamientos durante un turno).
- **SC-004**: El primer texto de la respuesta se percibe como inmediato tras iniciarse el turno (progresivo, sin esperas perceptibles de bloque).
- **SC-005**: Un pendiente nuevo queda señalado en la interfaz en el momento en que ocurre, sin recargar manualmente.
- **SC-006**: El borrador escrito sobrevive al cambio de pestaña/vista en todos los casos probados.
- **SC-007**: En móvil, se llega al chat en un solo paso desde la navegación principal.
- **SC-008**: El chat es operable por completo con teclado y cumple WCAG 2.2 AA en los flujos principales (envío, interrupción, respuesta a pendientes, selección de agente/modelo/razonamiento).

## Assumptions

- El operador trabaja en su máquina, en loopback, con el TUI de OpenCode posiblemente abierto en paralelo sobre la misma sesión.
- Un único operador (no hay multiusuario ni roles); la escritura queda siempre activa, compensada con la restricción de acceso al servidor (FR-018).
- La gestión de la cola de turnos (inbox) al escribir en paralelo con el TUI se difiere a una versión posterior; en esta versión solo se documenta la limitación.
- Los agentes y modelos disponibles provienen del catálogo que ya expone el servidor de OpenCode.
- El compositor trabaja solo con texto en esta versión; los adjuntos (archivos/imágenes) quedan fuera de alcance.
- El chat cumple WCAG 2.2 AA como nivel de accesibilidad exigido.
- La escritura se dirige al agente y no muta datos propios del visor (Principio I enmendado).
