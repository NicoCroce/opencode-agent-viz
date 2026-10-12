# PRD — Chat interactivo por sesión

> Independiente de la tecnología: qué y por qué, nunca cómo. Es entrada de `specify`.

## Problema
El visor multi-agente de OpenCode es hoy **solo lectura**: muestra sesiones, grafo, historial, preguntas y permisos, pero para dirigir al agente (enviar un prompt, interrumpir una respuesta, responder una pregunta o autorizar un permiso) el operador debe **volver a la terminal**. Al salir pierde el contexto visual del grafo y de la sesión que seguía. Peor: cuando un agente —o un subagente— queda bloqueado esperando una respuesta, la ejecución se **detiene sin que la web lo señale**, y el operador puede tardar en notarlo. No existe un lugar donde observar y dirigir a la vez, ni forma de reaccionar a un bloqueo sin cambiar de herramienta.

## Usuarios
- **Operador único en su máquina (dev):** lanza ejecuciones multi-agente de OpenCode y las sigue desde la web; trabaja en loopback con el TUI de OpenCode abierto en paralelo.
- **Observador de sesiones con subagentes:** necesita ver y responder preguntas que surgen en sesiones hijas, no solo en la raíz.

## Objetivos
- Enviar un prompt a la sesión abierta y ver la respuesta del agente aparecer **progresivamente** en la misma vista.
- **Interrumpir** un turno en curso.
- **Responder preguntas y permisos** pendientes, incluidos los generados por sesiones hijas/subagentes, sin cambiar de vista.
- Elegir **agente, modelo y variante de razonamiento** antes de enviar.
- Ser **avisado** cuando un agente necesita una respuesta y poder **llegar a la request que la generó**.
- Mantener **una sola superficie** de observación+acción: el chat vive dentro de la columna del detalle.

## No-objetivos
- Cuarta columna; el chat es un modo del panel de detalle (pestañas Detalle|Chat).
- Chat por-agente o por-nodo: el chat es general a la sesión `:id`.
- Toggle de escritura: la escritura queda siempre activa (compensada con endurecimiento del dev server).
- Cambiar el reducer del grafo para procesar deltas (el grafo los ignora).
- Listar o cancelar la cola (inbox) al escribir en paralelo con el TUI: diferido a v2.

## Historias de usuario (priorizadas, independientes)
| Id | Prioridad | Historia | Criterio de aceptación |
|---|---|---|---|
| H1 | P1 | Como operador quiero enviar un prompt a la sesión abierta y ver la respuesta en vivo para dirigir sin volver a la terminal | Dado el chat de `:id`, cuando escribo y envío, entonces mi mensaje aparece y el texto del agente se muestra progresivamente marcado "En curso" |
| H2 | P1 | Como operador quiero interrumpir un turno en curso para detener una ejecución equivocada | Dado un turno en curso, cuando pulso Detener, entonces el flujo se corta y el estado de envío vuelve a disponible |
| H3 | P1 | Como operador quiero responder preguntas/permisos —incluidos de subagentes— para desbloquear la sesión | Dado un pendiente de la sesión o de una hija, cuando respondo, entonces el pendiente se resuelve y desaparece de la bandeja |
| H4 | P2 | Como operador quiero elegir agente/modelo/razonamiento antes de enviar para controlar cómo responde | Dado el composer, cuando selecciono, entonces el envío usa esa combinación; el razonamiento se acota al modelo elegido |
| H5 | P2 | Como operador quiero ser avisado de un pendiente y llegar a él para no dejar la ejecución detenida | Dado un pendiente, cuando aparece, entonces veo badge/banner/toast y al actuar navego y enfoco la request origen |
| H6 | P3 | Como operador quiero estados de pantalla claros (error/carga/vacío) para entender qué pasa | Dada la sesión abierta, el panel muestra error → carga → vacío → datos, en ese orden, y el estado de conexión si el stream no llega |
| H7 | P3 | Como operador en móvil quiero acceder al chat como una vista propia para usarlo sin tabbars anidadas | Dado viewport móvil, cuando entro, entonces el chat es un destino de primer nivel y el draft sobrevive al cambiar de vista |

