import { NextRequest, NextResponse } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { ReplyRequestSchema } from "@/lib/schemas/reply";
import { draftReply } from "@/lib/services/replies";
import { createSse } from "@/lib/api/sse";
import type { TreeEvent } from "@/lib/generation/tree";

export const runtime = "nodejs";
export const maxDuration = 300;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
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

  let body;
  try {
    body = ReplyRequestSchema.parse(await req.json());
  } catch (e) {
    return withCors(handleUnknown(e));
  }

  const url = new URL(req.url);
  const wantsStream =
    auth.scope === "session" &&
    (req.headers.get("accept")?.includes("text/event-stream") ||
      url.searchParams.get("stream") === "1");

  // Streaming path (Playground only — session scope, never api-key).
  if (wantsStream) {
    const sse = createSse();

    const onEvent = (event: TreeEvent) => {
      sse.send({ type: event.type, data: event.data });
    };

    // Kick off generation, stream events live, send `final_reply` at the end.
    (async () => {
      try {
        const result = await draftReply(id, body, onEvent);
        sse.send({ type: "final_reply", data: result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sse.send({ type: "error", data: { message: msg, phase: "fatal" } });
      } finally {
        sse.close();
      }
    })();

    return new NextResponse(sse.stream, {
      status: 200,
      headers: { ...CORS_HEADERS, ...sse.headers },
    });
  }

  // Non-streaming JSON path (default — api-key callers + any non-SSE consumer).
  try {
    const result = await draftReply(id, body);
    if (auth.scope === "api-key") {
      const {
        retrieved_chunks: _rc,
        prompt_preview: _pp,
        tree_trace: _tt,
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
