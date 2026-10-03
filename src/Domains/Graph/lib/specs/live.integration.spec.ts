import { describe, expect, it } from 'vitest';
import { OpenCode } from '@opencode/client';
import { buildGraph } from '../buildGraph';

const API = process.env.VIZ_API_URL ?? 'http://127.0.0.1:4096';
const password = process.env.OPENCODE_PASSWORD;

/**
 * El server V2 exige HTTP Basic, así que esta integración solo corre cuando se
 * provee `OPENCODE_PASSWORD` (por ejemplo `OPENCODE_PASSWORD=... pnpm test`).
 * En el run normal queda saltada.
 */
const maybe = password ? describe : describe.skip;

maybe('live OpenCode server integration', () => {
  const authorization = `Basic ${Buffer.from(`opencode:${password ?? ''}`).toString(
    'base64',
  )}`;
  const client = OpenCode.make({
    baseUrl: API,
    headers: { authorization },
  });

  it('derives a graph that mirrors the server sessions', async () => {
    const response = await client.session.list({ limit: 50 });
    const sessions = response.data;

    const graph = buildGraph({
      sessions,
      statuses: {},
      agents: [],
      messages: {},
      permissions: [],
      now: Date.now(),
    });

    expect(graph.nodes).toHaveLength(sessions.length);
    for (const node of graph.nodes) {
      expect(node.data.agentName.length).toBeGreaterThan(0);
    }
  }, 30000);
});
