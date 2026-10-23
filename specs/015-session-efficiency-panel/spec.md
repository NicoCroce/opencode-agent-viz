# Feature Specification: Panel de eficiencia de sesión

**Feature Branch**: `015-session-efficiency-panel`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Panel de análisis por sesión con eficiencia de los inputs del usuario y de las respuestas, hallazgos accionables con evidencia y una puntuación explicable. PRD: `.opencode/runs/20261023-eficiencia-sesion/prd.md`."

## Clarifications

### Session 2026-10-23

- Q: Cuando un indicador no alcanza su mínimo (Entrada sin 3 pares; Ejecución sin 10 llamadas y 5 pasos), ¿qué se omite y cuánto baja la cobertura? (FR-010, FR-012, FR-014) → A: Se omite la dimensión completa y la cobertura pierde su peso (Entrada 30; Ejecución 30); la caché opcional solo se omite a sí misma. Opción A.
- Q: ¿Cómo se detecta «tema ya respondido» en INP-3 de forma determinista, sin juicio generativo? (INP-3) → A: Se elimina la cláusula «tema ya respondido»; la condición queda solo en ≥2 preguntas o formularios con similitud ≥0,7. Opción A.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Veredicto explicable de un vistazo (Priority: P1)

Quien orquesta agentes cierra una sesión o se atasca en ella y quiere saber, sin releer la transcripción, si la sesión fue eficiente y de dónde vino el gasto o el reproceso. Desde la cabecera de la sesión en el grafo abre un panel superpuesto a pantalla completa y ve una puntuación entera, su banda, la cobertura, la confianza y los factores que más restan o suman, con su conteo.

**Why this priority**: Es la respuesta central que hoy no existe. Sin el veredicto, el usuario sigue sumando tokens a mano o adivinando la causa; el resto de la feature solo aporta detalle sobre esta lectura.

**Independent Test**: Con una sesión cerrada, con al menos dos turnos y cobertura suficiente, abrir el panel desde la cabecera del grafo y comprobar que aparecen puntuación, banda, cobertura, confianza y factores con conteo, sin leer el transcript.

**Acceptance Scenarios**:

1. **Given** una sesión cerrada con datos suficientes, **When** el usuario abre el panel desde la cabecera del grafo, **Then** ve una puntuación entera de 0 a 100, su banda, la cobertura, la confianza y entre 2 y 3 factores de mayor impacto con su conteo.
2. **Given** el veredicto visible, **When** el usuario consulta "cómo se calcula", **Then** ve los pesos de las cuatro dimensiones, qué dimensiones se omitieron por falta de muestra, la cobertura y la regla de confianza.
3. **Given** un factor del veredicto, **When** el usuario lo lee, **Then** entiende si resta o suma, qué indicador lo origina, con qué conteo y, si aplica, qué hallazgo lo respalda.
4. **Given** coste y latencia disponibles, **When** se muestra el veredicto, **Then** aparecen como contexto, separados de la puntuación, y no alteran la nota.

---

### User Story 2 - Hallazgos accionables con evidencia (Priority: P1)

Quien escribe prompts para agentes quiere saber qué cambiar la próxima vez. El panel le muestra hallazgos concretos, cada uno con la condición medida, una cita que permite localizarla en la conversación y una recomendación aplicable. Las señales débiles aparecen aparte y no contaminan la nota.

**Why this priority**: Es el valor accionable de la feature. Un veredicto sin evidencia no permite justificar decisiones ni mejorar el siguiente pedido; además, la evidencia es la defensa contra falsos positivos.

**Independent Test**: Con una sesión que contenga al menos un patrón reconocido, abrir el panel y comprobar que el hallazgo muestra condición medida, severidad, cita con turno y mensaje, y recomendación; comprobar que un candidato sin ancla no aparece.

**Acceptance Scenarios**:

