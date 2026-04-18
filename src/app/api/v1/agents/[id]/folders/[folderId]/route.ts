import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { deleteFolder, updateFolder } from "@/lib/services/folders";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; folderId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, folderId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = (await req.json()) as {
      name?: unknown;
      description?: unknown;
    };
    const patch: { name?: string; description?: string | null } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim())
        return err("bad_request", "`name` must be non-empty string", 400);
      patch.name = body.name;
    }
    if (body.description !== undefined) {
      if (body.description === null) patch.description = null;
      else if (typeof body.description === "string")
        patch.description = body.description;
      else
        return err("bad_request", "`description` must be string or null", 400);
    }
    if (Object.keys(patch).length === 0)
      return err("bad_request", "nothing to update", 400);
    return ok(await updateFolder(folderId, patch));
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
