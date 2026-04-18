import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { createFolder, listFolders } from "@/lib/services/folders";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    return ok(await listFolders(id));
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = (await req.json()) as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim()) {
      return err("bad_request", "`name` (non-empty string) required", 400);
    }
    const folder = await createFolder(id, body.name);
    return ok(folder, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
