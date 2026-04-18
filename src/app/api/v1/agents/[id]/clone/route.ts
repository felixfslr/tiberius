import { NextRequest } from "next/server";
import { cloneAgent } from "@/lib/services/agents";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  if (auth.scope === "api-key") {
    return err("forbidden", "API keys cannot clone agents", 403);
  }
  try {
    const cloned = await cloneAgent(id);
    return ok(cloned, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
