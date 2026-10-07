export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'],
  },
  sessions: {
    all: ['sessions'] as const,
    // El endpoint /session se scopea por `directory`: la lista es por proyecto.
    list: (directory: string) => [...queryKeys.sessions.all, directory, 'list'],
    detail: (directory: string, id: string) => [
      ...queryKeys.sessions.all,
      directory,
      'detail',
      id,
    ],
    // El estado y los mensajes se indexan por sessionID (único global),
    // porque los eventos no siempre exponen el `directory`.
    status: () => [...queryKeys.sessions.all, 'status'],
    messages: (id: string) => [...queryKeys.sessions.all, 'messages', id],
    // V2 no expone todos de sesión: las tareas del subagente se derivan de los
    // tool calls `subagent`/`task` del propio contexto del mensaje.
    tasks: (id: string) => [...queryKeys.sessions.all, 'tasks', id],
    instructions: (id: string) => [
      ...queryKeys.sessions.all,
      'instructions',
      id,
    ],
    // Señales de ejecución en vivo (retry/compaction/outcome/interruptReason),
    // parcheadas por el reducer de eventos y sembradas desde el log durable.
    execution: (id: string) => [...queryKeys.sessions.all, 'execution', id],
    // Histórico completo paginado por cursor (`useInfiniteQuery`).
    history: (id: string) => [...queryKeys.sessions.all, 'history', id],
    // Impacto del agente en el repositorio (archivos + parches).
    diff: (id: string) => [...queryKeys.sessions.all, 'diff', id],
    // Lista cruda de formularios/preguntas al usuario (`FormInfo[]`), tal cual
    // la consume el grafo (`useGraphModel`).
    forms: (id: string) => [...queryKeys.sessions.all, 'forms', id],
    // Preguntas resueltas (`TQuestionEntry[]`) que consumen el Inspector y el
    // histórico (`useSessionForms`). Clave propia para NO compartir caché con la
    // lista cruda `forms(id)`: ambas formas de datos son incompatibles y, con
    // `staleTime: Infinity`, ganaba quien cargase primero. Se anida bajo
    // `forms(id)` para que la invalidación de `forms(id)` en los eventos
    // `form.*` alcance también a esta clave por coincidencia de prefijo.
    questions: (id: string) => [...queryKeys.sessions.forms(id), 'questions'],
    // Turnos en cola de la sesión.
    inbox: (id: string) => [...queryKeys.sessions.all, 'inbox', id],
    // Contexto resultante tras una compactación.
    context: (id: string) => [...queryKeys.sessions.all, 'context', id],
    // Log durable de la sesión (siembra de señales, `follow: false`).
    log: (id: string) => [...queryKeys.sessions.all, 'log', id],
  },
  agents: {
    all: ['agents'] as const,
    list: (directory: string) => [...queryKeys.agents.all, directory, 'list'],
  },
  mcp: {
    all: ['mcp'] as const,
    servers: (directory: string) => [...queryKeys.mcp.all, directory, 'servers'],
  },
  config: {
    all: ['config'] as const,
    detail: (directory: string) => [...queryKeys.config.all, directory, 'detail'],
  },
  permissions: {
    all: ['permissions'] as const,
    list: () => [...queryKeys.permissions.all, 'list'],
    for: (id: string) => [...queryKeys.permissions.all, id],
  },
  graph: {
    all: ['graph'] as const,
    for: (directory: string, sessionId: string) => [
      ...queryKeys.graph.all,
      directory,
      sessionId,
    ],
  },
  metrics: {
    all: ['metrics'] as const,
    for: (directory: string, sessionId: string) => [
      ...queryKeys.metrics.all,
      directory,
      sessionId,
    ],
  },
  connection: {
    state: ['connection', 'state'] as const,
  },
};
