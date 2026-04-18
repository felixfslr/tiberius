import { NextRequest } from "next/server";
import {
  deleteAgent,
  getAgent,
  updateAgent,
} from "@/lib/services/agents";
import { AgentPatchSchema } from "@/lib/schemas/agent";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const agent = await getAgent(id);
    if (!agent) return err("not_found", "Agent not found", 404);
    return ok(agent);
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = AgentPatchSchema.parse(await req.json());
    const agent = await updateAgent(id, body);
    return ok(agent);
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  if (auth.scope === "api-key") {
    return err("forbidden", "API keys cannot delete agents", 403);
  }
  try {
    await deleteAgent(id);
    return ok({ deleted: true });
  } catch (e) {
    return handleUnknown(e);
  }
}
