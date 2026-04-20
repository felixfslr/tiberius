import { notFound } from "next/navigation";
import { getAgent } from "@/lib/services/agents";
import { KnowledgeGraphFull } from "@/components/app/knowledge-graph-full";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  return <KnowledgeGraphFull agentId={id} agentName={agent.name} />;
}
