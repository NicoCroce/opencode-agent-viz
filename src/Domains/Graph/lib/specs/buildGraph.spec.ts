import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  FormDetail,
  PermissionRequest,
  SessionInfo,
  SessionMessageAssistant,
  SessionStatus,
  V2Event,
} from "@opencode/client";
import type {
  TContentPart,
  TSessionMessage,
} from "@app/Infrastructure/Services/opencodeClient";
import type {
  TExecutionSignal,
  TGraphModel,
  TGraphNodeData,
} from "../../Graph.entity";
import { queryKeys } from "../../../queryKeys";
import { buildGraph, type BuildGraphInput } from "../buildGraph";
import { deriveMetrics } from "../deriveMetrics";
import { reduceEvent, type TQueryUpdate } from "../eventReducer";
import { toNodeStatus } from "../nodeStatus";
import { session as sessionFixture } from "./fixtures";

const emptyTokens = {
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
};

const session = (id: string, parentID?: string): SessionInfo => ({
  id,
  parentID,
  projectID: "proj",
  agent: parentID === undefined ? "develop" : "explore",
  cost: 0,
  tokens: emptyTokens,
  title: `tarea ${id}`,
  time: { created: 1, updated: 2 },
  location: { directory: "/repo" },
});

const assistant = (
  overrides: Partial<SessionMessageAssistant> = {},
): TSessionMessage => {
  const info: SessionMessageAssistant = {
    id: "msg_1",
    time: { created: 2, completed: 5 },
    type: "assistant",
    agent: "develop",
    model: { providerID: "opencode", id: "deepseek" },
    content: [],
    cost: 0.01,
    tokens: {
      input: 10,
      output: 5,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    ...overrides,
  };
  return { info, parts: info.content };
};

/** Parte de tool fallida, para ejercitar `hasError` sobre la última respuesta. */
const toolError = {
  type: "tool",
  id: "tool_1",
  name: "bash",
  state: {
    status: "error",
    input: {},
    error: { type: "unknown", message: "boom" },
  },
  time: { created: 1, completed: 2 },
} as unknown as SessionMessageAssistant["content"][number];

const signal = (
  overrides: Partial<TExecutionSignal> = {},
): TExecutionSignal => ({
  retry: null,
  compaction: null,
  outcome: null,
  interruptReason: null,
  ...overrides,
});

const form = (sessionID: string, state: FormDetail["state"]): FormDetail => ({
  id: `form_${sessionID}`,
  sessionID,
  title: "¿Continuar?",
  fields: [{ key: "continue", type: "string" }],
  state,
});

const permission = (sessionID: string): PermissionRequest => ({
  id: `perm_${sessionID}`,
  sessionID,
  action: "bash",
  resources: ["echo hi"],
});

const retryStatus: SessionStatus = {
  type: "retry",
  attempt: 2,
  message: "rate limited",
  next: 1_234,
};

const busyStatus: SessionStatus = { type: "busy" };
const idleStatus: SessionStatus = { type: "idle" };

const baseInput = (
  overrides: Partial<BuildGraphInput> = {},
): BuildGraphInput => ({
  sessions: [session("root")],
  statuses: {},
  agents: [],
  messages: { root: [assistant()] },
  permissions: [],
  signals: {},
  forms: [],
  inbox: [],
  now: 10,
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* Paridad campo a campo vs línea base (FR-007, SC-006, C6)            */
/* ------------------------------------------------------------------ */

/**
 * Reconstrucción de la implementación de **línea base** de `buildGraph` (HEAD
 * previo a esta feature, tarea T034). La refactorización de T008 movió la
 * derivación de `model`, `currentTool` y `lastAssistantErrored` a
 * `deriveMetricBase`; aquí se reproducen los helpers anteriores para contrastar
 * la paridad campo a campo (contrato de render §4). `deriveMetrics` (envoltorio
 * equivalente al de la línea base) y `toNodeStatus` (sin cambios) se reutilizan.
 * Es solo referencia de test: no toca la implementación.
 */
const baselineResolveModel = (
  messages: TSessionMessage[] | undefined,
): SessionMessageAssistant["model"] | null => {
  if (!messages) return null;
  for (const { info } of messages) {
    if (info.type === "assistant") return info.model;
  }
  return null;
};

const baselineHasError = (messages: TSessionMessage[] | undefined): boolean => {
  if (!messages) return false;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const { info, parts } = messages[index];
    if (info.type !== "assistant") continue;
    if (info.error) return true;
    return parts.some((p) => p.type === "tool" && p.state.status === "error");
  }
  return false;
};

const baselineCurrentTool = (
  messages: TSessionMessage[] | undefined,
): { name: string; state: string } | null => {
  if (!messages) return null;
  let found: { name: string; state: string } | null = null;
  for (const { parts } of messages) {
    for (const part of parts) {
      if (part.type !== "tool") continue;
      found = { name: part.name, state: part.state.status };
    }
  }
  return found;
};

const baselineBuildGraph = (input: BuildGraphInput): TGraphModel => {
  const {
    sessions,
    statuses,
    agents,
    messages,
    permissions,
    signals,
    forms,
    now,
  } = input;

  const nodes = sessions.map((session) => {
    const sessionMessages = messages[session.id];
    const sessionStatus = statuses[session.id];
    const signal = signals[session.id];

    const agentName =
      session.agent ?? (session.parentID === undefined ? "root" : "subagent");
    const agent = agents.find((a) => a.id === agentName);

    const metrics = deriveMetrics({
      messages: sessionMessages ?? [],
      status: sessionStatus,
      now,
    });

    const status = toNodeStatus({
      status: sessionStatus,
      hasActivity: (sessionMessages?.length ?? 0) > 0,
      hasPermission: permissions.some((p) => p.sessionID === session.id),
      hasPendingForm: forms.some(
        (form) =>
          form.sessionID === session.id && form.state.status === "pending",
      ),
      compaction: signal?.compaction ?? null,
      outcome: signal?.outcome ?? null,
      lastAssistantErrored: baselineHasError(sessionMessages),
    });

    return {
      id: session.id,
      type: "agent" as const,
      position: { x: 0, y: 0 },
      data: {
        sessionId: session.id,
        title: session.title ?? null,
        createdAt: session.time.created,
        updatedAt: session.time.idle ?? session.time.updated,
        agentName,
        directory: session.location.directory,
        model: baselineResolveModel(sessionMessages) ?? agent?.model ?? null,
        status,
        retry:
          status === "retrying"
            ? (signal?.retry ??
              (sessionStatus?.type === "retry"
                ? { attempt: sessionStatus.attempt, next: sessionStatus.next }
                : null))
            : null,
        interruptReason:
          status === "interrupted" ? (signal?.interruptReason ?? null) : null,
        metrics,
        isRoot: session.parentID === undefined,
        currentTool: baselineCurrentTool(sessionMessages),
        parallel: null,
      },
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = sessions
    .filter((s) => s.parentID !== undefined && nodeIds.has(s.parentID))
    .map((s) => ({
      id: `${s.parentID}->${s.id}`,
      source: s.parentID as string,
      target: s.id,
      type: "agent" as const,
    }));

  return { nodes, edges };
};

/** `TGraphNodeData` sin el campo de vista `enrichment` (excluido del contraste). */
const stripEnrichment = (
  data: TGraphNodeData,
): Omit<TGraphNodeData, "enrichment"> => {
  const copy = { ...data };
  delete copy.enrichment;
  return copy;
};

/**
 * Contraste campo a campo (FR-007, SC-006, criterio C6): con todos los nodos en
 * `enrichment === 'ready'`, el `TGraphModel` que produce `buildGraph` debe ser
 * igual al de la línea base, excluyendo `enrichment`. Solo participan los nodos
 * `ready`; los provisionales de la fase de estructura quedan fuera (data-model
 * §2.2).
 */
const expectFieldParity = (input: BuildGraphInput): void => {
  const current = buildGraph({ ...input, enrichment: "ready" });
  const baseline = baselineBuildGraph(input);

  const ready = current.nodes.filter((node) => node.data.enrichment === "ready");
  expect(ready).toHaveLength(current.nodes.length);
  expect(
    ready.map((node) => ({ ...node, data: stripEnrichment(node.data) })),
  ).toEqual(baseline.nodes);
  expect(current.edges).toEqual(baseline.edges);
};

/* ------------------------------------------------------------------ */
/* Fixtures representativas (`run.ndjson` V1 y `run.v2.ndjson` V2)     */
/* ------------------------------------------------------------------ */

const FIXTURES_DIR = join(process.cwd(), "src/Domains/Graph/lib/__fixtures__");

/** Lee y parsea un NDJSON versionado como fixture. */
const readFixture = <T>(file: string): T[] =>
  readFileSync(join(FIXTURES_DIR, file), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);

/** `true` si el update es un `set` dirigido exactamente a `key`. */
const isSetFor = (
  update: TQueryUpdate,
  key: readonly unknown[],
): update is Extract<TQueryUpdate, { kind: "set" }> =>
  update.kind === "set" &&
  update.queryKey.length === key.length &&
  update.queryKey.every((value, index) => value === key[index]);

/** Aplica a `initial` solo los updates `set` dirigidos a `key` (como el flush en vivo). */
const reduceCache = <T>(
  events: V2Event[],
  key: readonly unknown[],
  initial: T,
): T =>
  events.reduce<T>((cache, event) => {
    const updates = reduceEvent(event) ?? [];
    return updates.reduce<T>(
      (acc, update) =>
        isSetFor(update, key) ? (update.updater(acc) as T) : acc,
      cache,
    );
  }, initial);

const RUN_V2_SESSION_ID = "ses_root";

/** `SessionInfo` mínimo de la corrida de `develop` re-capturada en `run.v2.ndjson`. */
const RUN_V2_SESSION: SessionInfo = {
  id: RUN_V2_SESSION_ID,
  projectID: "proj",
  agent: "develop",
  cost: 0.0123,
  tokens: {
    input: 1200,
    output: 300,
    reasoning: 120,
    cache: { read: 400, write: 50 },
  },
  time: { created: 1000, updated: 1200, idle: 1200 },
  title: "develop",
  location: { directory: "/repo" },
};

/**
 * Deriva el `BuildGraphInput` de `run.v2.ndjson` reduciendo sus eventos con el
 * mismo `eventReducer` que aplica el `EventStreamProvider` en producción.
 */
const buildRunV2Input = (): BuildGraphInput => {
  const events = readFixture<V2Event>("run.v2.ndjson");
  return {
    sessions: [RUN_V2_SESSION],
    statuses: reduceCache<Record<string, SessionStatus>>(
      events,
      queryKeys.sessions.status(),
      {},
    ),
    agents: [],
    messages: {
      [RUN_V2_SESSION_ID]: reduceCache<TSessionMessage[]>(
        events,
        queryKeys.sessions.messages(RUN_V2_SESSION_ID),
        [],
      ),
    },
    permissions: [],
    signals: reduceCache<Record<string, TExecutionSignal>>(
      events,
      queryKeys.sessions.execution(RUN_V2_SESSION_ID),
      {},
    ),
    forms: [],
    inbox: [],
    now: 1200,
  };
};

/**
 * Eventos V1 del fixture `run.ndjson` (forma `{ type, properties }`). V2 ya no
 * emite esta forma; se normaliza aquí solo para el contraste de paridad, porque
 * es la única captura V1 versionada.
 */
interface TV1SessionCreated {
  type: "session.created";
  properties: {
    info: {
      id: string;
      parentID?: string;
      projectID: string;
      title?: string;
      directory: string;
      time: { created: number; updated: number };
    };
  };
}

interface TV1SessionStatus {
  type: "session.status";
  properties: { sessionID: string; status: SessionStatus };
}

interface TV1SessionIdle {
  type: "session.idle";
  properties: { sessionID: string };
}

interface TV1MessageUpdated {
  type: "message.updated";
  properties: {
    info: {
      id: string;
      sessionID: string;
      role: "user" | "assistant";
      time: { created: number; completed?: number };
      providerID?: string;
      modelID?: string;
      cost?: number;
      tokens?: SessionMessageAssistant["tokens"];
    };
  };
}

interface TV1ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  tool: string;
  state: {
    status: string;
    input?: Record<string, unknown>;
    output?: string;
    error?: { data?: { message?: string }; message?: string };
    metadata?: Record<string, unknown>;
    time?: { start?: number; end?: number };
  };
}

interface TV1RetryPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "retry";
  attempt: number;
  error: { data?: { message?: string }; message?: string };
  time: { created: number };
}

interface TV1MessagePartUpdated {
  type: "message.part.updated";
  properties: { part: TV1ToolPart | TV1RetryPart };
}

interface TV1PermissionUpdated {
  type: "permission.updated";
  properties: PermissionRequest;
}

interface TV1PermissionReplied {
  type: "permission.replied";
  properties: { permissionID: string };
}

type TV1Event =
  | TV1SessionCreated
  | TV1SessionStatus
  | TV1SessionIdle
  | TV1MessageUpdated
  | TV1MessagePartUpdated
  | TV1PermissionUpdated
  | TV1PermissionReplied;

const v1ErrorMessage = (
  error: { data?: { message?: string }; message?: string } | undefined,
): string => error?.data?.message ?? error?.message ?? "";

/** Normaliza una parte de tool V1 a la forma `TContentPart` de V2. */
const v1ToolPart = (part: TV1ToolPart): TContentPart => {
  const time = {
    created: part.state.time?.start ?? 0,
    completed: part.state.time?.end,
  };
  if (part.state.status === "error") {
    return {
      type: "tool",
      id: part.id,
      name: part.tool,
      state: {
        status: "error",
        input: part.state.input ?? {},
        error: { type: "unknown", message: v1ErrorMessage(part.state.error) },
      },
      time,
    } as unknown as TContentPart;
  }
  return {
    type: "tool",
    id: part.id,
    name: part.tool,
    state: {
      status: "completed",
      input: part.state.input ?? {},
      content: [{ type: "text", text: part.state.output ?? "" }],
      metadata: part.state.metadata ?? {},
    },
    time,
  } as unknown as TContentPart;
};

/**
 * Deriva el `BuildGraphInput` de `run.ndjson` (fixture V1 con
 * `message.updated`/`message.part.updated`): sesiones, estados, mensajes con
 * tool/retry y permisos. La respuesta a `permission.replied` elimina el permiso,
 * igual que el reducer de producción.
 */
const buildRunV1Input = (): BuildGraphInput => {
  const events = readFixture<TV1Event>("run.ndjson");
  const sessions: SessionInfo[] = [];
  const statuses: Record<string, SessionStatus> = {};
  const messages: Record<string, TSessionMessage[]> = {};
  const permissions: PermissionRequest[] = [];

  for (const event of events) {
    switch (event.type) {
      case "session.created": {
        const info = event.properties.info;
        sessions.push(
          sessionFixture(info.id, {
            parentID: info.parentID,
            projectID: info.projectID,
            title: info.title,
            agent: undefined,
            time: { created: info.time.created, updated: info.time.updated },
            location: { directory: info.directory },
          }),
        );
        break;
      }
      case "session.status":
        statuses[event.properties.sessionID] = event.properties.status;
        break;
      case "session.idle":
        statuses[event.properties.sessionID] = { type: "idle" };
        break;
      case "message.updated": {
        const info = event.properties.info;
        const list = messages[info.sessionID] ?? [];
        if (info.role === "assistant") {
          const content: SessionMessageAssistant["content"] = [];
          list.push({
            info: {
              id: info.id,
              type: "assistant",
              time: {
                created: info.time.created,
                completed: info.time.completed,
              },
              agent: "develop",
              model: {
                providerID: info.providerID ?? "",
                id: info.modelID ?? "",
              },
              content,
              cost: info.cost,
              tokens: info.tokens,
            },
            parts: content,
          });
        } else {
          list.push({
            info: { id: info.id, type: "user", time: info.time, text: "" },
            parts: [],
          });
        }
        messages[info.sessionID] = list;
        break;
      }
      case "message.part.updated": {
        const part = event.properties.part;
        const list = messages[part.sessionID] ?? [];
        const message = list.find((m) => m.info.id === part.messageID);
        if (!message) break;
        const info = message.info;
        if (info.type !== "assistant") break;
        if (part.type === "tool") {
          message.parts.push(v1ToolPart(part));
        } else {
          info.retry = {
            attempt: part.attempt,
            at: part.time.created,
            error: { type: "api", message: v1ErrorMessage(part.error) },
          };
        }
        break;
      }
      case "permission.updated":
        permissions.push(event.properties);
        break;
      case "permission.replied": {
        const id = event.properties.permissionID;
        const index = permissions.findIndex((p) => p.id === id);
        if (index >= 0) permissions.splice(index, 1);
        break;
      }
      default:
        break;
    }
  }

  return {
    sessions,
    statuses,
    agents: [],
    messages,
    permissions,
    signals: {},
    forms: [],
    inbox: [],
    now: 2_000,
  };
};

describe("buildGraph", () => {
  it("creates one node per session and an edge per parent relation", () => {
    const graph = buildGraph(
      baseInput({
        sessions: [session("root"), session("child", "root")],
        messages: {
          root: [assistant()],
          child: [assistant({ agent: "explore" })],
        },
      }),
    );
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["child", "root"]);
    expect(graph.edges).toEqual([
      { id: "root->child", source: "root", target: "child", type: "agent" },
    ]);
    expect(graph.nodes.find((n) => n.id === "child")?.data.agentName).toBe(
      "explore",
    );
    expect(graph.nodes.find((n) => n.id === "child")?.data.title).toBe(
      "tarea child",
    );
    expect(graph.nodes.find((n) => n.id === "root")?.data.isRoot).toBe(true);
  });

  it("leaves title null when the session reports no title", () => {
    const graph = buildGraph(
      baseInput({ sessions: [{ ...session("root"), title: undefined }] }),
    );
    expect(graph.nodes[0].data.title).toBeNull();
  });

  it("handles a session with no subagents as a single root node", () => {
    const graph = buildGraph(baseInput());
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes[0].data.agentName).toBe("develop");
  });

  it("derives model and metrics from assistant messages", () => {
    const graph = buildGraph(baseInput());
    expect(graph.nodes[0].data.model).toEqual({
      providerID: "opencode",
      id: "deepseek",
    });
    expect(graph.nodes[0].data.metrics.durationMs).toBe(3);
    expect(graph.nodes[0].data.metrics.cost).toBeCloseTo(0.01, 5);
  });

  describe("FR-021 — created vs succeeded", () => {
    it("marks created when the session has no activity", () => {
      const graph = buildGraph(baseInput({ messages: { root: [] } }));
      expect(graph.nodes[0].data.status).toBe("created");
    });

    it("marks succeeded once there is activity and no terminal signal", () => {
      const graph = buildGraph(baseInput());
      expect(graph.nodes[0].data.status).toBe("succeeded");
    });
  });

  describe("estados activos", () => {
    it("reflects running status from a busy session", () => {
      const graph = buildGraph(baseInput({ statuses: { root: busyStatus } }));
      expect(graph.nodes[0].data.status).toBe("running");
    });

    it("retrying: propagates the retry attempt and next moment (FR-018)", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: retryStatus },
          signals: { root: signal({ retry: { attempt: 2, next: 1_234 } }) },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("retrying");
      expect(graph.nodes[0].data.retry).toEqual({ attempt: 2, next: 1_234 });
    });

    it("retrying: falls back to SessionStatus when the signal has no retry", () => {
      const graph = buildGraph(baseInput({ statuses: { root: retryStatus } }));
      expect(graph.nodes[0].data.retry).toEqual({ attempt: 2, next: 1_234 });
    });

    it("does not expose retry once the execution is no longer retrying", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: idleStatus },
          signals: { root: signal({ retry: { attempt: 1, next: 10 } }) },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("succeeded");
      expect(graph.nodes[0].data.retry).toBeNull();
    });

    it("compacting: compaction running wins over outcome", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: busyStatus },
          signals: {
            root: signal({ compaction: "running", outcome: "failed" }),
          },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("compacting");
    });

    it("waiting-input: a pending form marks the wait (FR-032)", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: busyStatus },
          forms: [form("root", { status: "pending" })],
        }),
      );
      expect(graph.nodes[0].data.status).toBe("waiting-input");
    });

    it("waiting-input: an answered/cancelled form does not wait", () => {
      const answered = buildGraph(
        baseInput({
          forms: [form("root", { status: "answered", answer: {} })],
        }),
      );
      expect(answered.nodes[0].data.status).toBe("succeeded");

      const cancelled = buildGraph(
        baseInput({ forms: [form("root", { status: "cancelled" })] }),
      );
      expect(cancelled.nodes[0].data.status).toBe("succeeded");
    });

    it("waiting-permission: a pending permission wins over running", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: busyStatus },
          permissions: [permission("root")],
        }),
      );
      expect(graph.nodes[0].data.status).toBe("waiting-permission");
    });

    it("waiting-permission: keeps waiting when the session is idle", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: idleStatus },
          permissions: [permission("root")],
        }),
      );
      expect(graph.nodes[0].data.status).toBe("waiting-permission");
    });
  });

  describe("resultado terminal (outcome)", () => {
    it("outcome succeeded wins over busy", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: busyStatus },
          signals: { root: signal({ outcome: "succeeded" }) },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("succeeded");
    });

    it("outcome failed marks the execution as failed", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: idleStatus },
          signals: { root: signal({ outcome: "failed" }) },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("failed");
    });

    it("outcome interrupted is distinct from failed and keeps its reason (FR-019)", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: idleStatus },
          signals: {
            root: signal({
              outcome: "interrupted",
              interruptReason: "user aborted",
            }),
          },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("interrupted");
      expect(graph.nodes[0].data.interruptReason).toBe("user aborted");
    });

    it('interrupted without a reason reports null → "no disponible"', () => {
      const graph = buildGraph(
        baseInput({ signals: { root: signal({ outcome: "interrupted" }) } }),
      );
      expect(graph.nodes[0].data.status).toBe("interrupted");
      expect(graph.nodes[0].data.interruptReason).toBeNull();
    });

    it("does not expose interruptReason outside interrupted", () => {
      const graph = buildGraph(
        baseInput({
          signals: { root: signal({ interruptReason: "stale" }) },
        }),
      );
      expect(graph.nodes[0].data.interruptReason).toBeNull();
    });
  });

  describe("FR-020 — un error superado no tiñe el estado", () => {
    it("busy with a previous error keeps running, not failed", () => {
      const graph = buildGraph(
        baseInput({
          statuses: { root: busyStatus },
          messages: {
            root: [assistant({ error: { type: "api", message: "boom" } })],
          },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("running");
    });

    it("a succeeded outcome stays succeeded despite a previous error", () => {
      const graph = buildGraph(
        baseInput({
          messages: {
            root: [assistant({ error: { type: "api", message: "boom" } })],
          },
          signals: { root: signal({ outcome: "succeeded" }) },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("succeeded");
    });

    it("a previous error only marks failed without an outcome or active state", () => {
      const graph = buildGraph(
        baseInput({
          messages: {
            root: [assistant({ error: { type: "api", message: "boom" } })],
          },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("failed");
    });

    it("un error viejo no tiñe si la última respuesta assistant está limpia", () => {
      const graph = buildGraph(
        baseInput({
          messages: {
            root: [
              assistant({ error: { type: "api", message: "boom" } }),
              assistant({ id: "msg_2" }),
            ],
          },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("succeeded");
    });

    it("un tool fallido en la última respuesta sí marca failed", () => {
      const graph = buildGraph(
        baseInput({
          messages: { root: [assistant({ content: [toolError] })] },
        }),
      );
      expect(graph.nodes[0].data.status).toBe("failed");
    });
  });

  describe("enrichment", () => {
    it("defaults to ready to preserve the current parity (FR-007)", () => {
      const graph = buildGraph(baseInput());
      expect(graph.nodes[0].data.enrichment).toBe("ready");
    });

    it("propagates pending from the structural phase", () => {
      const graph = buildGraph(baseInput({ enrichment: "pending" }));
      expect(graph.nodes[0].data.enrichment).toBe("pending");
    });

    it("propagates an explicit ready from the enrichment phase", () => {
      const graph = buildGraph(baseInput({ enrichment: "ready" }));
      expect(graph.nodes[0].data.enrichment).toBe("ready");
    });

    it("marks every node of the subgraph with the same state", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [session("root"), session("child", "root")],
          messages: {
            root: [assistant()],
            child: [assistant({ agent: "explore" })],
          },
          enrichment: "pending",
        }),
      );
      expect(graph.nodes.map((node) => node.data.enrichment)).toEqual([
        "pending",
        "pending",
      ]);
    });

    it("keeps the business fields unchanged (enrichment is view-only)", () => {
      const withoutEnrichment = (
        data: TGraphNodeData,
      ): Omit<TGraphNodeData, "enrichment"> => {
        const copy = { ...data };
        delete copy.enrichment;
        return copy;
      };

      const pending = buildGraph(baseInput({ enrichment: "pending" }));
      const ready = buildGraph(baseInput({ enrichment: "ready" }));

      expect(withoutEnrichment(pending.nodes[0].data)).toEqual(
        withoutEnrichment(ready.nodes[0].data),
      );
    });
  });

  describe("paridad campo a campo vs línea base (FR-007, SC-006, C6)", () => {
    it("run.ndjson: conserva campo a campo el modelo de la línea base", () => {
      const input = buildRunV1Input();
      // Fixture representativa: dos sesiones (raíz + subagente), con tool y retry.
      expect(input.sessions.map((s) => s.id)).toEqual(["ses_root", "ses_child"]);
      expect(input.messages["ses_root"]).toHaveLength(2);
      expect(input.messages["ses_child"]).toHaveLength(2);
      expect(input.permissions).toHaveLength(0);

      expectFieldParity(input);
    });

    it("run.v2.ndjson: conserva campo a campo el modelo de la línea base", () => {
      const input = buildRunV2Input();
      // La re-captura V2 representa una sola corrida en `ses_root`.
      expect(input.sessions.map((s) => s.id)).toEqual(["ses_root"]);
      expect(input.messages["ses_root"]?.length).toBeGreaterThan(0);

      expectFieldParity(input);
    });

    it("solo los nodos enrichment === 'ready' participan del contraste", () => {
      const input = buildRunV2Input();
      const structural = buildGraph({ ...input, enrichment: "pending" });

      // La fase de estructura marca todos los nodos `pending`: ninguno es
      // candidato de paridad mientras no se enriquezca (data-model §2.2).
      expect(structural.nodes.every((n) => n.data.enrichment === "pending")).toBe(
        true,
      );
      expect(
        structural.nodes.filter((n) => n.data.enrichment === "ready"),
      ).toHaveLength(0);
    });

    it("excluye enrichment del contraste (solo difiere el estado de vista)", () => {
      const input = buildRunV1Input();
      const ready = buildGraph({ ...input, enrichment: "ready" });

      // `enrichment` es el único campo que la comparación no considera: al
      // quitarlo, los nodos enriquecidos coinciden con la línea base.
      const stripped = ready.nodes.map((node) => stripEnrichment(node.data));
      expect(stripped.every((data) => !("enrichment" in data))).toBe(true);
      expect(stripped).toEqual(
        baselineBuildGraph(input).nodes.map((node) => node.data),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* A4 — updatedAt fresco por marca de actividad (FR-009)               */
  /* ------------------------------------------------------------------ */

  /**
   * `updatedAt` del nodo = `max(session.time.idle ?? session.time.updated ?? 0,
   * activity[session.id] ?? 0)`; `null` cuando ese máximo queda en `0`
   * (contract session-activity §4, data-model §1.1). La entrada `activity`
   * (`TActivityMap`) se propaga por `buildGraph` hasta `toGraphNode` (T018/T019).
   */
  const sessionWithTime = (id: string, time: SessionInfo["time"]): SessionInfo => ({
    ...session(id),
    time,
  });

  describe("FR-009 — updatedAt = max(lista, marca de actividad) (A4)", () => {
    it("toma la marca de actividad cuando es más nueva que la lista", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [
            sessionWithTime("root", { created: 1, updated: 100, idle: 100 }),
          ],
          activity: { root: 250 },
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBe(250);
    });

    it("cae a time.updated sin idle y la actividad gana", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [sessionWithTime("root", { created: 1, updated: 100 })],
          activity: { root: 175 },
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBe(175);
    });

    it("nunca retrocede la marca de la lista cuando la actividad es anterior", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [
            sessionWithTime("root", { created: 1, updated: 100, idle: 100 }),
          ],
          activity: { root: 40 },
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBe(100);
    });

    it("prefiere time.idle sobre time.updated cuando ambos existen", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [
            sessionWithTime("root", { created: 1, updated: 50, idle: 100 }),
          ],
          activity: { root: 40 },
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBe(100);
    });

    it("ignora la marca de actividad de otras sesiones", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [
            sessionWithTime("root", { created: 1, updated: 100, idle: 100 }),
          ],
          activity: { other: 999 },
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBe(100);
    });

    it("devuelve null cuando la lista y la actividad son ambas 0", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [sessionWithTime("root", { created: 1, updated: 0 })],
          activity: { root: 0 },
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBeNull();
    });

    it("devuelve null sin activity cuando la marca de la lista es 0", () => {
      const graph = buildGraph(
        baseInput({
          sessions: [sessionWithTime("root", { created: 1, updated: 0 })],
        }),
      );
      expect(graph.nodes[0].data.updatedAt).toBeNull();
    });

    describe("compatibilidad sin activity", () => {
      it("conserva updatedAt = time.idle ?? time.updated al omitir activity", () => {
        const graph = buildGraph(
          baseInput({
            sessions: [
              sessionWithTime("root", { created: 1, updated: 50, idle: 100 }),
            ],
          }),
        );
        expect(graph.nodes[0].data.updatedAt).toBe(100);
      });

      it("cae a time.updated sin idle al omitir activity", () => {
        const graph = buildGraph(
          baseInput({
            sessions: [sessionWithTime("root", { created: 1, updated: 100 })],
          }),
        );
        expect(graph.nodes[0].data.updatedAt).toBe(100);
      });
    });
  });
});
