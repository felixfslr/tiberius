import { NextRequest } from "next/server";
import { handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { buildRichGraph } from "@/lib/services/graph-rich";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const url = new URL(req.url);
    const topKRaw = url.searchParams.get("topK");
    const topK = topKRaw ? Math.max(1, Math.min(15, Number(topKRaw))) : 5;
    const data = await buildRichGraph(id, { topK });
    return ok(data);
  } catch (e) {
    return handleUnknown(e);
  }
}
