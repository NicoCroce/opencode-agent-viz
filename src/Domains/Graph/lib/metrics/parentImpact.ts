import type { TParentImpact } from '../../Graph.entity';
import { deriveContextBreakdown, toolContentChars } from './contextBreakdown';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';

/**
 * Tools que abren una sesión hija. `subagent` es el nativo de V2; `task`
 * aparece en el historial escrito por versiones anteriores (mismo conjunto que
 * `deriveTasks`, para que el vínculo padre→hijo coincida).
 */
const SUBAGENT_TOOLS = new Set(['subagent', 'task']);

/** `metadata.sessionID` de una parte tool, o `null` si no aplica. */
const metadataSessionId = (part: TContentPart): string | null => {
  if (part.type !== 'tool') return null;
  const { state } = part;
  // En streaming el input/metadata llegan parciales: sin vínculo todavía.
  if (state.status === 'streaming') return null;
  const metadata = state.metadata;
  if (metadata === null || typeof metadata !== 'object') return null;
  const sessionID = (metadata as { sessionID?: unknown }).sessionID;
  return typeof sessionID === 'string' && sessionID.length > 0 ? sessionID : null;
};

/** ¿Es la parte el tool de spawn del hijo `childSessionId`? */
const isSpawnTool = (part: TContentPart, childSessionId: string): boolean =>
  part.type === 'tool' &&
  SUBAGENT_TOOLS.has(part.name) &&
  metadataSessionId(part) === childSessionId;

/**
 * Deriva el aporte del resultado de un hijo al contexto de su padre
 * (FR-012/FR-013; `contracts/context-metrics-contract.md` §3). Localiza el tool
 * de spawn por `metadata.sessionID` (mismo vínculo que `deriveTasks`) y reparte
 * los caracteres de su resultado sobre el contexto total del padre. Devuelve
 * `null` cuando no se halla el tool (nodo raíz, padre sin cargar o vínculo
 * ausente) → la UI muestra "no disponible".
 *
 * Se calcula **bajo demanda** en el hook del Inspector (research R5), no en el
 * modelo del grafo.
 */
export const deriveParentImpact = (
  parentId: string,
  parentMessages: TSessionMessage[],
  childSessionId: string,
): TParentImpact | null => {
  const spawn = parentMessages
    .flatMap((message) => message.parts)
    .find((part) => isSpawnTool(part, childSessionId));

  if (!spawn || spawn.type !== 'tool') return null;

  const { state } = spawn;
  const addedChars =
    'content' in state && state.content ? toolContentChars(state.content) : 0;

  const breakdown = deriveContextBreakdown(parentMessages);
  const pctOfParent =
    breakdown.chars > 0 ? (addedChars / breakdown.chars) * 100 : null;
  const addedTokens =
    pctOfParent === null || breakdown.windowTokens === null
      ? null
      : Math.round((breakdown.windowTokens * pctOfParent) / 100);

  return { parentId, addedChars, addedTokens, pctOfParent };
};
