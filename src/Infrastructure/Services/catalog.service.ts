import type { AgentInfo, McpServer, ModelInfo, Project } from '@opencode/client';
import { opencodeClient } from './client';

/** Catálogo global: proyectos, agentes, modelos y servidores MCP. */
export interface CatalogReadService {
  listProjects: () => Promise<Project[]>;
  listAgents: (directory?: string) => Promise<AgentInfo[]>;
  listModels: (directory?: string) => Promise<ModelInfo[]>;
  getDefaultModel: (directory?: string) => Promise<ModelInfo | null>;
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
  async listModels(directory) {
    const { data } = await opencodeClient.model.list({
      location: { directory },
    });
    return data;
  },
  async getDefaultModel(directory) {
    const { data } = await opencodeClient.model.default({
      location: { directory },
    });
    return data;
  },
  async getMcpServers(directory) {
    const { data } = await opencodeClient.mcp.list({ location: { directory } });
    return data;
  },
};
