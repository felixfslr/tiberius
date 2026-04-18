import { NextRequest } from "next/server";
import { handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { buildGraphData } from "@/lib/services/graph";

export const runtime = "nodejs";
export const maxDuration = 15;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const url = new URL(req.url);
    const fresh = url.searchParams.get("fresh") === "1";
    const topKRaw = url.searchParams.get("topK");
    const topK = topKRaw ? Math.max(1, Math.min(15, Number(topKRaw))) : 5;
    const data = await buildGraphData(id, { fresh, topK });
    return ok(data);
  } catch (e) {
    return handleUnknown(e);
  }
}
