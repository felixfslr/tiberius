import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAgent } from "@/lib/services/agents";
import { buildGraphData } from "@/lib/services/graph";
import { buttonVariants } from "@/components/ui/button";
import { KnowledgeGraph } from "@/components/app/knowledge-graph";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlight?: string; topK?: string }>;
}) {
  const { id } = await params;
  const { highlight, topK } = await searchParams;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const k = topK ? Math.max(1, Math.min(15, Number(topK))) : 5;
  const data = await buildGraphData(id, { topK: k });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/agents/${id}/knowledge`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Knowledge
          </Link>
          <div className="text-sm font-medium">Knowledge graph</div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {data.stats.chunk_count} chunks · {data.stats.edge_count} edges (
            {data.stats.similarity_edges} sim · {data.stats.co_retrieval_edges}{" "}
            co-ret)
          </span>
        </div>
      </div>
      <KnowledgeGraph
        agentId={id}
        initialData={data}
        initialHighlight={highlight ?? null}
      />
    </div>
  );
}
