import { describe, expect, it } from "vitest";
import type { TGraphModel, TGraphNode, TNodeStatus } from "../../Graph.entity";
import { executionInterval } from "../execution/nodeInterval";
import {
  deriveExecutionLevels,
  type TExecutionLevel,
  type TExecutionPlan,
} from "../executionLevels";
import { deriveInvocationBatches } from "../invocations";
import { toParallelByNode } from "../parallelByNode";
import { deriveParallelGroups } from "../parallelism";

/**
 * Paridad **fila ↔ badge** (FR-008, SC-004; contrato `invocation-lanes-contract`
 * §3, criterio E5).
 *
 * Invariante bajo prueba: para **todo** nodo, el veredicto de su fila
 * (`level.parallel`) coincide con el de su badge de paralelismo
 * (`parallelByNode[id]`). Ambos deben salir de la **misma** fuente de lotes:
 * la invocación gana cuando existe y el solape de sesión es el respaldo.
 *
 * Contrato de inyección asumido (E4, T035/T037/T038):
 * los productores aceptan como **tercer argumento** los lotes derivados de las
 * invocaciones (`TInvocationBatch[]`), de modo que filas y badge se alimentan de
 * un único array. Sin invocaciones (tercer argumento vacío) ambos caen al
 * respaldo estructural (`deriveSiblingBatches`), sin regresión (FR-012).
 *
 * RED por diseño: `invocations.ts` no existe todavía y los productores aún no
 * aceptan los lotes; el spec queda como criterio de aceptación de E4.
 *
 * La paridad exigida es fila ↔ badge, **no** barra ↔ fila: la barra temporal del
 * nodo mantiene el intervalo de sesión (`executionInterval`). Esa diferencia es
 * intencional y queda fijada por el último caso de este archivo.
 */

const node = (
  id: string,
  startedAt: number | null,
  endedAt: number | null,
  parentId: string | null = null,
  status: TNodeStatus = "succeeded",
): TGraphNode => ({
  id,
  type: "agent",
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: id,
    createdAt: startedAt,
    updatedAt: endedAt,
    agentName: "general",
    directory: "/repo",
    model: null,
    status,
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: null,
      startedAt,
      endedAt,
      cost: null,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: parentId === null,
    currentTool: null,
    parallel: null,
  },
});

const model = (
  nodes: TGraphNode[],
  parentByChild: Record<string, string> = {},
): TGraphModel => ({
  nodes,
  edges: Object.entries(parentByChild).map(([target, source]) => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "agent" as const,
  })),
});

type TInvocationInput = Parameters<typeof deriveInvocationBatches>[0][number];
type TBatches = ReturnType<typeof deriveInvocationBatches>;

const invocation = (
  sessionId: string | null,
  stepId: string,
  startedAt: number,
  endedAt: number | null,
  toolName: TInvocationInput["toolName"] = "subagent",
): TInvocationInput => ({
  sessionId,
  stepId,
  startedAt,
  endedAt,
  status: "completed",
  toolName,
});

/** `now` posterior a todos los intervalos: las ventanas informativas quedan cerradas. */
const NOW = 10_000;

const rowOf = (plan: TExecutionPlan, id: string): TExecutionLevel | undefined =>
  plan.levels.find((level) => level.nodeIds.includes(id));

/**
 * Deriva filas y badge de la **misma** fuente de lotes y comprueba la paridad
 * nodo a nodo. Devuelve ambos artefactos para las aserciones específicas.
 */
const expectParity = (
  graph: TGraphModel,
  batches: TBatches,
): {
  plan: TExecutionPlan;
  badge: Record<string, { groupId: string; size: number }>;
} => {
  const plan = deriveExecutionLevels(graph, NOW, batches);
  const badge = toParallelByNode(deriveParallelGroups(graph, NOW, batches));

  for (const candidate of graph.nodes) {
    const rowParallel = rowOf(plan, candidate.id)?.parallel === true;
    const badgeParallel = (badge[candidate.id]?.size ?? 0) > 1;
    expect(rowParallel, `fila ↔ badge de ${candidate.id}`).toBe(badgeParallel);
  }

  return { plan, badge };
};