1. **Given** un patrón detectado con evidencia, **When** el usuario lee el hallazgo, **Then** ve su identificador estable, la condición medida, la severidad, la cita con turno y mensaje y una recomendación concreta.
2. **Given** un candidato a hallazgo sin ancla verificable, **When** se construye el panel, **Then** no se muestra como hallazgo.
3. **Given** una señal débil, **When** se muestra, **Then** aparece en una sección separada y no altera la puntuación.
4. **Given** más de diez candidatos, **When** se listan, **Then** se muestran como máximo diez, priorizados por impacto, y las señales débiles quedan fuera de esa lista.
5. **Given** una compactación, una pregunta o un fallo de caché aislados, **When** se muestra, **Then** se presenta como señal y no resta puntos.

---

### User Story 3 - Tabla de turno a respuesta para localizar el reproceso (Priority: P2)

Quien revisa una sesión quiere seguir el hilo de lo que pidió, lo que se aclaró, lo que se obtuvo y lo que costó. El panel ofrece una tabla cronológica de turnos con el pedido, las aclaraciones, el resultado, el coste, el tiempo y las señales; cada fila se puede expandir para ver el prompt completo y la evidencia.

**Why this priority**: Permite pasar del veredicto al caso concreto. Sin esta tabla, el usuario tiene que cruzar la nota con el transcript para encontrar el turno que originó el reproceso.

**Independent Test**: Con una sesión de al menos dos turnos, comprobar que las filas aparecen en orden cronológico, que cada una muestra los campos esenciales y que al expandir una fila se ve el prompt completo y su evidencia.

**Acceptance Scenarios**:

1. **Given** una sesión con al menos un turno, **When** el usuario abre la sección de turnos, **Then** ve una tabla cronológica con pedido, aclaraciones, resultado, coste, tiempo y señales.
2. **Given** una fila de turno, **When** el usuario la expande, **Then** ve el prompt completo, la cita o evidencia y el detalle de las señales de ese turno.
3. **Given** una fila colapsada, **When** el prompt es largo, **Then** se muestra recortado con una acción visible para expandirlo.
4. **Given** una sesión con un solo turno, **When** se abre la tabla, **Then** se muestra el turno disponible y el veredicto indica que la muestra es insuficiente para puntuar.

---

### User Story 4 - Saber cuándo el panel no puede puntuar (Priority: P2)

Quien revisa una sesión en curso, muy corta o con datos incompletos necesita saber que no hay una nota fiable, en lugar de recibir un cero o un número inventado. El panel declara el estado, muestra las métricas crudas disponibles y explica qué falta.

**Why this priority**: La confianza en el panel depende de que no finja precisión. Una nota falsa en una sesión en curso o sin cobertura sería peor que no puntuar.

**Independent Test**: Abrir el panel en una sesión en curso, en una de un solo turno y en una con cobertura inferior al 60 %, y comprobar que en los tres casos no aparece nota y sí el estado y las métricas crudas.

**Acceptance Scenarios**:

1. **Given** una sesión en curso, **When** el usuario abre el panel, **Then** ve el estado "en curso", las métricas crudas y ninguna puntuación.
2. **Given** una sesión con menos de dos turnos cerrados, **When** se abre el panel, **Then** ve "muestra insuficiente" y ninguna puntuación.
3. **Given** una sesión con cobertura inferior al 60 %, **When** se calcula el veredicto, **Then** no se muestra puntuación y se declara la cobertura y las dimensiones ausentes.
4. **Given** un fallo al cargar los turnos, **When** el panel ya muestra el veredicto, **Then** el veredicto y los hallazgos se conservan y solo el bloque de turnos muestra su error.
5. **Given** una sesión sin mensajes, **When** se abre el panel, **Then** ve un estado vacío y ninguna puntuación.

---

### User Story 5 - El mismo análisis en móvil (Priority: P3)

