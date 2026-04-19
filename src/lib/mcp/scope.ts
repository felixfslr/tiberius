import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export type McpAuthExtra = {
  /** null = workspace key (any agent); string = agent-pinned key. */
  agent_id: string | null;
  key_id: string;
  key_name: string;
};

export function mcpAuthExtra(authInfo: AuthInfo | undefined): McpAuthExtra {
  const extra = authInfo?.extra as McpAuthExtra | undefined;
  if (!extra) throw new Error("mcp: missing auth context");
  return extra;
}

/**
 * Throws an `Error("forbidden: …")` if the authenticated key may not act on the
 * requested agent. Workspace keys (agent_id === null) pass for every agent;
 * agent-pinned keys must match exactly.
 */
export function assertAgentAccess(
  authInfo: AuthInfo | undefined,
  target_agent_id: string,
): void {
  const auth = mcpAuthExtra(authInfo);
  if (auth.agent_id !== null && auth.agent_id !== target_agent_id) {
    throw new Error(
      `forbidden: this API key is pinned to a different agent and cannot act on ${target_agent_id}`,
    );
  }
}

/** List of agent ids the key is allowed to see. null = no filter (workspace key). */
export function agentScopeFilter(
  authInfo: AuthInfo | undefined,
): string | null {
  return mcpAuthExtra(authInfo).agent_id;
}
