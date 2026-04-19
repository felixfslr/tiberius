import { NextRequest } from "next/server";
import { verifyApiKey, type ApiKeyAuth } from "./api-key";
import { currentUser, type SessionUser } from "./session";
import { err } from "@/lib/api/response";

export type AuthContext =
  | { scope: "api-key"; apiKey: ApiKeyAuth }
  | { scope: "session"; user: SessionUser };

export async function authenticate(
  req: NextRequest,
): Promise<AuthContext | null> {
  // Prefer API-key if a bearer is present (external callers).
  const byKey = await verifyApiKey(req);
  if (byKey) return { scope: "api-key", apiKey: byKey };
  const user = await currentUser();
  if (user) return { scope: "session", user };
  return null;
}

/**
 * If `agent_id` is provided and the auth is an API key, the key must be scoped
 * to that agent. Session-scope auth can see any agent (single-workspace MVP).
 */
export async function authorizeForAgent(
  req: NextRequest,
  agent_id?: string,
): Promise<AuthContext | Response> {
  const ctx = await authenticate(req);
  if (!ctx)
    return err("unauthenticated", "Missing or invalid credentials", 401);
  if (
    agent_id &&
    ctx.scope === "api-key" &&
    ctx.apiKey.agent_id !== null &&
    ctx.apiKey.agent_id !== agent_id
  ) {
    return err("forbidden", "API key is not scoped to this agent", 403);
  }
  return ctx;
}
