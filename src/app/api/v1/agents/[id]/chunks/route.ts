import { NextRequest } from "next/server";
import { handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { listChunks } from "@/lib/services/chunks";
import { ContentTypeSchema } from "@/lib/schemas/common";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const url = new URL(req.url);
    const file_id = url.searchParams.get("file_id") ?? undefined;
    const ctRaw = url.searchParams.get("content_type");
    const content_type = ctRaw ? ContentTypeSchema.parse(ctRaw) : undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return ok(await listChunks(id, { file_id, content_type, limit, offset }));
  } catch (e) {
    return handleUnknown(e);
  }
}
