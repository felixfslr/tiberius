import { NextRequest } from "next/server";
import { err, handleUnknown, ok } from "@/lib/api/response";
import { authorizeForAgent } from "@/lib/auth/with-auth";
import { getFeedback, retryFeedback } from "@/lib/services/feedback";

export const runtime = "nodejs";
export const maxDuration = 10;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await getFeedback(id);
  if (!row) return err("not_found", "Feedback not found", 404);
  const auth = await authorizeForAgent(req, row.agent_id);
  if (auth instanceof Response) return auth;
  try {
    await retryFeedback(id);
    return ok({ id, status: "pending" });
  } catch (e) {
    return handleUnknown(e);
  }
}
