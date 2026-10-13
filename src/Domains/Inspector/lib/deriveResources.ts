import type { InstructionEntryInfo, McpServer } from '@opencode/client';
import type { TResourceUsage, TSkillUsage } from '../Inspector.entity';

/**
 * Proyecta los recursos usados por la sesión al view-model del Inspector:
 * servidores MCP con su estado, keys de instrucciones, skills cargadas y
 * nombres de herramientas. Las instrucciones son entries por sesión en V2, no
 * una lista global del config como en V1; por eso se reciben ya resueltas. Las
 * skills llegan **ya derivadas** (`deriveSkills`) para no recalcularlas aquí y
 * son una prop **requerida**: quien proyecta decide qué se cargó (incluido el
 * caso vacío, `deriveSkills(messages) === []`), no este proyector.
 */
export const deriveResources = ({
  mcpServers,
  instructions,
  skills,
  tools,
}: {
  mcpServers: McpServer[];
  instructions: InstructionEntryInfo[];
  skills: TSkillUsage[];
  tools: string[];
}): TResourceUsage => ({
  mcpServers: mcpServers.map((server) => ({
    name: server.name,
    status: server.status.status,
  })),
  instructions: instructions.map((entry) => entry.key),
  skills,
  tools,
  availability: 'available',
});
