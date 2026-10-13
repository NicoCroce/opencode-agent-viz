# PRD — Detalle del nodo por secciones (tablist) en el Inspector

> Independiente de la tecnología: qué y por qué, nunca cómo. Es entrada de `specify`.
> Run: `20261013-inspector-detail-tabs` · ruta `sdd-1` · modo Auto.

## Problema

Quien investiga una ejecución multi-agente abre el detalle de un nodo y no encuentra lo que busca: el panel apila ocho bloques en un scroll largo y el contenido técnico (Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia) queda detrás de un desplegable **"Avanzado" colapsado**. Por defecto no se ve nada de ese contenido, no hay vistas separadas por tema y, cuando se expande, todo se apila en un único scroll donde el usuario tiene que buscar la sección que le interesa. Importa porque es justo el contenido con el que se diagnostica una ejecución (qué herramienta falló, qué preguntó el agente, qué permisos pidió, cuánto tardó cada respuesta).

## Usuarios

- **Perfil principal:** desarrollador que revisa una ejecución concreta para entender un resultado raro (un agente que no terminó, una respuesta lenta, un permiso rechazado). Trabaja nodo a nodo, abriendo y cerrando detalles.
- **Contexto de escritorio:** panel de detalle lateral, ancho variable y redimensionable por el usuario (el ancho útil cambia en vivo).
- **Contexto móvil:** el mismo detalle como destino de pantalla completa; no hay tabbar de secciones anidada.

## Objetivos

- Que las siete secciones técnicas estén accesibles directamente desde el detalle, sin expandir ningún control ni adivinar dónde están.
- Que cada sección se vea **por separado**, sin apilarse con las demás en un mismo scroll.
- Que el resumen del nodo (identidad, modelo, métricas, contexto, recursos, duración mediana por herramienta) siga leyéndose como una secuencia continua, sin intersecciones.
- Que cambiar de sección no pierda el hilo: la sección elegida por defecto es la primera y el contenido nuevo aparece justo donde mira el usuario.

## No-objetivos

- No cambia el contenido, los datos ni la lógica interna de cada sección.
- No cambia el tablist externo "Detalle | Chat" ni su comportamiento.
- No cambia la presentación ni la navegación móvil.
- No se persiste la sección elegida (estado efímero, se restablece al abrir el detalle y se mantiene entre nodos).
- No se añaden contadores ni insignias en las pestañas.
- No se reordenan ni se renombran las secciones del resumen.

## Historias de usuario (priorizadas, independientes)

| Id | Prioridad | Historia | Criterio de aceptación |
|---|---|---|---|
| H1 | P1 | Como desarrollador que revisa un nodo quiero abrir cada sección técnica por separado para examinarla sin el ruido de las demás | Dado el detalle de un nodo abierto, Cuando miro al final del detalle, Entonces veo siete pestañas nombradas (Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia) y al elegir una veo solo esa sección |
| H2 | P1 | Como desarrollador quiero que la vista inicial no dependa de un paso previo para llegar al contenido técnico | Dado un nodo recién abierto, Cuando el detalle termina de pintarse, Entonces la pestaña activa es "Subagentes" y su contenido es visible sin ninguna acción adicional |
| H3 | P1 | Como desarrollador quiero ver el resumen del nodo sin que lo tengan que compartir espacio con las secciones técnicas | Dado el detalle abierto, Cuando recorro el panel de arriba abajo, Entonces encuentro Identidad, Modelo, Métricas, Contexto (Paralelismo y Aporte al padre), Recursos y Duración mediana por herramienta, y las siete secciones técnicas no aparecen en ese recorrido |
| H4 | P2 | Como usuario de teclado quiero recorrer y elegir sección sin ratón | Dado el foco en la lista de secciones, Cuando uso las flechas izquierda/derecha o Inicio/Fin, Entonces muevo la selección entre las siete y la sección activa se actualiza |
| H5 | P2 | Como desarrollador quiero leer todas las pestañas en cualquier ancho del panel | Dado el panel en su ancho mínimo y en su ancho máximo, Cuando miro la lista de secciones, Entonces las siete etiquetas se leen completas, sin recortes ni desplazamiento horizontal |
| H6 | P2 | Como desarrollador quiero que una sección no afirme estar vacía mientras los datos siguen cargando | Dado que el detalle aún está obteniendo la actividad del nodo, Cuando abro Subagentes, Herramientas, Respuestas o Errores, Entonces veo el estado de carga (o de error) y no un mensaje de "sin datos" |
| H7 | P3 | Como desarrollador quiero que el panel siga siendo usable si uso alto contraste o tema claro | Dado un entorno de contraste forzado, Cuando miro la sección activa y recorro con el teclado, Entonces distingo cuál está activa y dónde está el foco |

