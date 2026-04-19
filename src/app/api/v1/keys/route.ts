import { NextRequest } from "next/server";
import { z } from "zod";
import { createKey, listWorkspaceKeys } from "@/lib/services/keys";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authenticate } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

const CreateSchema = z.object({ name: z.string().min(1).max(120) });

/**
 * Workspace-scope API keys. Used by MCP clients (Claude Desktop, ChatGPT) that
 * need one connector spanning every agent in the workspace. The created key
 * has `agent_id = NULL` and passes `authorizeForAgent()` for any agent.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("unauthenticated", "Sign in required", 401);
  if (auth.scope === "api-key") {
    return err("forbidden", "Use the UI to manage keys", 403);
  }
  try {
    return ok(await listWorkspaceKeys());
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("unauthenticated", "Sign in required", 401);
  if (auth.scope === "api-key") {
    return err("forbidden", "Use the UI to create keys", 403);
  }
  try {
    const { name } = CreateSchema.parse(await req.json());
    const key = await createKey(null, name);
    return ok(key, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
