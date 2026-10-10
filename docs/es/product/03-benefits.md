# Bondades y beneficios

Cada bondad en formato **qué es → por qué te sirve → qué te evita**, para que
se entienda el valor y no solo la función.

## Conexión en vivo

- **Qué es:** un indicador con tres estados — connected / reconnecting /
  disconnected — que refleja el stream SSE.
- **Por qué te sirve:** sabés si lo que ves está actualizado o si la conexión
  se cayó.
- **Qué te evita:** creer que una ejecución está quieta cuando en realidad se
  perdió el stream.

## Sesiones

- **Qué es:** lista de sesiones raíz con agente, título, estado y hora; la más
  reciente queda activa por defecto.
- **Por qué te sirve:** entrás directo a lo que te interesa, sin buscar.
- **Qué te evita:** perderte entre ejecuciones y no saber cuál mirar.

## Grafo jerárquico en vivo

- **Qué es:** grafo agente → subagente (React Flow + dagre) con estado en vivo
  y layout estable ante cambios que no alteran la topología.
- **Por qué te sirve:** ves la estructura de la orquestación de un vistazo y
  cómo avanza cada nodo.
- **Qué te evita:** reconstruir mentalmente el árbol de agentes desde el texto.

## Inspector por nodo

- **Qué es:** panel de detalle con agente, modelo, esfuerzo, historial de
  herramientas, todos y errores.
- **Por qué te sirve:** diagnosticás un nodo puntual sin salir del contexto.
- **Qué te evita:** saltar entre logs y pantallas para entender un agente.

## Detalle de ejecución

- **Qué es:** la conversación completa de cualquier agente/subagente.
  - **Respuestas y razonamiento** en texto enriquecido (markdown/GFM)
    sanitizado, con toggle independiente de razonamiento, en orden
    cronológico e intercalado con las llamadas a herramientas.
  - **Historial completo** con carga progresiva sin límite, cabecera de
    identidad/métricas y navegación padre ↔ hijo.
  - **Estado de ejecución** con 9 estados consistentes
    (`created`, `running`, `retrying`, `compacting`, `waiting-permission`,
    `waiting-input`, `succeeded`, `failed`, `interrupted`) y motivo de
    reintento o interrupción.
  - **Barra de resumen de sesión:** contadores de estado, costo/tokens
    acumulados y tiempo transcurrido, actualizados en vivo sin relayout.
  - **Impacto en el repositorio:** archivos cambiados con estado y líneas
    sumadas/removidas, más el patch por archivo.
  - **Esperas y diagnóstico:** motivo del permiso, preguntas del usuario con
    opciones/estado, turnos en cola, contexto de compactación y duración mediana
    de herramientas.
- **Por qué te sirve:** pasás de "no sé qué pasó" a la secuencia exacta de
  hechos.
- **Qué te evita:** adivinar por qué un agente hizo lo que hizo.

## Métricas

- **Qué es:** duración, costo y uso de tokens (entrada/salida/razonamiento/
  caché) por agente y por sesión, con un estado explícito "no disponible".
- **Por qué te sirve:** comparás y priorizás dónde se va el presupuesto.
- **Qué te evita:** pagar por sesiones sin entender su costo.

## Loops y reintentos

- **Qué es:** conteo de invocaciones y detección de loops por reintentos del
  proveedor, con evidencia.
- **Por qué te sirve:** detectás un agente que insiste en vano.
- **Qué te evita:** dejar corriendo algo que gira en el aire y consume recursos.

## Recursos disponibles

- **Qué es:** skills, archivos de instrucciones, servidores MCP y herramientas
  disponibles, etiquetados como **"available"** (nunca "used").
- **Por qué te sirve:** entendés qué tenía el agente a mano al ejecutar.
- **Qué te evita:** confundir "lo tenía disponible" con "lo usó".

## Follow mode y espera de permisos

- **Qué es:** auto-centrado en el nodo activo, desactivable, y resaltado
  especial para nodos que esperan permisos del usuario.
- **Por qué te sirve:** seguís el hilo de una ejecución larga sin buscarlo, y
  ves al instante dónde te necesitan.
- **Qué te evita:** que una sesión quede colgada porque no notaste que pedía
  permiso.

## De solo lectura, por diseño

- **Qué es:** el visor nunca envía prompts, aborta sesiones ni responde
  permisos/preguntas, y no procesa deltas de texto en streaming (solo texto
  consolidado).
- **Por qué te sirve:** podés mirar ejecuciones reales sin intervenirlas.
- **Qué te evita:** que una herramienta de observación introduzca efectos
  secundarios.

## Rendimiento en tiempo real

- **Qué es:** eventos procesados en lotes, texto/reasoning ignorado y sin
  relayout completo del grafo ante cambios de estado.
- **Por qué te sirve:** la UI se mantiene fluida con muchas sesiones y miles de
  herramientas.
- **Qué te evita:** que la propia observabilidad degrade lo que observa.

## UI oscura, plana y responsive

- **Qué es:** tema oscuro, diseño plano y presentación mobile-first (una fuente
  de lógica, dos presentaciones vía `useDevice`).
- **Por qué te sirve:** funciona igual de bien en desktop y en mobile.
- **Qué te evita:** pantallas partidas o layouts que se rompen en el celular.
