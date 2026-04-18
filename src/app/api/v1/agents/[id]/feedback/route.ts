import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { listFeedback, submitFeedback } from "@/lib/services/feedback";
import {
  FeedbackStatusSchema,
  FeedbackSubmitSchema,
} from "@/lib/schemas/feedback";

export const runtime = "nodejs";
export const maxDuration = 10;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const body = FeedbackSubmitSchema.parse(await req.json());
    const result = await submitFeedback(body);
    if (result.agent_id !== id) {
      return err("forbidden", "reply_log does not belong to this agent", 403);
    }
    return ok(result);
  } catch (e) {
    return handleUnknown(e);
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorizeForAgent(req, id);
  if (auth instanceof Response) return auth;
  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const parsed =
      statusParam && statusParam !== "all"
        ? FeedbackStatusSchema.safeParse(statusParam)
        : null;
    const status =
      statusParam === "all"
        ? ("all" as const)
        : parsed?.success
          ? parsed.data
          : undefined;
    const rows = await listFeedback(id, { status });
    return ok(rows);
  } catch (e) {
    return handleUnknown(e);
  }
}
