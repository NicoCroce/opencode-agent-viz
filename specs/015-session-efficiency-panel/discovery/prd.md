# PRD — Panel de eficiencia de sesión

> Qué y por qué. Entrada de `specify`. Sin decisiones de implementación.

## Problema

Quien orquesta agentes en OpenCode cierra una sesión con un total de coste y una transcripción larga, pero no sabe si el gasto y los reprocesos vinieron de un pedido ambiguo, de la ejecución o del proveedor. Sin esa atribución no puede mejorar el próximo prompt con confianza: suma tokens a mano, relee el transcript o adivina la causa.

## Usuarios

- **Dev/autor de agentes o tech lead** que ya corre flujos multi-agente y revisa la sesión al cerrarla o al atascarse.
- Necesita justificar coste y decisiones ante el equipo con evidencia trazable (job social) y sentir control, no culpa difusa (job emocional).

## Objetivos

- Responder en menos de un minuto dónde se fue el tiempo/dinero y qué cambiar la próxima vez.
- Evaluar la **entrada** por fricción observable aguas abajo (reformulación, interrupción, aclaración repetida), nunca por estilo.
- Evaluar la **respuesta** con tokens/coste, caché, herramientas, reintentos, compactaciones, latencia y resultado.
- Emitir hallazgos concretos con ancla y cita, y una puntuación explicable con cobertura y confianza.
- No inventar nota cuando faltan datos: decirlo.

## No-objetivos

- Juicio por LLM, scores opacos o dependencias nuevas.
- Comparación entre sesiones, ranking o percentiles.
- Escritura, mutación o exportación de datos.
- Puntuar longitud, idioma, gramática, tono o cortesía del prompt.
- Atribuir culpa o inferir satisfacción.

## Historias de usuario

| Id | Pri. | Historia | Criterio de aceptación |
|---|---|---|---|
| H1 | P1 | Como revisor quiero un veredicto con 2-3 factores para entender la sesión de un vistazo | Dado una sesión cerrada con datos, cuando abro el panel, veo nota entera, banda, cobertura y los factores que más restan/suman, con su conteo |
| H2 | P1 | Como autor quiero hallazgos accionables con evidencia para cambiar el próximo prompt | Dado un hallazgo, cuando lo leo, veo condición medida, cita con turno/mensaje y una recomendación concreta; sin ancla no aparece |
| H3 | P2 | Como revisor quiero la tabla turno→respuesta para localizar el reproceso | Dado ≥2 turnos, veo filas cronológicas con petición, aclaraciones, resultado, coste, tiempo y señales; puedo expandir una fila |
| H4 | P2 | Como autor quiero saber si el panel no puede puntuar | Dado una sesión en curso, corta o sin cobertura, veo "en curso"/"muestra insuficiente" y métricas crudas, nunca una nota falsa |
| H5 | P3 | Como usuario móvil quiero el mismo análisis sin scroll horizontal | Dado viewport móvil, cada turno se presenta como tarjeta con los datos esenciales y expansión |

## Requisitos funcionales

- RF1: El panel analiza **una** sesión: raíz y su subárbol; el input humano se cuenta solo en la raíz.
- RF2: Catálogo máximo de 10 hallazgos con id estable, condición medible, severidad, recomendación y cita.
- RF3: Solo los patrones con muestra suficiente restan; un evento aislado se muestra como señal y no penaliza. Las señales débiles van en sección aparte.
- RF4: Score 0-100 entero con 4 dimensiones ponderadas (Entrada 30, Ejecución 30, Contexto 15, Resultado 25); coste y latencia se muestran, no puntúan.
- RF5: Sin nota si la sesión está en curso, hay menos de 2 turnos o la cobertura es <60 %. Cada dimensión exige su denominador mínimo; si falta, se omite y se declara.
- RF6: Todo punto perdido es trazable a un hallazgo (indicador, conteo, umbral, peso, aporte); la UI muestra "cómo se calcula".
- RF7: Estados por bloque en orden error → carga → vacío → datos; un fallo de turnos no vacía el veredicto.
- RF8: El prompt se muestra recortado y expandible; nunca en tooltip ni en copia por defecto.

## Modelo de puntuación y guardas

Dimensiones: Entrada (INP-1 45 %, INP-2 35 %, INP-3 20 %), Ejecución (RES-1 45 %, RES-2 35 %, RES-3 20 %), Contexto (compactaciones 70 %, caché 30 % opcional), Resultado (outcome 70 %, errores abiertos 30 %). Para cada indicador, aporte = 1 − min(1, r/cap). Dimensión = media ponderada de indicadores disponibles, renormalizada **declarando** lo que falta; global = media ponderada de dimensiones disponibles; cobertura = peso disponible / 100. Bandas: 85-100 eficiente, 70-84 aceptable, 50-69 mejorable, 0-49 con fricción. Confianza alta/media/baja según cobertura y n por dimensión.

Guardas: dato ausente ≠ 0 ≠ 100; resultado y eficiencia son dimensiones separadas; una compactación, una pregunta o un cache miss aislados no penalizan; umbrales en constantes exportadas y visibles; sin comparación entre sesiones; lenguaje neutral ("posible fricción", "señal"), nunca "mal prompt".

## Alcance v1

Panel superpuesto a pantalla completa abierto desde la cabecera de la sesión en el grafo, en español, solo lectura, sin comparación histórica ni entrada desde el rail de sesiones. Tabla de turnos con prompt recortado/expandible. Señales débiles separadas del score. Sesión raíz + subárbol.

## Criterios de éxito verificables

- ≥4 de 5 usuarios de dogfooding explican de dónde vino el coste/reproceso en <60 s mirando solo el panel.
- ≥80 % de los hallazgos mostrados se consideran correctos/útiles en auditoría manual de 20 sesiones cerradas.
- ≥70 % de sesiones cerradas con ≥3 turnos obtienen puntuación; 0 sesiones puntuadas con cobertura <60 %.
- 100 % de hallazgos con ancla y cita; 0 sin evidencia; 0 comparaciones entre sesiones.
- ≤10 % de "datos insuficientes" en sesiones con ≥5 turnos.
- El panel abre con datos en <1 s en una sesión de 200 mensajes sin bloquear el grafo.

## Restricciones

Constitución: solo lectura (I); SDK solo en servicios (III); lógica pura y testeable en `lib/` (V); estados error→carga→vacío→datos (VI); reutilizar métricas existentes en vez de duplicarlas. Sin dependencias nuevas.

## Decisiones y supuestos

Vinculantes: `decision/panel-overlay` (overlay), `decision/fuente-datos` (TSessionMessage, raíz), `decision/modelo-puntuacion` (4 dimensiones, guardas), `decision/heuristicas-producto` (fricción, no estilo; 10 hallazgos), `decision/alcance-v1` (español, una sesión, sin rail). Supuesto: umbrales calibrables con sesiones reales sin cambiar el contrato.

## Preguntas abiertas

- Calibración fina de umbrales (Jaccard, caps, bandas) con dogfooding; no bloquea v1.
