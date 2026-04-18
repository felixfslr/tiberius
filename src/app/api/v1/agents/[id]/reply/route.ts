import { NextRequest, NextResponse } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { ReplyRequestSchema } from "@/lib/schemas/reply";
import { draftReply } from "@/lib/services/replies";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

type Params = { params: Promise<{ id: string }> };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return withCors(auth as NextResponse);
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
      return withCors(ok(publicOnly));
    }
    return withCors(ok(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Agent not found") return withCors(err("not_found", msg, 404));
    return withCors(handleUnknown(e));
  }
}
