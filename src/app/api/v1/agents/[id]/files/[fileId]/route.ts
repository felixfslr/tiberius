import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import {
  deleteFile,
  getFile,
  moveFile,
  reprocessFile,
} from "@/lib/services/files";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const file = await getFile(fileId);
    if (!file || file.agent_id !== id)
      return err("not_found", "File not found", 404);
    return ok(file);
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const file = await getFile(fileId);
    if (!file || file.agent_id !== id)
      return err("not_found", "File not found", 404);
    await deleteFile(fileId);
    return ok({ deleted: true });
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const file = await getFile(fileId);
    if (!file || file.agent_id !== id)
      return err("not_found", "File not found", 404);
    const body = (await req.json()) as { folder_id?: unknown };
    if (!("folder_id" in body))
      return err("bad_request", "`folder_id` required", 400);
    const folderId =
      body.folder_id === null
        ? null
        : typeof body.folder_id === "string"
          ? body.folder_id
          : undefined;
    if (folderId === undefined)
      return err("bad_request", "`folder_id` must be uuid or null", 400);
    await moveFile(fileId, folderId);
    return ok({ ...file, folder_id: folderId });
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  // Reprocess: re-runs extract→chunk→enrich→embed for this file.
  const { id, fileId } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const file = await getFile(fileId);
    if (!file || file.agent_id !== id)
      return err("not_found", "File not found", 404);
    await reprocessFile(fileId);
    return ok({ enqueued: true });
  } catch (e) {
    return handleUnknown(e);
  }
}
