"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Expand, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeGraphV2 } from "./knowledge-graph-v2";
import type { RichGraph } from "@/lib/services/graph-rich";

const LAYOUT_ID = "kb-graph-shell";

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; data: RichGraph }
  | { kind: "error"; message: string };

type Props = { agentName: string } & (
  | { agentId: string; data?: undefined }
  | { data: RichGraph; agentId?: undefined }
);

export function KnowledgeGraphEmbed(props: Props) {
  const { agentName, agentId, data: staticData } = props;
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<FetchState>(
    staticData ? { kind: "ready", data: staticData } : { kind: "loading" },
  );

  useEffect(() => {
    if (!agentId) return;
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

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Lock body scroll while overlay is open.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const data = state.kind === "ready" ? state.data : null;

  return (
    <>
      {!expanded && (
        <motion.div
          layoutId={LAYOUT_ID}
          onClick={() => data && setExpanded(true)}
          className="group relative h-[520px] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
          role="button"
          tabIndex={0}
          aria-label="Expand knowledge graph"
          onKeyDown={(e) => {
            if (!data) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            {data ? (
              <KnowledgeGraphV2 data={data} agentName={agentName} />
            ) : (
              <GraphPlaceholder state={state} />
            )}
          </div>
          {data && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur transition group-hover:text-foreground">
              <Expand className="h-3 w-3" />
              Click to expand
            </div>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {expanded && data && (
          <motion.div
            layoutId={LAYOUT_ID}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-foreground">
                  Knowledge graph
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {data.stats.chunk_count} chunks · {data.stats.edge_count}{" "}
                  edges ({data.stats.similarity_edges} sim ·{" "}
                  {data.stats.co_retrieval_edges} co-ret)
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(false)}
                aria-label="Close graph"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <KnowledgeGraphV2 data={data} agentName={agentName} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function GraphPlaceholder({ state }: { state: FetchState }) {
  if (state.kind === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Computing graph…
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-6 text-center text-sm">
        <p className="text-foreground">Graph unavailable</p>
        <p className="text-xs text-muted-foreground">{state.message}</p>
      </div>
    );
  }
  return null;
}