Quien revisa desde el móvil quiere el mismo análisis sin arrastrar una tabla ancha. Cada turno se presenta como una tarjeta con los datos esenciales y una expansión; el veredicto y los hallazgos conservan la misma información que en escritorio.

**Why this priority**: El análisis no debe quedar limitado al escritorio, pero es una adaptación de una funcionalidad que ya existe; por eso va después de las historias principales.

**Independent Test**: Abrir el panel con ancho de viewport móvil y comprobar que no hay scroll horizontal de página, que cada turno es una tarjeta y que la expansión muestra el prompt completo y la evidencia.

**Acceptance Scenarios**:

1. **Given** un viewport móvil, **When** el usuario abre el panel, **Then** no hay scroll horizontal de página y el veredicto, los hallazgos y los turnos siguen siendo legibles.
2. **Given** una tarjeta de turno en móvil, **When** el usuario la expande, **Then** ve los mismos datos esenciales que la fila de escritorio y el prompt completo.
3. **Given** la misma sesión en escritorio y en móvil, **When** se comparan, **Then** la puntuación, la banda, la cobertura y los hallazgos coinciden.

### Edge Cases

- Sesión en curso: no hay nota; se muestra "en curso", el turno abierto no entra en los denominadores y los totales son los disponibles en ese momento.
- Sesión con menos de dos turnos cerrados: no hay nota; se muestra "muestra insuficiente" y las métricas crudas.
- Cobertura inferior al 60 %: no hay nota; se declara la cobertura y cada dimensión omitida.
- Subárbol incompleto o mensajes de un subagente aún no disponibles: el análisis se marca como parcial, se anota la limitación y se reduce la cobertura; no se inventan ceros.
- Tokens, coste o caché no reportados por el proveedor: se muestra "no disponible", no 0, y el indicador correspondiente se omite.
- Proveedor que no reporta caché: la dimensión Contexto se calcula con las compactaciones y se declara que la caché no estaba disponible.
- Resultado desconocido: la dimensión Resultado se omite; no se asume éxito ni fracaso.
- Una sola compactación, una sola pregunta o un solo fallo de caché: se muestra como señal, no resta.
- Compactación que cruza un turno: se anota la limitación y no se atribuye el efecto a un turno equivocado.
- Un turno abierto al cerrar el panel: queda fuera de los denominadores y se marca como abierto.
- Prompt corto: no se ofrece expansión; prompt largo: se recorta en la vista colapsada y se expande a demanda.
- Un hallazgo sin ancla, sin cita o sin recomendación: no se emite.
- Más de diez hallazgos candidatos: se muestran como máximo diez, priorizados por impacto; las señales débiles van aparte.
- Sesión de 200 mensajes: el panel abre con datos en menos de un segundo y no congela la interfaz.
- Panel abierto junto al histórico u otra capa superpuesta: solo una capa de este tipo puede estar abierta a la vez.
- Usuario que navega solo con teclado: puede abrir, recorrer, expandir, cerrar y volver al disparador sin trampas de foco.
- Viewport de 320 px: no hay scroll horizontal de página; las cifras clave conservan su legibilidad.
- Tema claro, oscuro y alto contraste: la banda, la severidad y el foco se distinguen sin depender solo del color.

## Requirements *(mandatory)*

### Functional Requirements

#### Acceso, alcance y lectura

- **FR-001**: El panel MUST abrirse como una capa superpuesta a pantalla completa desde la cabecera de la sesión en el grafo, sin cambiar de ruta ni perder la sesión de fondo.
- **FR-002**: El panel MUST analizar una sola sesión: la raíz seleccionada y todo su subárbol. El input humano se cuenta únicamente en la raíz; los mensajes de usuario de los subagentes no cuentan como entrada humana.
- **FR-003**: El panel MUST ser de solo lectura: no escribe, muta, exporta ni copia datos por defecto, y no envía información a ningún servidor.
- **FR-004**: El panel MUST abrirse con los datos ya disponibles de la sesión, sin exigir una acción de carga adicional y sin congelar la interfaz.
- **FR-005**: El panel MUST cerrarse con un control visible y con Escape; al cerrarse, el foco MUST volver al control que lo abrió.
- **FR-006**: Solo puede haber una capa superpuesta de este tipo abierta a la vez; abrir el histórico u otra capa MUST cerrar la de eficiencia y viceversa.
- **FR-007**: La interfaz del panel MUST estar en español en v1.

