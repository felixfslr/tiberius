import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { deleteChunk, getChunk, updateChunk } from "@/lib/services/chunks";
import { ChunkPatchSchema } from "@/lib/schemas/chunk";

export const runtime = "nodejs";
export const maxDuration = 30; // re-embed on edit is a network call

type Params = { params: Promise<{ id: string }> };

async function authForChunk(req: NextRequest, chunk_id: string) {
  const chunk = await getChunk(chunk_id);
  if (!chunk) return { response: err("not_found", "Chunk not found", 404) };
  const auth = await authorizeForAgent(req, chunk.agent_id);
  if (auth instanceof Response) return { response: auth };
  return { chunk, auth };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await authForChunk(req, id);
  if ("response" in r) return r.response;
  return ok(r.chunk);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await authForChunk(req, id);
  if ("response" in r) return r.response;
  try {
    const body = ChunkPatchSchema.parse(await req.json());
    const updated = await updateChunk(id, body.content);
    return ok(updated);
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await authForChunk(req, id);
  if ("response" in r) return r.response;
  try {
    await deleteChunk(id);
    return ok({ deleted: true });
  } catch (e) {
    return handleUnknown(e);
  }
}
