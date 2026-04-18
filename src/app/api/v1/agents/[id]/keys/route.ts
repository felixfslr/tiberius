import { NextRequest } from "next/server";
import { z } from "zod";
import { createKey, listKeys } from "@/lib/services/keys";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const CreateSchema = z.object({ name: z.string().min(1).max(120) });

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  if (auth.scope === "api-key") {
    return err("forbidden", "Use the UI to manage keys", 403);
  }
  try {
    return ok(await listKeys(id));
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  if (auth.scope === "api-key") {
    return err("forbidden", "Use the UI to create keys", 403);
  }
  try {
    const { name } = CreateSchema.parse(await req.json());
    const key = await createKey(id, name);
    return ok(key, { status: 201 });
  } catch (e) {
    return handleUnknown(e);
  }
}