#### Veredicto y puntuación

- **FR-008**: El veredicto MUST mostrar una puntuación entera de 0 a 100, una banda (eficiente 85-100, aceptable 70-84, mejorable 50-69, con fricción 0-49), la cobertura y la confianza.
- **FR-009**: La puntuación MUST combinar cuatro dimensiones con pesos fijos: Entrada 30, Ejecución 30, Contexto 15, Resultado 25.
- **FR-010**: Cada dimensión disponible MUST calcularse como media ponderada de sus indicadores disponibles, renormalizada sobre los disponibles; la puntuación global MUST ser la media ponderada de las dimensiones disponibles. La cobertura MUST ser la suma de los pesos disponibles sobre 100: el peso completo de cada dimensión disponible, descontando la parte de los indicadores opcionales omitidos.
- **FR-011**: Cada indicador MUST aportar `1 − min(1, r / cap)`, donde `r` es la proporción observada y `cap` el tope de tolerancia; los valores concretos están en el modelo de puntuación.
- **FR-012**: Entrada, Ejecución y Resultado MUST exigir un mínimo de muestra o dato conocido sobre su indicador principal (INP-1: 3 pares; RES-1: 10 llamadas y 5 pasos; Resultado: resultado conocido). Si no lo alcanza, la dimensión MUST omitirse y declararse, NO MUST contar como 0 y la cobertura MUST perder el peso completo de la dimensión. Contexto no exige mínimo de compactaciones (0 es válido); la caché es opcional y, si falta o no alcanza 10 pasos, se omite solo ese indicador y la cobertura pierde únicamente su parte.
- **FR-013**: No MUST mostrarse puntuación cuando la sesión está en curso, hay menos de dos turnos cerrados o la cobertura es inferior al 60 %. En su lugar MUST mostrarse el estado correspondiente y las métricas crudas.
- **FR-014**: La confianza MUST ser alta, media o baja, derivada de la cobertura y del tamaño de muestra por dimensión; la regla MUST ser determinista y visible en "cómo se calcula".
- **FR-015**: El veredicto MUST destacar entre 2 y 3 factores de mayor impacto, con su conteo, indicando si restan o suman.
- **FR-016**: Todo punto perdido MUST ser trazable a un hallazgo o indicador con conteo, umbral, peso y aporte; el panel MUST ofrecer "cómo se calcula".
- **FR-017**: El coste y la latencia MUST mostrarse como contexto y NO MUST puntuar. El resultado y la eficiencia MUST presentarse como dimensiones separadas.
- **FR-018**: Un dato ausente NO MUST tratarse como 0 ni como 100; MUST mostrarse como "no disponible" y reducir la cobertura cuando corresponda.
- **FR-019**: Un evento aislado (una compactación, una pregunta o un fallo de caché) NO MUST penalizar; solo los patrones con muestra suficiente restan. Las señales débiles MUST ir en una sección aparte.
- **FR-020**: El panel NO MUST comparar sesiones, establecer rankings ni percentiles.
- **FR-021**: El análisis MUST ser determinista y reproducible: los mismos datos producen el mismo resultado.
- **FR-022**: El panel NO MUST usar juicio generativo ni servicios externos para puntuar o redactar hallazgos.

#### Hallazgos y evidencia

