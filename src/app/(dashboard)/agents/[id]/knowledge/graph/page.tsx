import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAgent } from "@/lib/services/agents";
import { buildRichGraph } from "@/lib/services/graph-rich";
import { KnowledgeGraphV2 } from "@/components/app/knowledge-graph-v2";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const data = await buildRichGraph(id);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
        <Link
          href={`/agents/${id}/knowledge`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Knowledge
        </Link>
        <span className="text-border">/</span>
        <span className="font-mono text-[12px] text-foreground">Graph</span>
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">
          {data.stats.chunk_count} chunks · {data.stats.edge_count} edges (
          {data.stats.similarity_edges} sim · {data.stats.co_retrieval_edges}{" "}
          co-ret)
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <KnowledgeGraphV2 data={data} agentName={agent.name} />
      </div>
    </div>
  );
}
