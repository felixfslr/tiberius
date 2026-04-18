import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { deleteFolder, renameFolder } from "@/lib/services/folders";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; folderId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, folderId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = (await req.json()) as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim()) {
      return err("bad_request", "`name` (non-empty string) required", 400);
    }
    return ok(await renameFolder(folderId, body.name));
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, folderId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    await deleteFolder(folderId);
    return ok({ id: folderId });
  } catch (e) {
    return handleUnknown(e);
  }
}
