import type { McpServer } from '@opencode/client';

/** `McpServer.status` es una unión discriminada por `status`. */
export type TMcpStatus = McpServer['status']['status'];

export interface TResourceUsage {
  mcpServers: { name: string; status: TMcpStatus }[];
  instructions: string[];
  skills: { name: string }[];
  tools: string[];
  availability: 'available';
}
