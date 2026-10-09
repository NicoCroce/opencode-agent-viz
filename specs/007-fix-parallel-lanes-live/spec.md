# Feature Specification: Filas paralelas correctas en el grafo en vivo

**Feature Branch**: `007-fix-parallel-lanes-live`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Los subagentes que se lanzan en paralelo no se ven en la misma línea mientras la ejecución está en vivo. Al refrescar la vista, sí aparecen correctamente en la misma fila. Verificar y corregir."

## Clarifications

### Session 2026-10-08

- Q: ¿En qué capa atacamos la causa raíz de que los intervalos de sesión no solapen en vivo? → A: Enfoque mixto: mantener fresca la marca de actividad (datos) **y** tratar las sesiones activas como intervalo abierto hasta "ahora" (layout).
- Q: ¿Qué alcance funcional debe tener el arreglo? → A: Filas + badge/indicador de paralelismo, alineados por la misma lógica de intervalos.
- Q: ¿Qué sesiones deben considerarse de "intervalo abierto hasta ahora" para evaluar el solape? → A: Solo las de estado activo explícito (running / retrying / compacting / esperas); nunca inferirlo de intervalos vacíos.
- Q: ¿Cómo mantenemos fresca la marca de última actividad de las sesiones en vivo? → A: Parchear la marca de última actividad en la caché de sesiones con los eventos de actividad/estado relevantes, aprovechando el batching existente (sin red adicional).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los subagentes paralelos en una sola fila mientras corren (Priority: P1)

Como persona que observa una ejecución en curso, quiero ver a los subagentes que fueron lanzados al mismo tiempo alineados en una única fila horizontal apenas aparecen, sin tener que refrescar la página.

**Why this priority**: Es el defecto reportado y el que rompe la lectura del grafo durante la observación en vivo, que es el caso de uso principal de la herramienta.

**Independent Test**: Abrir una sesión que lanza N subagentes concurrentes y observar el grafo durante el stream: los N deben compartir la misma fila (mismo carril) en todo momento; refrescar no debe cambiar la disposición.

**Acceptance Scenarios**:

1. **Given** una sesión raíz que lanza varios subagentes concurrentes, **When** los subagentes van apareciendo por el stream en vivo, **Then** todos se muestran en la misma fila a medida que se crean, sin apilarse.
2. **Given** una ejecución en vivo con subagentes paralelos visibles, **When** la persona refresca la vista, **Then** la disposición no cambia (mismos subagentes, misma fila).
3. **Given** una ejecución en vivo ya finalizada, **When** la persona inspecciona el grafo, **Then** el agrupamiento de paralelos coincide con el que se vio durante la ejecución.

---

### User Story 2 - Subagentes no concurrentes siguen en filas distintas (Priority: P2)

Como persona que observa, quiero que los subagentes que corrieron uno después del otro (sin solaparse en el tiempo) se sigan mostrando en filas distintas, para no confundir ejecución secuencial con paralela.

**Why this priority**: El arreglo del P1 no debe degradar la semántica de secuencial vs. paralelo, que es el valor diferencial de la vista.

**Independent Test**: Ejecutar un padre que lanza un subagente, espera a que termine y recién entonces lanza otro; deben quedar en filas separadas en vivo y tras refrescar.

**Acceptance Scenarios**:

1. **Given** un padre que lanza subagentes de forma secuencial (sin solape), **When** se observan en vivo, **Then** cada uno ocupa una fila consecutiva distinta.
2. **Given** un padre que lanza dos grupos: uno paralelo y luego otro paralelo posterior, **When** se observan en vivo, **Then** cada grupo comparte su propia fila y los grupos quedan en filas distintas.

---

### User Story 3 - El agrupamiento no "salta" durante la ejecución (Priority: P3)

Como persona que observa, quiero que las filas no cambien de un instante a otro por eventos sin relevancia estructural, para poder seguir el grafo sin que los nodos se muevan.

**Why this priority**: mejora la legibilidad y evita desorientación, pero es secundario frente a mostrar la fila correcta.

**Independent Test**: Con subagentes paralelos ya en una fila, dejar correr eventos de contenido (texto, tools) y verificar que ninguno de los nodos salta de fila.

**Acceptance Scenarios**:

1. **Given** subagentes paralelos ya alineados en una fila, **When** llegan eventos de contenido o de estado no estructurales, **Then** su fila y orden se mantienen estables.

---

### Edge Cases

