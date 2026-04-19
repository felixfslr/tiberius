import { NextRequest } from "next/server";
import { deleteKey } from "@/lib/services/keys";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authenticate } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ keyId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { keyId } = await params;
  const auth = await authenticate(req);
  if (!auth) return err("unauthenticated", "Sign in required", 401);
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
