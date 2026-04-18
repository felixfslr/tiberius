import { NextRequest } from "next/server";
import { listAgents, createAgent } from "@/lib/services/agents";
import { AgentCreateSchema } from "@/lib/schemas/agent";
import { ok, handleUnknown, err } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await authorizeForAgent(req);
  if (auth instanceof Response) return auth;
  try {
    const agents = await listAgents();
    // API-key scope: only expose the one agent the key belongs to.
    if (auth.scope === "api-key") {
      return ok(agents.filter((a) => a.id === auth.apiKey.agent_id));
    }
    return ok(agents);
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeForAgent(req);
  if (auth instanceof Response) return auth;
  if (auth.scope === "api-key") {
    return err("forbidden", "API keys cannot create agents", 403);
  }
  try {
    const body = AgentCreateSchema.parse(await req.json());
    const agent = await createAgent(body);
    return ok(agent, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
