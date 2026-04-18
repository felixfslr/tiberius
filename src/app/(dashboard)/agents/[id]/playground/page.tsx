import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAgent } from "@/lib/services/agents";
import { PlaygroundChat } from "@/components/app/playground-chat";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b px-6 py-3 text-xs font-medium text-muted-foreground">
        <Link href="/agents" className="hover:text-foreground">
          Agents
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/agents/${id}/knowledge`}
          className="hover:text-foreground"
        >
          {agent.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Playground</span>
      </div>
      <PlaygroundChat agent={agent} />
    </div>
  );
}
