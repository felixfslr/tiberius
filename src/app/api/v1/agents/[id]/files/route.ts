import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { listFiles, uploadFile } from "@/lib/services/files";
import { FileTypeSchema } from "@/lib/schemas/file";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    return ok(await listFiles(id));
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const typeRaw = form.get("file_type");
    if (!(file instanceof File)) return err("bad_request", "`file` (File) is required", 400);
    const file_type = FileTypeSchema.parse(typeRaw ?? "product_doc");
    const bytes = Buffer.from(await file.arrayBuffer());
    const row = await uploadFile(id, file.name, file.type || null, bytes, file_type);
    return ok(row, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