- **FR-023**: Cada hallazgo MUST tener un identificador estable, la condición medida, la severidad, una recomendación concreta y una cita con turno y mensaje; incluirá herramienta o formulario cuando aplique.
- **FR-024**: Un hallazgo sin ancla verificable NO MUST mostrarse.
- **FR-025**: El catálogo MUST tener como máximo diez reglas; el panel MUST priorizar por impacto y mostrar como máximo diez hallazgos.
- **FR-026**: Las señales débiles MUST mostrarse separadas y NO MUST alterar la puntuación.
- **FR-027**: El lenguaje MUST ser neutral y condicional ("posible fricción", "señal"), sin atribuir culpa ni valorar a la persona.
- **FR-028**: Cada hallazgo MUST incluir una recomendación accionable y específica de la condición medida, no un consejo genérico.
- **FR-029**: La cita MUST permitir localizar el turno y el mensaje; si hay varias evidencias, MUST mostrarse la más representativa.
- **FR-030**: Los prompts MUST mostrarse recortados en la vista colapsada y expandibles; el texto completo solo en la región expandida, nunca en tooltip y nunca copiado por defecto.

#### Turnos y detalle

- **FR-031**: Un turno MUST comprender el pedido humano y los pasos de respuesta posteriores hasta el siguiente pedido o el fin de la actividad; un turno abierto MUST excluirse de los denominadores.
- **FR-032**: Con al menos un turno, el panel MUST mostrar en escritorio una tabla cronológica con pedido, aclaraciones, resultado, coste, tiempo y señales; cada fila MUST poder expandirse. En móvil, la presentación equivalente son tarjetas (FR-034).
- **FR-033**: La fila expandida MUST mostrar el prompt completo, la evidencia o cita y el detalle de las señales del turno.
- **FR-034**: En vista móvil, cada turno MUST presentarse como tarjeta con los datos esenciales y expansión, sin scroll horizontal de página.
- **FR-035**: La tabla MUST mantener el orden cronológico y no MUST mezclar turnos de subagentes como si fueran pedidos humanos.

#### Estados, accesibilidad y presentación

- **FR-036**: Cada bloque MUST representar explícitamente los estados error, carga, vacío y datos, en ese orden.
- **FR-037**: Un fallo al cargar los turnos NO MUST vaciar el veredicto ni los hallazgos; el bloque afectado MUST mostrar su error y el resto MUST conservar sus datos.
- **FR-038**: El panel MUST ser operable solo con teclado: abrir, recorrer, expandir, cerrar y volver al disparador, con foco visible y sin trampas.
- **FR-039**: El panel MUST atrapar el foco mientras está abierto, cerrarse con Escape y devolver el foco al disparador.
- **FR-040**: La puntuación, la banda y la severidad MUST comunicarse con texto e icono, no solo con color; MUST cumplir contraste 4.5:1 para texto y 3:1 para elementos no textuales en claro, oscuro y alto contraste.
- **FR-041**: La puntuación MUST tener una etiqueta accesible completa, por ejemplo "78 de 100, eficiente"; la tabla MUST tener título y encabezados; las expansiones MUST anunciar su estado.
- **FR-042**: Las animaciones MUST ser opcionales y respetar la preferencia de movimiento reducido; la información MUST ser comprensible sin animación.
- **FR-043**: Los objetivos táctiles MUST cumplir el mínimo de 24×24 px (recomendado 44×44).
- **FR-044**: El panel MUST funcionar a 320 px de ancho sin scroll horizontal de página; las cifras clave MUST conservar al menos 12 px.
- **FR-045**: El panel MUST mostrar los totales de coste, tokens de entrada y salida, lectura y escritura de caché, compactaciones, reintentos, errores y llamadas a herramientas cuando estén disponibles, marcando "no disponible" cuando falten.
- **FR-046**: El panel MUST declarar en sus notas las limitaciones de datos que afecten la lectura: subárbol incompleto, tokens ausentes, compactación que cruza un turno u otras equivalentes.

#### Límites de v1

