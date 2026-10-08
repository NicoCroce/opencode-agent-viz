import type { AgentInfo, McpServer, Project } from '@opencode/client';
import { opencodeClient } from './client';

/** Catálogo global: proyectos, agentes y servidores MCP. */
export interface CatalogReadService {
  listProjects: () => Promise<Project[]>;
  listAgents: (directory?: string) => Promise<AgentInfo[]>;
  getMcpServers: (directory?: string) => Promise<McpServer[]>;
}

export const catalogReadService: CatalogReadService = {
  async listProjects() {
    return opencodeClient.project.list();
  },
  async listAgents(directory) {
    const { data } = await opencodeClient.agent.list({
      location: { directory },
    });
    return data;
  },
  async getMcpServers(directory) {
    const { data } = await opencodeClient.mcp.list({ location: { directory } });
    return data;
  },
};
