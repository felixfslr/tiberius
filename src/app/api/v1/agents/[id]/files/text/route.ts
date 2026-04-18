import { NextRequest } from "next/server";
import { handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { uploadText } from "@/lib/services/files";
import { FileTextCreateSchema } from "@/lib/schemas/file";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = FileTextCreateSchema.parse(await req.json());
    const row = await uploadText(id, body.filename, body.content, body.file_type);
    return ok(row, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
