import { NextRequest } from "next/server";
import { deleteKey } from "@/lib/services/keys";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; keyId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, keyId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  if (auth.scope === "api-key") {
    return err("forbidden", "Use the UI to revoke keys", 403);
  }
  try {
    await deleteKey(keyId);
    return ok({ deleted: true });
  } catch (e) {
    return handleUnknown(e);
  }
}
