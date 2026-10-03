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
