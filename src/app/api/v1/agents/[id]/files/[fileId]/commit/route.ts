import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { commitUploadedFile } from "@/lib/services/files";

export const runtime = "nodejs";
export const maxDuration = 10;

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const row = await commitUploadedFile(id, fileId);
    return ok(row);
  } catch (e) {
    return handleUnknown(e);
  }
}
