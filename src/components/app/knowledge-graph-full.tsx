"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { KnowledgeGraphV2 } from "./knowledge-graph-v2";
import type { RichGraph } from "@/lib/services/graph-rich";

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; data: RichGraph }
  | { kind: "error"; message: string };

export function KnowledgeGraphFull({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/v1/agents/${agentId}/graph/rich`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (cancelled) return;
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.data) {
          const message =
            body?.error?.message ?? `Request failed (${res.status})`;
          setState({ kind: "error", message });
          return;
        }
        setState({ kind: "ready", data: body.data as RichGraph });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
        <Link
          href={`/app/agents/${agentId}/knowledge`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Knowledge
        </Link>
        <span className="text-border">/</span>
        <span className="font-mono text-[12px] text-foreground">Graph</span>
        {state.kind === "ready" && (
          <span className="ml-3 font-mono text-[11px] text-muted-foreground">
            {state.data.stats.chunk_count} chunks ·{" "}
            {state.data.stats.edge_count} edges (
            {state.data.stats.similarity_edges} sim ·{" "}
            {state.data.stats.co_retrieval_edges} co-ret)
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {state.kind === "loading" && (
          <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing graph…
          </div>
        )}
        {state.kind === "error" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-6 text-center text-sm">
            <p className="text-foreground">Graph unavailable</p>
            <p className="text-xs text-muted-foreground">{state.message}</p>
          </div>
        )}
        {state.kind === "ready" && (
          <KnowledgeGraphV2 data={state.data} agentName={agentName} />
        )}
      </div>
    </div>
  );
}
