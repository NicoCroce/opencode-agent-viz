import type { McpServer } from '@opencode/client';

/** `McpServer.status` es una unión discriminada por `status`. */
export type TMcpStatus = McpServer['status']['status'];

/**
 * Skill cargada en la sesión (FR-009). `count` lleva las repeticiones y
 * `estTokens` es la estimación **por carga** (caracteres de texto ÷ 4), no la
 * suma de todas las cargas; `null` cuando el tool no trajo texto.
 */
export interface TSkillUsage {
  name: string;
  count: number;
  estTokens: number | null;
  firstLoadedAt: number;
}

export interface TResourceUsage {
  mcpServers: { name: string; status: TMcpStatus }[];
  instructions: string[];
  skills: TSkillUsage[];
  tools: string[];
  availability: 'available';
}