- **Sesiones creadas después de abrir la vista**: subagentes que arrancan con posterioridad al montaje de la pantalla deben agruparse igual que si ya existieran al abrir.
- **Sesiones sin marca de fin de actividad**: una sesión en curso sin dato de última actividad no debe interpretarse como de duración cero ni perderse del agrupamiento.
- **Hermanos creados con milisegundos de diferencia**: no alcanza con "casi al mismo tiempo"; debe usarse el solape real de actividad.
- **Duración real muy corta**: subagentes que terminan casi instantáneamente pero corrieron juntos deben agruparse si su actividad se solapó.
- **Sesión que termina durante la observación en vivo**: al pasar de activa a terminada debe conservar un fin real de actividad, de modo que el agrupamiento final coincida con el de la vista reabierta.
- **Reconexión del stream**: tras reconectar, la disposición no debe degradarse respecto de antes de la desconexión.
- **Muchos hermanos concurrentes**: el layout debe seguir distribuyéndolos en columnas sin pérdida.
- **Raíz única sin subagentes**: no debe haber regresión en ejecuciones de un solo agente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST agrupar en una misma fila a los agentes hermanos (mismo padre) cuyos intervalos de actividad se solapan.
- **FR-002**: El sistema MUST evaluar el solape usando la actividad real: mientras un agente está en estado activo (running / retrying / compacting / esperas), su intervalo se considera abierto hasta el instante presente observado, no hasta una marca de tiempo desactualizada. Las sesiones terminadas MUST usar su fin real de actividad.
- **FR-003**: El sistema MUST recalcular el agrupamiento y la disposición cuando cambie el conjunto de agentes en curso, aunque la estructura de quién invoca a quién no cambie.
- **FR-004**: El sistema MUST producir el mismo agrupamiento y la misma disposición para un mismo estado de sesiones, con independencia de si la vista se acaba de abrir o lleva tiempo abierta (paridad en vivo vs. refresco).
- **FR-005**: Los agentes cuyos intervalos de actividad no se solapan MUST permanecer en filas distintas, preservando el orden temporal (antes arriba).
- **FR-006**: El sistema MUST mantener el orden determinista de columnas dentro de una fila (por instante de inicio; desempate estable por identificador).
- **FR-007**: Los cambios de contenido o estado no estructurales MUST NOT alterar la fila ni el orden de los agentes ya ubicados.
- **FR-008**: El cálculo de agrupamiento y niveles MUST seguir siendo una función pura y testeable, sin dependencia de React.
- **FR-009**: El sistema MUST mantener actualizada la marca de última actividad de cada sesión con la actividad/estado observados en vivo, de modo que las sesiones que terminan conserven un fin de actividad real.
- **FR-010**: El indicador/badge de paralelismo de cada agente MUST derivarse de la misma lógica de intervalos que la disposición de filas, para evitar inconsistencias entre "se ve paralelo" y "se ubica en fila".
- **FR-011**: La inferencia de "actividad abierta" MUST NOT basarse en intervalos vacíos ni en datos faltantes: solo en el estado activo explícito del agente.

### Key Entities *(include if data involved)*

- **Nodo de agente**: representa una sesión en el grafo; expone instante de inicio, marca de actividad/última actualización y estado de ejecución.
- **Intervalo de actividad**: rango temporal durante el cual un agente se considera activo; base para decidir solape entre hermanos.
- **Nivel / fila de ejecución**: tanda de agentes que corren juntos; determina la fila vertical.
- **Columna**: posición horizontal del agente dentro de su fila.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las ejecuciones con N subagentes concurrentes, los N aparecen en una sola fila durante el stream en vivo, sin refrescar.
- **SC-002**: Refrescar la vista no produce ningún cambio de fila ni de orden respecto de la vista en vivo (0 diferencias en N ejecuciones observadas).
- **SC-003**: 0 regresiones en ejecuciones secuenciales: los subagentes no concurrentes siguen en filas distintas.
- **SC-004**: El agrupamiento se mantiene estable: 0 saltos de fila ante eventos no estructurales durante una ejecución observada.
- **SC-005**: La disposición en vivo queda igual a la disposición reconstruida al reabrir la sesión en el 100% de los casos revisados.

## Assumptions

- La semántica de "paralelo" se define por solape temporal de actividad de hermanos; no se agregan heurísticas de intención.
- El grafo sigue siendo de solo lectura; no se cambia la fuente de datos ni se envían acciones al servidor.
- Se mantienen las convenciones de arquitectura vigentes (lógica de layout pura y testeable, datos vía hooks).
- El problema es de presentación (agrupamiento/disposición), no de pérdida de datos: la información de tiempos ya existe, solo no se refresca/interpreta en vivo.
- La noción de "activo" reutiliza la clasificación de estado de ejecución ya existente en la app (running / retrying / compacting / esperas), sin introducir criterios nuevos.
- La actualización de la marca de actividad aprovecha el procesamiento por lotes ya existente; no se agregan llamadas de red por evento.
- La disposición de referencia "correcta" es la que la app ya produce al reabrir la sesión con el estado completo de tiempos.