## Requisitos funcionales

- RF1: el detalle del nodo termina con una lista de siete pestañas en este orden exacto: Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia.
- RF2: exactamente una pestaña está activa; su sección es la única visible. Las otras seis no se muestran.
- RF3: la pestaña activa al abrir un nodo es Subagentes; el estado es efímero (no persistido) y sobrevive al cambio de nodo.
- RF4: el resumen (Identidad, Modelo, Métricas, Contexto con Paralelismo y Aporte al padre, Recursos, Duración mediana por herramienta) permanece como recorrido continuo, sin pestañas, y las siete secciones salen de él.
- RF5: cada sección conserva su encabezado interno y su denominación actual (incluida "Respuestas"); no se renombra ninguna sección ni su etiqueta de pestaña.
- RF6: la lista de pestañas envuelve en varias filas; ninguna etiqueta se corta, trunca ni abrevia y no hay desplazamiento horizontal.
- RF7: la selección funciona con puntero y con teclado (flechas, Inicio/Fin); el foco es visible.
- RF8: las cuatro secciones sin estado propio (Subagentes, Herramientas, Respuestas, Errores) muestran error y carga además de vacío, coherentes con el resto del panel.
- RF9: la sección de Latencia conserva su contenido completo (referencia de umbral, control del umbral y listado de respuestas medidas con sus anomalías); no se filtra ni se deshabilita por haber anomalías.
- RF10: el archivo y los documentos que describían el desplegable "Avanzado" dejan de describirlo y pasan a describir este comportamiento.
- RF11: el tablist externo "Detalle | Chat" no cambia de comportamiento ni de aspecto.
- RF12: en móvil el mismo detalle ofrece las siete pestañas, sin lista de destinos adicional ni navegación paralela.

## Métricas de éxito

- Las siete secciones son alcanzables con una sola acción desde el detalle (0 desplegables, 0 pasos intermedios).
- Ninguna sección aparece dos veces en el panel (no hay bloques duplicados entre resumen y pestañas).
- Las siete etiquetas se leen completas en los anchos mínimo y máximo del panel.
- Cero regresiones en el flujo "Detalle | Chat" y en la navegación móvil.
- Ninguna pestaña afirma "sin datos" mientras su fuente está en carga o en error.

## Restricciones

Principios de la constitución que aplican (según el norte):

- I — los cambios se ciñen a lo pedido; el alcance es reordenar presentación, no rediseñar el panel.
- II — todo vive en el dominio Inspector; ningún dominio importa a otro por esto.
- V — la lógica de la pestaña activa es estado derivado y testeable fuera del componente.
- VI — cada sección resuelve explícitamente error → carga → vacío → datos; una sección vacía nunca puede deberse a un dato aún no resuelto.
- VIII — specs junto al código, TypeScript y lint en modo estricto; los contratos existentes se actualizan cuando dejan de ser ciertos.

Accesibilidad: el tablist es un patrón de pestañas anidado dentro de otro panel con pestañas; debe cumplir el patrón APG (foco itinerante, un panel visible, etiqueta propia y distinta de la del tablist externo) y WCAG 2.2 AA en contraste (indicador activo y texto inactivo) y foco visible.

