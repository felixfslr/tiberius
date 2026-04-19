import { notFound } from "next/navigation";
import { getAgent } from "@/lib/services/agents";
import { listFeedback } from "@/lib/services/feedback";
import { FeedbackStatusSchema } from "@/lib/schemas/feedback";
import { FeedbackReview } from "@/components/app/feedback-review";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | import("@/lib/schemas/feedback").FeedbackStatus;

function parseStatus(raw: string | undefined): StatusFilter {
  if (!raw || raw === "all") return "all";
  const parsed = FeedbackStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : "all";
}

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status: statusParam } = await searchParams;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const status = parseStatus(statusParam);
  const rows = await listFeedback(id, { status });

  return (
    <FeedbackReview
      agentId={id}
      agentName={agent.name}
      initialRows={rows}
      initialStatus={status}
    />
  );
}