describe("paridad fila ↔ badge (FR-008)", () => {
  it("la invocación gana: mismo paso → misma fila y badge aunque las sesiones no solapen", () => {
    // El padre invoca `b` y `c` en el **mismo paso** con intervalos de sesión
    // disjuntos: el respaldo por solape los separaría; la invocación los une.
    const graph = model(
      [
        node("root", 0, 9_000),
        node("a", 0, 100, "root"),
        node("b", 500, 600, "root"),
        node("c", 800, 900, "root"),
      ],
      { a: "root", b: "root", c: "root" },
    );
    const batches = deriveInvocationBatches([
      invocation("a", "step-1", 0, 100),
      invocation("b", "step-2", 500, 600),
      invocation("c", "step-2", 800, 900),
    ]);

    const { plan, badge } = expectParity(graph, batches);

    // Fila: `b` y `c` comparten una única fila paralela; `a` corre en la suya.
    expect(plan.levelByNode.b).toBe(plan.levelByNode.c);
    expect(rowOf(plan, "b")?.parallel).toBe(true);
    expect(badge.b?.size).toBe(2);
    expect(badge.c?.size).toBe(2);
    expect(badge.b?.groupId).toBe(badge.c?.groupId);

    // La fila de `a` es su lote de un solo miembro: sin badge.
    expect(rowOf(plan, "a")?.parallel).toBe(false);
    expect(badge.a).toBeUndefined();

    // Ningún paso secuencial se fusionó: `a` no comparte fila con `b` ni con `c`.
    expect(plan.levelByNode.a).not.toBe(plan.levelByNode.b);
    expect(plan.levelByNode.a).not.toBe(plan.levelByNode.c);
  });

  it("una hija reutilizada en dos pasos aporta dos lotes y mantiene la paridad", () => {
    const graph = model(
      [
        node("root", 0, 9_000),
        node("a", 0, 150, "root"),
        node("b", 0, 140, "root"),
        node("c", 400, 500, "root"),
      ],
      { a: "root", b: "root", c: "root" },
    );
    const batches = deriveInvocationBatches([
      invocation("a", "step-1", 0, 150),
      invocation("b", "step-1", 0, 140),
      invocation("a", "step-2", 400, 500),
      invocation("c", "step-2", 400, 500),
    ]);

    // Dos pasos distintos ⇒ dos lotes con identidad propia (FR-007).
    expect(batches).toHaveLength(2);
    expect(new Set(batches.map((batch) => batch.stepId)).size).toBe(2);
    const [stepOne, stepTwo] = batches;
    expect(stepOne.sessionIds).toContain("a");
    expect(stepTwo.sessionIds).toContain("a");

    const { plan, badge } = expectParity(graph, batches);

    // El nodo `a` es único aunque participe en los dos lotes: su fila sigue
    // siendo paralela y su badge mantiene el tamaño de lote (FR-007/FR-008).
    expect(rowOf(plan, "a")?.parallel).toBe(true);
    expect(badge.a?.size).toBe(2);

    // `b` comparte lote con `a` en el paso 1, pero su carril queda con un solo
    // miembro (el paso 2 se llevó a `a`): aun así es paralelo porque el lote de
    // 2+ lo contiene entero. El carril se decide por **membresía al lote**, no
    // por el número de nodos del carril (paridad por construcción, E5).
    expect(rowOf(plan, "b")?.parallel).toBe(true);
    expect(badge.b?.size).toBe(2);

    // `b` no está en el mismo lote que `c`: pasos distintos no comparten fila.
    expect(plan.levelByNode.b).not.toBe(plan.levelByNode.c);
    expect(badge.b?.groupId).not.toBe(badge.c?.groupId);
  });

  it("sin invocaciones, el respaldo estructural mantiene la paridad (FR-012)", () => {
    // Padre sin mensajes: manda el solape de sesión de `deriveSiblingBatches`.
    const graph = model(
      [
        node("root", 0, 9_000),
        node("a", 0, 1_000, "root"),
        node("b", 100, 900, "root"),
        node("solo", 5_000, 6_000, "root"),
      ],
      { a: "root", b: "root", solo: "root" },
    );

    const { plan, badge } = expectParity(graph, []);

    expect(plan.levelByNode.a).toBe(plan.levelByNode.b);
    expect(rowOf(plan, "a")?.parallel).toBe(true);
    expect(badge.a?.size).toBe(2);
    expect(badge.b?.size).toBe(2);
    expect(rowOf(plan, "solo")?.parallel).toBe(false);
    expect(badge.solo).toBeUndefined();
  });

  it("el badge solo marca los lotes de 2+ invocaciones del mismo paso", () => {
    const graph = model(
      [
        node("root", 0, 9_000),
        node("a", 0, 100, "root"),
        node("b", 500, 600, "root"),
        node("c", 800, 900, "root"),
      ],
      { a: "root", b: "root", c: "root" },
    );
    const batches = deriveInvocationBatches([
      invocation("a", "step-1", 0, 100),
      invocation("b", "step-2", 500, 600),
      invocation("c", "step-2", 800, 900),
    ]);

    const expected = new Set(
      batches
        .filter((batch) => batch.sessionIds.length >= 2)
        .flatMap((batch) => batch.sessionIds),
    );
    const actual = new Set(
      deriveParallelGroups(graph, NOW, batches).flatMap(
        (group) => group.nodeIds,
      ),
    );

    expect(actual).toEqual(expected);
    expect(actual).toEqual(new Set(["b", "c"]));
  });

  it("documenta la no-paridad barra ↔ fila: la barra conserva el intervalo de sesión", () => {
    const graph = model(
      [
        node("root", 0, 9_000),
        node("b", 500, 600, "root"),
        node("c", 800, 900, "root"),
      ],
      { b: "root", c: "root" },
    );
    const batches = deriveInvocationBatches([
      invocation("b", "step-1", 500, 600),
      invocation("c", "step-1", 800, 900),
    ]);

    const { plan, badge } = expectParity(graph, batches);

    // Fila y badge dicen "paralelo"…
    expect(rowOf(plan, "b")?.parallel).toBe(true);
    expect(badge.c?.size).toBe(2);

    // …pero las barras temporales de los nodos no solapan: mantienen el
    // intervalo de sesión (diferencia intencional, no se unifica aquí).
    const bar = (id: string) =>
      executionInterval(
        graph.nodes.find((candidate) => candidate.id === id) as TGraphNode,
      );
    const [bStart, bEnd] = bar("b");
    const [cStart] = bar("c");
    expect(cStart).toBeGreaterThanOrEqual(bEnd);
    expect(bEnd).toBeGreaterThan(bStart);
  });
});
