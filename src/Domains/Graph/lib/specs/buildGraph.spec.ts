import { describe, expect, it } from "vitest";
import type {
  FormDetail,
  PermissionRequest,
  SessionInfo,
  SessionMessageAssistant,
  SessionStatus,
} from "@opencode/client";
import type { TSessionMessage } from "@app/Infrastructure/Services/opencodeClient";
import type { TExecutionSignal } from "../../Graph.entity";
import { buildGraph, type BuildGraphInput } from "../buildGraph";

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
});
