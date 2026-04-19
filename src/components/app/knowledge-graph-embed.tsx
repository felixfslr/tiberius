"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Expand, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeGraphV2 } from "./knowledge-graph-v2";
import type { RichGraph } from "@/lib/services/graph-rich";

const LAYOUT_ID = "kb-graph-shell";

export function KnowledgeGraphEmbed({
  data,
  agentName,
}: {
  data: RichGraph;
  agentName: string;
}) {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <>
      {!expanded && (
        <motion.div
          layoutId={LAYOUT_ID}
          onClick={() => setExpanded(true)}
          className="group relative h-[520px] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
          role="button"
          tabIndex={0}
          aria-label="Expand knowledge graph"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <KnowledgeGraphV2 data={data} agentName={agentName} />
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur transition group-hover:text-foreground">
            <Expand className="h-3 w-3" />
            Click to expand
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {expanded && (
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