- **FR-047**: v1 MUST cubrir una sola sesión y NO MUST ofrecer entrada desde el rail de sesiones ni comparación histórica.
- **FR-048**: v1 NO MUST incluir escritura, mutación, exportación ni copia de datos.
- **FR-049**: v1 NO MUST puntuar longitud, idioma, gramática, tono ni cortesía del prompt.
- **FR-050**: v1 NO MUST inferir culpa ni satisfacción.

### Modelo de puntuación

La puntuación es un contrato de producto: los valores siguientes son los iniciales de v1 y pueden calibrarse con sesiones reales sin cambiar la estructura ni las guardas.

| Dimensión (peso) | Indicador (peso) | Qué mide | Tope de tolerancia | Mínimo |
|---|---|---|---|---|
| Entrada (30) | INP-1 (45 %) | Pares consecutivos de pedidos con similitud ≥ 0,6, ≥ 6 tokens y sin escritura de archivos entre medio | 0,50 | 3 pares |
| Entrada (30) | INP-2 (35 %) | Interrupciones del usuario por turno | 0,33 | — |
| Entrada (30) | INP-3 (20 %) | Proporción de preguntas o formularios repetidos sobre el total | 1,00 | — |
| Ejecución (30) | RES-1 (45 %) | Errores de herramientas sobre llamadas realizadas | 0,20 | 10 llamadas y 5 pasos |
| Ejecución (30) | RES-2 (35 %) | Reintentos sobre pasos | 0,10 | — |
| Ejecución (30) | RES-3 (20 %) | Llamadas redundantes sobre llamadas realizadas | 0,15 | — |
| Contexto (15) | RES-4 (70 %) | Compactaciones automáticas completadas: aporte `1 − min(1, max(0, n − 1) / 2)`; la primera no resta | — | — |
| Contexto (15) | Caché (30 %, opcional) | Tasa de acierto de caché: aporte `min(1, acierto / 0,6)` | — | 10 pasos |
| Resultado (25) | Resultado (70 %) | Éxito 1, interrumpido 0,5, fallo 0 | — | Resultado conocido |
| Resultado (25) | Errores abiertos (30 %) | Sin errores abiertos 1; con errores abiertos 0 | — | — |

Reglas de composición:

- Aporte de un indicador: `1 − min(1, r / cap)`.
- Dimensión disponible: media ponderada de sus indicadores disponibles, renormalizada sobre los disponibles.
- Puntuación global: media ponderada de las dimensiones disponibles.
- Cobertura: suma de los pesos disponibles / 100; una dimensión omitida no aporta su peso y la caché opcional omitida descuenta solo su parte.
- Mínimo de dimensión: se evalúa sobre el indicador principal (INP-1, RES-1 o resultado conocido); si no se alcanza, se omite la dimensión completa. Contexto no exige mínimo de compactaciones; la caché es opcional.
- Bandas: 85-100 eficiente; 70-84 aceptable; 50-69 mejorable; 0-49 con fricción.
- Sin puntuación si la sesión está en curso, hay menos de dos turnos o la cobertura es inferior al 60 %.
- Coste y latencia se muestran, no puntúan.
- La confianza se deriva de la cobertura y del tamaño de muestra; la regla concreta se muestra en "cómo se calcula" y nunca concede confianza alta con cobertura inferior al 85 %.

### Catálogo de hallazgos

