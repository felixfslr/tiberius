import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import { verifyApiKey } from "@/lib/auth/api-key";
import { registerTools } from "@/lib/mcp/tools";
import type { McpAuthExtra } from "@/lib/mcp/scope";

/**
 * Tiberius MCP server — Streamable HTTP transport.
 *
 * Mounted at `/api/mcp`. Authentication is the same bearer-token API key
 * (`Authorization: Bearer tib_…`) that the REST API accepts. Keys can be
 * agent-pinned (see only their agent) or workspace-scope (see every agent).
 */

const base = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    serverInfo: { name: "tiberius", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 300,
    // SSE is deprecated in the MCP spec; we only expose Streamable HTTP.
    disableSse: true,
  },
);

const handler = withMcpAuth(
  base,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    // Re-wrap the bearer into a Request shape verifyApiKey understands.
    const probe = new Request("https://mcp.local/", {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    const auth = await verifyApiKey(probe);
    if (!auth) return undefined;
    const extra: McpAuthExtra = {
      agent_id: auth.agent_id,
      key_id: auth.key_id,
      key_name: auth.key_name,
    };
    const info: AuthInfo = {
      token: bearerToken,
      clientId: auth.key_id,
      scopes: auth.agent_id === null ? ["workspace"] : ["agent"],
      extra: extra as unknown as Record<string, unknown>,
    };
    return info;
  },
  { required: true },
);

export { handler as GET, handler as POST, handler as DELETE };
export const runtime = "nodejs";
export const maxDuration = 300;
