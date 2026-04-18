"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GraphData, GraphNode } from "@/lib/services/graph";
import { cn } from "@/lib/utils";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering graph…
    </div>
  ),
});

const TYPE_COLORS: Record<string, string> = {
  chat_history: "#3b82f6",
  convo_snippet: "#60a5fa",
  sop: "#a855f7",
  product_doc: "#14b8a6",
  glossary: "#f59e0b",
  tov_example: "#ec4899",
  transcript: "#8b5cf6",
};
const FALLBACK_COLOR = "#9ca3af";

type GraphNodeInternal = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  _pulseUntil?: number;
};

type ForceGraphMethods = {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
};

export function KnowledgeGraph({
  agentId,
  initialData,
  initialHighlight,
}: {
  agentId: string;
  initialData: GraphData;
  initialHighlight: string | null;
}) {
  const [data, setData] = useState<GraphData>(initialData);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  // react-force-graph-2d expects a MutableRefObject — undefined initial value, not null.
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hideDeprecated, setHideDeprecated] = useState(true);
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const pulseRef = useRef<Map<string, number>>(new Map());

  // Resize observer — keep graph dimensions in sync with container.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Realtime: chunk updates → refetch + pulse.
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`graph-chunks:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chunks",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newRow = payload.new as { id: string };
          pulseRef.current.set(newRow.id, Date.now() + 3500);
          refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chunks",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newRow = payload.new as { id: string };
          pulseRef.current.set(newRow.id, Date.now() + 3500);
          refresh();
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Initial highlight: center and zoom to the target node.
  useEffect(() => {
    if (!initialHighlight) return;
    pulseRef.current.set(initialHighlight, Date.now() + 5000);
    const t = setTimeout(() => {
      const node = data.nodes.find((n) => n.id === initialHighlight) as
        | GraphNodeInternal
        | undefined;
      if (node && typeof node.x === "number" && typeof node.y === "number") {
        fgRef.current?.centerAt(node.x, node.y, 800);
        fgRef.current?.zoom(2.2, 800);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHighlight, data.nodes.length]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/graph?fresh=1`);
      const json = await res.json();
      if (json?.data) setData(json.data as GraphData);
    } catch {
      // ignore; realtime will retry
    }
  }, [agentId]);

  const types = useMemo(() => {
    const s = new Set<string>();
    for (const n of data.nodes) s.add(n.content_type);
    return Array.from(s).sort();
  }, [data.nodes]);

  const visibleNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of data.nodes) {
      if (hideDeprecated && n.deprecated) continue;
      if (onlyEdited && !n.edited_by_user) continue;
      if (typeFilter.size > 0 && !typeFilter.has(n.content_type)) continue;
      set.add(n.id);
    }
    return set;
  }, [data.nodes, hideDeprecated, onlyEdited, typeFilter]);

  const filtered = useMemo(() => {
    const nodes = data.nodes.filter((n) => visibleNodeIds.has(n.id));
    const edges = data.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    );
    return { nodes, links: edges };
  }, [data, visibleNodeIds]);

  function toggleType(t: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const drawNode = useCallback(
    (
      node: GraphNodeInternal,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => {
      const color = node.deprecated
        ? "#6b7280"
        : (TYPE_COLORS[node.content_type] ?? FALLBACK_COLOR);
      const baseR = node.size ?? 6;
      const pulseUntil = pulseRef.current.get(node.id) ?? 0;
      const now = Date.now();
      const isPulsing = pulseUntil > now;
      const pulseT = isPulsing ? 1 - (pulseUntil - now) / 3500 : 0;

      if (isPulsing) {
        const ringR = baseR + 4 + pulseT * 18;
        const ringAlpha = Math.max(0, 1 - pulseT);
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, ringR, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(34, 197, 94, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, baseR, 0, 2 * Math.PI);
      ctx.fillStyle = node.deprecated ? `${color}80` : color;
      ctx.fill();

      if (node.edited_by_user) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fbbf24";
        ctx.stroke();
      }

      if (globalScale > 2.2) {
        const label = node.label ?? "";
        const fontSize = 10 / globalScale;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = "#475569";
        ctx.textAlign = "center";
        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + baseR + fontSize + 1);
      }
    },
    [],
  );

  const linkColor = useCallback((link: unknown) => {
    const l = link as { edge_type?: string; weight?: number };
    if (l.edge_type === "co_retrieval") return "rgba(236, 72, 153, 0.4)";
    if (l.edge_type === "mixed") return "rgba(168, 85, 247, 0.55)";
    return "rgba(148, 163, 184, 0.35)";
  }, []);

  const linkWidth = useCallback((link: unknown) => {
    const l = link as { weight?: number };
    return 0.6 + (l.weight ?? 0.2) * 2.4;
  }, []);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </div>
        <div className="flex max-w-[200px] flex-wrap gap-1">
          {types.map((t) => {
            const active = typeFilter.size === 0 || typeFilter.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition",
                  active
                    ? "border-border bg-background text-foreground"
                    : "border-transparent bg-muted/60 text-muted-foreground",
                )}
                style={{
                  borderLeft: `3px solid ${TYPE_COLORS[t] ?? FALLBACK_COLOR}`,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <Switch
            checked={hideDeprecated}
            onCheckedChange={setHideDeprecated}
          />
          <span>Hide deprecated</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Switch checked={onlyEdited} onCheckedChange={setOnlyEdited} />
          <span>Only edited by feedback</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          className="mt-1"
        >
          <Search className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex flex-col gap-1 rounded-lg border border-border bg-card/95 p-2 text-[10px] shadow-sm backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-slate-400" />
          <span className="text-muted-foreground">similarity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-pink-500/60" />
          <span className="text-muted-foreground">co-retrieval</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-purple-500/60" />
          <span className="text-muted-foreground">both</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-amber-400" />
          <span className="text-muted-foreground">edited</span>
        </div>
      </div>

      <div ref={containerRef} className="flex-1">
        <ForceGraph2D
          ref={fgRef as never}
          graphData={filtered}
          width={size.w}
          height={size.h}
          backgroundColor="transparent"
          nodeId="id"
          nodeVal={(n: unknown) => (n as GraphNode).size}
          nodeCanvasObject={drawNode as never}
          nodePointerAreaPaint={(
            node: unknown,
            color: string,
            ctx: CanvasRenderingContext2D,
          ) => {
            const n = node as GraphNodeInternal;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, (n.size ?? 6) + 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor={linkColor as never}
          linkWidth={linkWidth as never}
          onNodeClick={(node: unknown) => setSelected(node as GraphNode)}
          cooldownTicks={80}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
        />
      </div>

      <NodeDetailDialog
        agentId={agentId}
        node={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function NodeDetailDialog({
  agentId,
  node,
  onClose,
}: {
  agentId: string;
  node: GraphNode | null;
  onClose: () => void;
}) {
  const [full, setFull] = useState<{
    id: string;
    content: string;
    content_type: string;
    metadata: Record<string, unknown>;
    file_id: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node) {
      setFull(null);
      return;
    }
    setLoading(true);
    fetch(`/api/v1/chunks/${node.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setFull(j.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [node]);

  return (
    <Dialog open={!!node} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {node?.content_type ? (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{
                  background: TYPE_COLORS[node.content_type] ?? FALLBACK_COLOR,
                }}
              />
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">
              {node?.content_type}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {node ? node.id.slice(0, 8) : ""}
            </span>
            {node?.edited_by_user ? (
              <span className="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                edited
              </span>
            ) : null}
            {node?.deprecated ? (
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                deprecated
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Retrieved {node?.retrieval_count ?? 0} time
            {node?.retrieval_count === 1 ? "" : "s"} by the agent so far.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading chunk…
          </div>
        ) : full ? (
          <div className="space-y-3">
            <div className="max-h-[320px] overflow-y-auto rounded border border-border/60 bg-muted/20 p-3 text-sm whitespace-pre-wrap">
              {full.content}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Metadata
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-[10px]">
                {JSON.stringify(full.metadata, null, 2)}
              </pre>
            </details>
            {full.file_id ? (
              <div className="flex gap-2">
                <a
                  href={`/agents/${agentId}/knowledge/files/${full.file_id}`}
                  className="inline-flex items-center rounded border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Pencil className="mr-1.5 h-3 w-3" /> Edit in file view
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            Could not load chunk.
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3 w-3" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