| ID | Condición medida | Dimensión | Severidad | ¿Resta? |
|---|---|---|---|---|
| INP-1 | Reformulación: dos pedidos consecutivos con similitud ≥ 0,6, ≥ 6 tokens y sin escritura de archivos entre medio | Entrada | media; alta si ≥ 2 pares | Sí |
| INP-2 | Interrupción: interrupción del usuario, inactividad durante una ejecución o pedido mientras el agente está ocupado | Entrada | media | Sí |
| INP-3 | Aclaración repetida: ≥ 2 preguntas o formularios con similitud ≥ 0,7 | Entrada | media | Sí |
| INP-4 | Restricción tardía: marcador ("no", "sin", "solo", "sólo", "debe", "must", "only") tras la primera escritura y reedición del mismo archivo en ≤ 2 pasos | — | baja | No: señal débil |
| RES-1 | Herramientas fallidas: errores / llamadas ≥ 0,10 o ≥ 3; alta si ≥ 0,25 o contribuye al fallo | Ejecución | media | Sí |
| RES-2 | Reintentos: intento ≥ 3 o ≥ 3 reintentos | Ejecución | alta | Sí |
| RES-3 | Bucle o redundancia: ≥ 3 llamadas con la misma firma o ≥ 2 duplicados exactos con la misma salida | Ejecución | media | Sí |
| RES-4 | Presión de contexto: ≥ 2 compactaciones automáticas completadas; la primera no resta | Contexto | baja | Sí |
| RES-5 | Coste sin resultado: coste > 0 y resultado fallido o interrumpido, o coste > 0, sin archivos y fallido; sin umbrales en dinero | — | media | No: señal débil |
| RES-6 | Latencia de herramientas: percentil 95 de la duración > 60 s o ≥ 3 llamadas > 60 s | — | baja | No: señal débil |

### Key Entities *(include if feature involves data)*

- **Informe de eficiencia**: resultado del análisis de una sesión; atributos: estado (correcto, en curso, muestra insuficiente, sin datos), puntuación, banda, cobertura, confianza, dimensiones, hallazgos, señales débiles, turnos, totales y notas.
- **Dimensión**: parte ponderada de la puntuación; atributos: clave (Entrada, Ejecución, Contexto, Resultado), peso, valor, disponibilidad, indicadores y motivo de omisión.
- **Indicador**: medida dentro de una dimensión; atributos: clave, proporción observada, tope de tolerancia, aporte, conteo y mínimo exigido.
- **Hallazgo**: patrón con evidencia; atributos: identificador estable, condición medida, severidad, dimensión, si resta, evidencia, cita y recomendación.
- **Señal débil**: patrón observado que no resta; atributos equivalentes a un hallazgo, con la marca de que no penaliza.
- **Evidencia**: ancla que permite localizar el hallazgo; atributos: sesión, mensaje, herramienta o formulario, instante e índice de turno.
- **Turno**: unidad de pedido y respuesta; atributos: índice, pedido, aclaraciones, resultado, coste, duración, señales, abierto o cerrado.
- **Cita**: representación legible de la evidencia; atributos: turno, mensaje, herramienta o formulario, hora y texto.
- **Totales de sesión**: agregados mostrados como contexto; atributos: coste, tokens de entrada y salida, lectura y escritura de caché, compactaciones, reintentos, errores de herramientas y llamadas a herramientas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos 4 de 5 usuarios de dogfooding explican de dónde vino el coste o el reproceso en menos de 60 segundos mirando solo el panel.
- **SC-002**: Al menos el 80 % de los hallazgos mostrados se consideran correctos o útiles en una auditoría manual de 20 sesiones cerradas.
- **SC-003**: Al menos el 70 % de las sesiones cerradas con 3 o más turnos obtienen puntuación; 0 sesiones puntuadas tienen cobertura inferior al 60 %.
- **SC-004**: El 100 % de los hallazgos mostrados tiene ancla y cita; 0 hallazgos aparecen sin evidencia; 0 comparaciones entre sesiones aparecen en el panel.
- **SC-005**: El estado "muestra insuficiente" aparece en el 10 % o menos de las sesiones con 5 o más turnos.
- **SC-006**: El panel abre con datos en menos de 1 segundo para una sesión de 200 mensajes y no congela la interfaz.
- **SC-007**: El 100 % de los puntos perdidos es trazable a un hallazgo o indicador con conteo, umbral, peso y aporte en la auditoría de 20 sesiones.
- **SC-008**: 0 casos de dato ausente mostrado como 0 o como 100; los datos ausentes aparecen como "no disponible".
- **SC-009**: Un usuario que navega solo con teclado puede abrir, recorrer, expandir, cerrar y volver al disparador; 0 trampas de foco.
- **SC-010**: En un viewport de 320 px no hay scroll horizontal de página y el veredicto, los hallazgos y los turnos siguen siendo legibles.
- **SC-011**: 0 sesiones en curso, con menos de dos turnos o con cobertura inferior al 60 % reciben una puntuación.