## Requisitos funcionales
- RF1: Enviar texto no vacío a la sesión abierta; el mensaje del usuario se refleja y la respuesta llega por streaming.
- RF2: El texto en curso se muestra etiquetado "En curso" y nunca como respuesta final; al cerrarse el turno se reemplaza por la versión consolidada, sin duplicar.
- RF3: Permitir interrumpir el turno en curso, con estado de carga en el botón.
- RF4: Responder permisos con decisión explícita (una vez / siempre / rechazar) y formularios según sus opciones; revalidar que el pendiente siga abierto antes de enviar.
- RF5: Los pendientes de sesiones hijas son accionables desde la sesión abierta, identificando el agente/sesión de origen.
- RF6: Selectores de agente, modelo y variante de razonamiento; la variante proviene del modelo elegido.
- RF7: Señal de atención ante pendientes: indicador en la sesión y en la pestaña Chat, banner en el panel, aviso efímero y accesible, y realce en el nodo del grafo afectado; la acción lleva a la request que la generó.
- RF8: El chat respeta los estados de pantalla obligatorios y avisa cuando el stream no está conectado (el envío puede funcionar aunque no llegue la respuesta en vivo).
- RF9: En móvil, el chat es un destino de primer nivel; una sola lógica alimenta ambas presentaciones (escritorio y móvil).
- RF10: El grafo no reacciona a los deltas de texto y conserva su disposición actual.
- RF11: El draft del composer sobrevive al cambio de pestaña/vista y a la rotación.

## Métricas de éxito
- El operador completa un ciclo prompt→respuesta sin abandonar la web.
- Recibe y resuelve un pendiente de una sesión hija sin ir a la terminal.
- La recepción de texto en vivo no degrada la interacción ni provoca saltos del grafo.

## Restricciones
Aplican los principios de la constitución; la enmienda al **Principio I (solo lectura)** se explicita: con la capa de escritura, el visor deja de ser estrictamente de lectura; se conserva el espíritu no destructivo (escritura al agente, no mutación de datos del visor) y se refuerza el control de acceso al dev server. Se respetan: **II** (reuso de presentación pura entre dominios), **III** (el SDK se consume solo vía service/fachada), **VI** (estados de pantalla y validación de entrada de usuario), **VII** (el grafo no se relayouta por deltas). Convención AGENTS §9: mobile-first, una sola fuente de lógica, dos presentaciones.

## Decisiones y supuestos
- `sddorch/20261010-chat-interactivo/decision/hardening-dev-server` — endurecer dev server (Origin/Referer + loopback).
- `.../chat-stream-key` — buffer de stream en clave raíz separada.
- `.../chat-mobile-top-level-tab` — en móvil, chat como tab de primer nivel.
- `.../a11y-repo-wide-tokens-focus` — corrección de tokens/foco en todo el visor.
- `.../inbox-deferred-v2` — cola (inbox) diferida a v2.
- `.../write-facade-sibling` — escritura como servicio hermano.
- `.../tabs-radix` — pestañas con patrón APG completo.
- `.../streaming-render` — texto plano durante el delta; enriquecido al cerrar.
- `.../composer-validation` — validación local con Zod; Enter envía, Shift+Enter salta línea, respeta IME.
- `.../attention-and-input-request` — slices nuevos de atención/stream; bandeja de pendientes sobre el composer; respuesta inline; draft en controlador.
Supuestos: el operador corre la app en loopback; el TUI puede operar la misma sesión en paralelo.

## Preguntas abiertas
- Prioridad de señales de atención simultáneas (pestaña + banner + aviso + pulso) para evitar saturación → recomendada: pestaña+banner+aviso, pulso solo en el nodo afectado.
- Confirmación (vs acción inmediata) al autorizar un permiso persistente "siempre" → recomendada: mostrar el recurso/acción autorizada en el propio control antes de decidir.
