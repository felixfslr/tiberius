import { notFound } from "next/navigation";
import {
  computeAgentStatus,
  getAgent,
  getAgentStats,
} from "@/lib/services/agents";
import { AgentHeader } from "@/components/app/agent-header";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  const stats = await getAgentStats(id).catch(() => null);
  const live = stats ? computeAgentStatus(stats) : "draft";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AgentHeader agentId={id} agentName={agent.name} live={live} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
