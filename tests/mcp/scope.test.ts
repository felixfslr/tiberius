import { describe, expect, it } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  agentScopeFilter,
  assertAgentAccess,
  type McpAuthExtra,
} from "@/lib/mcp/scope";

function auth(agent_id: string | null): AuthInfo {
  const extra: McpAuthExtra = {
    agent_id,
    key_id: "k1",
    key_name: "test",
  };
  return {
    token: "tib_test",
    clientId: "k1",
    scopes: agent_id === null ? ["workspace"] : ["agent"],
    extra: extra as unknown as Record<string, unknown>,
  };
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("assertAgentAccess", () => {
  it("workspace key can act on any agent", () => {
    expect(() => assertAgentAccess(auth(null), A)).not.toThrow();
    expect(() => assertAgentAccess(auth(null), B)).not.toThrow();
  });

  it("agent-pinned key succeeds when agent_id matches", () => {
    expect(() => assertAgentAccess(auth(A), A)).not.toThrow();
  });

  it("agent-pinned key is rejected for a different agent", () => {
    expect(() => assertAgentAccess(auth(A), B)).toThrow(/forbidden/);
  });

  it("throws when no auth context is present", () => {
    expect(() => assertAgentAccess(undefined, A)).toThrow(/missing auth/);
  });
});

describe("agentScopeFilter", () => {
  it("returns null for workspace keys", () => {
    expect(agentScopeFilter(auth(null))).toBeNull();
  });

  it("returns the pinned agent id for agent keys", () => {
    expect(agentScopeFilter(auth(A))).toBe(A);
  });
});