## Decisiones y supuestos

Decisiones del usuario (`decision/*`, no se reabren):

| Clave | Decisión |
|---|---|
| `decision/modo-ruta` | Ruta `sdd-1` en modo Auto; los contratos de specs/004 y specs/010 quedan superseded por spec/plan. |
| `decision/secciones-a-tabs` | Las siete secciones pasan al tablist; el resumen queda en el scroll principal. |
| `decision/latencia-tab` | La pestaña se llama "Latencia" y contiene todo lo que hoy rinde la sección de latencia. |
| `decision/tablist-wrap` | La lista envuelve en varias filas; se descartan la fila con scroll horizontal y las etiquetas acortadas. |
| `decision/tab-inicial` | Activa por defecto = Subagentes; estado efímero, no persistido. |
| `decision/scroll-y-activacion` | El tablist vive dentro del scroll del panel (no fijo), y la activación es automática al mover la selección con flechas. |
| `decision/encabezados-en-paneles` | Cada panel conserva el encabezado de su sección; prevalece accesibilidad sobre la recomendación de quitarlo. |
| `decision/primitivo-tabs` | Se corrige el componente compartido de pestañas (alto automático + envoltura, indicador activo con contraste suficiente y foco visible). |
| `decision/sin-badges` | Las pestañas solo llevan su nombre; sin contadores. |
| `decision/hilar-estados` | Las cuatro secciones sin estado reciben carga y error. |
| `decision/etiqueta-respuestas` | La pestaña se llama "Respuestas" aunque su contenido incluya llamadas a herramienta y preguntas. |

Supuestos aceptados:

- El usuario llega al detalle desde el panel lateral (escritorio) o desde el destino Inspector (móvil); no hay un tercer punto de entrada.
- Aceptar una pestaña vacía por defecto es preferible a esconder las secciones tras un desplegable (apuesta del norte, coste de fricción asumido).
- El solapamiento parcial entre "Respuestas", "Herramientas" y "Preguntas y permisos" se acepta tal cual (decisión del usuario), aun siendo una fuente conocida de ambigüedad.
- El descubrimiento de las secciones al final del scroll es aceptable: son las secciones técnicas, y el resumen sigue siendo lo primero.

## Preguntas abiertas

1. **Contraste del texto inactivo en tema claro** (ratio 4.39:1, por debajo de 4.5:1). El tema de ejecución es siempre oscuro, por lo que el fallo es latente. Opciones: corregirlo en este cambio (toca un token compartido) / dejarlo latente y registrarlo aparte. Recomendada: dejarlo latente y registrar hallazgo. Impacto: bajo mientras el runtime no sirva tema claro.
2. **Semántica del encabezado de sección**: el componente de encabezado emite un `<span>`, no un encabezado real; con los paneles de pestaña ya etiquetados por su pestaña, la estructura interna es laxa. Opciones: promover el encabezado a nivel 3 (afecta a todo el panel en toda la app) / dejarlo y registrar hallazgo. Recomendada: fuera de alcance de este run. Impacto: bajo para esta feature, medio para la app entera.
3. **Alcance de la limpieza documental**: ¿basta con poner al día los dos contratos superseded y los comentarios de código tocados, o se barre también el resto de documentos de las specs afectadas? Opciones: solo los contratos vigentes + comentarios en código / barrido completo. Recomendada: solo los contratos vigentes y los comentarios de código tocados. Impacto: medio (trabajo, no producto).
4. **Zona táctil de las pestañas**: cumplen el mínimo AA (24 px) pero quedan por debajo de la recomendación de 44 px; agrandarlas las separa del aspecto de "Detalle | Chat". Opciones: mantener el tamaño actual (paridad visual) / agrandarlas solo en el tablist de secciones. Recomendada: mantener la paridad. Impacto: bajo.
