import type { InstructionEntryInfo, McpServer } from '@opencode/client';
import type { TResourceUsage } from '../Inspector.entity';

/**
 * Proyecta los recursos usados por la sesión al view-model del Inspector:
 * servidores MCP con su estado, keys de instrucciones y nombres de herramientas.
 * Las instrucciones son entries por sesión en V2, no una lista global del config
 * como en V1; por eso se reciben ya resueltas.
 */
export const deriveResources = ({
  mcpServers,
  instructions,
  tools,
}: {
  mcpServers: McpServer[];
  instructions: InstructionEntryInfo[];
  tools: string[];
}): TResourceUsage => ({
  mcpServers: mcpServers.map((server) => ({
    name: server.name,
    status: server.status.status,
  })),
  instructions: instructions.map((entry) => entry.key),
  skills: [],
  tools,
  availability: 'available',
});
