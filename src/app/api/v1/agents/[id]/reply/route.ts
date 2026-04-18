import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { ReplyRequestSchema } from "@/lib/schemas/reply";
import { draftReply } from "@/lib/services/replies";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = ReplyRequestSchema.parse(await req.json());
    const result = await draftReply(id, body);
    // For external callers (api-key scope), return the public subset only.
    if (auth.scope === "api-key") {
      const {
        retrieved_chunks: _rc,
        prompt_preview: _pp,
        ...publicOnly
      } = result;
      return ok(publicOnly);
    }
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Agent not found") return err("not_found", msg, 404);
    return handleUnknown(e);
  }
}
