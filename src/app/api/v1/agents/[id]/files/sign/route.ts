import { NextRequest } from "next/server";
import { z } from "zod";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { createSignedUpload } from "@/lib/services/files";
import { FileTypeSchema } from "@/lib/schemas/file";

export const runtime = "nodejs";
export const maxDuration = 10;

const Body = z.object({
  filename: z.string().min(1).max(255),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024), // 100 MB cap
  mime_type: z.string().nullable().optional(),
  file_type: FileTypeSchema.default("product_doc"),
  folder_id: z.string().uuid().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success)
      return err(
        "bad_request",
        parsed.error.issues[0]?.message ?? "invalid body",
        400,
      );
    const { filename, size_bytes, mime_type, file_type, folder_id } =
      parsed.data;
    const signed = await createSignedUpload(
      id,
      filename,
      mime_type ?? null,
      size_bytes,
      file_type,
      folder_id ?? null,
    );
    return ok(signed, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