## Assumptions

- El panel se abre desde la cabecera de la sesión en el grafo; no se añade entrada desde el rail de sesiones en v1.
- Se considera "sesión cerrada" la que ya no tiene actividad; el visor ya dispone del estado necesario para distinguirla de una sesión en curso.
- La sesión se considera en curso si la raíz o cualquier nodo de su subárbol está activo; en ese caso no hay puntuación.
- Los datos provienen de los mensajes y metadatos de sesión que el visor ya tiene disponibles. La feature no añade instrumentación, no modifica el servidor y no requiere una carga nueva solicitada por el usuario.
- El input humano se cuenta solo en la raíz; los pedidos de subagentes forman parte de la ejecución y no de la entrada del usuario.
- La escritura que interrumpe INP-1 es una herramienta que modifica archivos; un mensaje de texto del agente no cuenta.
- La inactividad de INP-2 es un evento de sesión inactiva mientras la ejecución estaba en curso; un hueco de tiempo sin eventos no cuenta por sí solo.
- Ausencia de dato no equivale a 0 ni a 100. Los totales que no se puedan derivar se muestran como "no disponible" y reducen la cobertura cuando corresponde.
- Los pesos, topes, mínimos y bandas son valores iniciales de producto y pueden calibrarse con sesiones reales sin cambiar el contrato de la feature; deben ser visibles en "cómo se calcula".
- La regla inicial de confianza se basa en la cobertura y en el tamaño de muestra por dimensión; es determinista, visible y nunca concede confianza alta con cobertura inferior al 85 %.
- La regla exacta de confianza media/baja se fija en el plan y se muestra en "cómo se calcula"; la alta exige cobertura ≥85 %.
- El recorte inicial del prompt en la vista colapsada es de referencia (aproximadamente 120 caracteres); el valor exacto puede ajustarse sin cambiar el comportamiento de expansión.
- La primera compactación no resta; a partir de la segunda se aplica la fórmula de presión de contexto.
- El catálogo de hallazgos está limitado a diez reglas; las señales débiles no forman parte de la puntuación.
- El panel es de solo lectura y no persiste nada; no hay exportación, copia por defecto ni envío de datos.
- La interfaz es en español en v1; no se puntúan longitud, idioma, gramática, tono ni cortesía.
- Se reutilizan las métricas de coste, tokens y contexto que el visor ya muestra cuando estén disponibles, sin duplicar su significado.
- La presentación móvil reutiliza la misma fuente de análisis que la de escritorio; solo cambia la presentación.
- El panel debe funcionar en tema claro, oscuro y alto contraste, y a 320 px de ancho.
- No se comparan sesiones entre sí en v1; no hay ranking, percentiles ni tendencia histórica.
- El panel no infiere culpa ni satisfacción; el lenguaje es condicional y neutral.

## Out of Scope

- Juicio por modelo generativo, puntuaciones opacas o cualquier servicio externo de evaluación.
- Comparación entre sesiones, ranking, percentiles o tendencia histórica.
- Escritura, mutación, exportación o copia de datos.
- Puntuar longitud, idioma, gramática, tono o cortesía del prompt.
- Atribuir culpa o inferir satisfacción.
- Entrada al panel desde el rail de sesiones.
- Análisis agregado de varias sesiones.
- Corrección automática de prompts o edición de la sesión.
- Nuevas dependencias, nueva instrumentación o cambios en el servidor.
