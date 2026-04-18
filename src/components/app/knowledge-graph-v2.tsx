"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RichGraph, RichNode } from "@/lib/services/graph-rich";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering graph…
    </div>
  ),
});

// ============================================================
// Palettes
// ============================================================

const STAGE_COLOR: Record<string, string> = {
  cold: "#6B7280",
  qualifying: "#7B61FF",
  scheduling: "#3ECF8E",
  scheduled: "#10B981",
  stalled: "#F97316",
  any: "#94A3B8",
};

const CONTENT_TYPE_COLOR: Record<string, string> = {
  chat_history: "#3B82F6",
  convo_snippet: "#60A5FA",
  sop: "#A855F7",
  product_doc: "#14B8A6",
  glossary: "#F59E0B",
  tov_example: "#EC4899",
  transcript: "#8B5CF6",
};

// 11 distinguishable hues for intents.
const INTENT_PALETTE = [
  "#7B61FF", // product_fit  -> brand
  "#94A3B8", // other       -> muted
  "#3ECF8E", // scheduling
  "#F97316", // objection
  "#F59E0B", // pricing
  "#14B8A6", // integration
  "#60A5FA", // timeline
  "#EC4899", // small_talk
  "#A855F7", // compliance
  "#EF4444", // competitor
  "#10B981", // contact_info
];

const FALLBACK = "#6B7280";

type ColorAxis = "stage" | "content_type" | "intent";
type EdgeFilter = "all" | "similarity" | "co_retrieval";

// ============================================================
// Internal graph types
// ============================================================

type FGNode = RichNode & { x?: number; y?: number; vx?: number; vy?: number };
type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  weight: number;
  edge_type: "similarity" | "co_retrieval" | "mixed";
};

type ForceGraphMethods = {
  d3Force: (
    name: string,
    force?: unknown,
  ) =>
    | { strength?: (v: number) => unknown; distance?: (v: number) => unknown }
    | undefined;
  d3ReheatSimulation?: () => void;
};

function linkEndpointId(end: string | FGNode): string {
  return typeof end === "string" ? end : end.id;
}

// ============================================================
// Main
// ============================================================

export function KnowledgeGraphV2({
  data,
  agentName,
}: {
  data: RichGraph;
  agentName: string;
}) {
  const [colorAxis, setColorAxis] = useState<ColorAxis>("stage");
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("all");
  const [activeStages, setActiveStages] = useState<Set<string>>(new Set());
  const [activeIntents, setActiveIntents] = useState<Set<string>>(new Set());
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeEntity, setActiveEntity] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<RichNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<RichNode | null>(null);
  const fgRef = useRef<unknown>(null);

  // Build intent -> color mapping once we know all intents.
  const intentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    data.stats.unique_intents.forEach((intent, i) => {
      map[intent] = INTENT_PALETTE[i % INTENT_PALETTE.length]!;
    });
    return map;
  }, [data.stats.unique_intents]);

  // Degree + neighbor maps for Obsidian-style sizing + hover focus.
  const { degreeById, neighborsById } = useMemo(() => {
    const deg = new Map<string, number>();
    const nbrs = new Map<string, Set<string>>();
    for (const e of data.edges) {
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
      if (!nbrs.has(e.source)) nbrs.set(e.source, new Set());
      if (!nbrs.has(e.target)) nbrs.set(e.target, new Set());
      nbrs.get(e.source)!.add(e.target);
      nbrs.get(e.target)!.add(e.source);
    }
    return { degreeById: deg, neighborsById: nbrs };
  }, [data.edges]);

  // The "focused" node (hover wins over selection while hovering). Drives
  // neighborhood highlighting.
  const focusNode = hoverNode ?? selectedNode;
  const focusId = focusNode?.id ?? null;
  const focusNeighbors = useMemo(
    () => (focusId ? (neighborsById.get(focusId) ?? new Set<string>()) : null),
    [focusId, neighborsById],
  );

  // Match: does a node pass all active filters?
  const matches = useCallback(
    (n: RichNode): boolean => {
      if (activeTypes.size > 0 && !activeTypes.has(n.content_type))
        return false;
      if (activeStages.size > 0 && !n.stage.some((s) => activeStages.has(s)))
        return false;
      if (activeIntents.size > 0 && !n.intent.some((i) => activeIntents.has(i)))
        return false;
      if (
        activeEntity &&
        !n.entities.some((e) => e.toLowerCase() === activeEntity.toLowerCase())
      )
        return false;
      return true;
    },
    [activeTypes, activeStages, activeIntents, activeEntity],
  );

  const nodeColor = useCallback(
    (n: RichNode): string => {
      if (colorAxis === "content_type")
        return CONTENT_TYPE_COLOR[n.content_type] ?? FALLBACK;
      if (colorAxis === "stage") {
        const s = n.stage[0];
        return s ? (STAGE_COLOR[s] ?? FALLBACK) : FALLBACK;
      }
      // intent
      const i = n.intent[0];
      return i ? (intentColorMap[i] ?? FALLBACK) : FALLBACK;
    },
    [colorAxis, intentColorMap],
  );

  // Build graph payload for react-force-graph.
  const graphData = useMemo(() => {
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const links: FGLink[] = data.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .filter((e) => {
        if (edgeFilter === "all") return true;
        if (edgeFilter === "similarity")
          return e.edge_type === "similarity" || e.edge_type === "mixed";
        return e.edge_type === "co_retrieval" || e.edge_type === "mixed";
      })
      .map((e) => ({ ...e }));
    return {
      nodes: data.nodes.map((n) => ({ ...n })) as FGNode[],
      links,
    };
  }, [data, edgeFilter]);

  const total = data.stats.chunk_count;
  const hidden = data.nodes.filter((n) => !matches(n)).length;

  // Obsidian-style physics: more repulsion so clusters spread out; shorter
  // links so neighbors stay close together.
  useEffect(() => {
    const fg = fgRef.current as ForceGraphMethods | null;
    if (!fg || typeof fg.d3Force !== "function") return;
    fg.d3Force("charge")?.strength?.(-70);
    fg.d3Force("link")?.distance?.(28);
    fg.d3ReheatSimulation?.();
  }, [graphData]);

  function toggleSet(
    s: Set<string>,
    setter: (s: Set<string>) => void,
    key: string,
  ) {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  function clearAll() {
    setActiveStages(new Set());
    setActiveIntents(new Set());
    setActiveTypes(new Set());
    setActiveEntity(null);
  }

  return (
    <div className="grid h-full flex-1 grid-cols-[320px_1fr] overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col overflow-y-auto border-r border-border bg-sidebar/40">
        <div className="space-y-1 border-b border-border px-5 py-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Characterize
          </div>
          <div className="text-[13px] font-medium text-foreground">
            {agentName}
          </div>
          <div className="flex items-center gap-3 pt-1 font-mono text-[11px] text-muted-foreground">
            <span>{total} chunks</span>
            <span>·</span>
            <span>{data.stats.edge_count} edges</span>
            {hidden > 0 ? (
              <>
                <span>·</span>
                <span>{hidden} hidden</span>
              </>
            ) : null}
          </div>
        </div>

        <FilterGroup label="Color by">
          <SegmentedControl
            options={[
              { value: "stage", label: "Stage" },
              { value: "content_type", label: "Type" },
              { value: "intent", label: "Intent" },
            ]}
            value={colorAxis}
            onChange={(v) => setColorAxis(v as ColorAxis)}
          />
        </FilterGroup>

        <FilterGroup label="Edges">
          <SegmentedControl
            options={[
              { value: "all", label: "All" },
              { value: "similarity", label: "Similarity" },
              { value: "co_retrieval", label: "Co-retrieved" },
            ]}
            value={edgeFilter}
            onChange={(v) => setEdgeFilter(v as EdgeFilter)}
          />
        </FilterGroup>

        <FilterGroup
          label="Content type"
          count={data.stats.content_type_counts}
        >
          {Object.keys(data.stats.content_type_counts)
            .sort()
            .map((t) => (
              <FilterChip
                key={t}
                color={CONTENT_TYPE_COLOR[t] ?? FALLBACK}
                active={activeTypes.has(t)}
                onClick={() => toggleSet(activeTypes, setActiveTypes, t)}
                count={data.stats.content_type_counts[t]}
              >
                {t}
              </FilterChip>
            ))}
        </FilterGroup>

        <FilterGroup label="Stage">
          {data.stats.unique_stages.map((s) => (
            <FilterChip
              key={s}
              color={STAGE_COLOR[s] ?? FALLBACK}
              active={activeStages.has(s)}
              onClick={() => toggleSet(activeStages, setActiveStages, s)}
              count={data.nodes.filter((n) => n.stage.includes(s)).length}
            >
              {s}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="Intent">
          {data.stats.unique_intents.map((i) => (
            <FilterChip
              key={i}
              color={intentColorMap[i] ?? FALLBACK}
              active={activeIntents.has(i)}
              onClick={() => toggleSet(activeIntents, setActiveIntents, i)}
              count={data.nodes.filter((n) => n.intent.includes(i)).length}
            >
              {i}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="Top entities">
          <div className="flex flex-wrap gap-1.5">
            {data.stats.top_entities.slice(0, 14).map((e) => (
              <button
                key={e.entity}
                type="button"
                onClick={() =>
                  setActiveEntity(activeEntity === e.entity ? null : e.entity)
                }
                className="rounded border px-2 py-1 font-mono text-[10.5px] transition-colors"
                style={{
                  borderColor:
                    activeEntity === e.entity
                      ? "var(--brand, #7B61FF)"
                      : "var(--border2, #2A2A35)",
                  background:
                    activeEntity === e.entity
                      ? "rgba(123, 97, 255, 0.16)"
                      : "transparent",
                  color:
                    activeEntity === e.entity
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                }}
              >
                {e.entity} <span className="opacity-60">{e.count}</span>
              </button>
            ))}
          </div>
        </FilterGroup>

        <div className="border-t border-border px-5 py-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={clearAll}
            disabled={
              activeStages.size === 0 &&
              activeIntents.size === 0 &&
              activeTypes.size === 0 &&
              activeEntity === null
            }
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reset filters
          </Button>
        </div>
      </aside>

      {/* Graph canvas */}
      <div className="relative overflow-hidden">
        <ForceGraph2D
          ref={fgRef as never}
          graphData={graphData as never}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          linkDirectionalParticles={0}
          cooldownTicks={120}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
          linkColor={
            ((l: FGLink) => {
              const srcId = linkEndpointId(l.source);
              const tgtId = linkEndpointId(l.target);
              const touchesFocus =
                focusId !== null && (srcId === focusId || tgtId === focusId);
              // Base alpha per edge type.
              let baseAlpha: number;
              let r = 180,
                g = 180,
                b = 195;
              if (l.edge_type === "co_retrieval") {
                baseAlpha = 0.22;
                r = 236;
                g = 72;
                b = 153;
              } else if (l.edge_type === "mixed") {
                baseAlpha = 0.18;
                r = 123;
                g = 97;
                b = 255;
              } else {
                baseAlpha = 0.1; // similarity — very faint by default
              }
              // Focus mode: boost neighbor edges, crush the rest.
              const alpha =
                focusId === null
                  ? baseAlpha
                  : touchesFocus
                    ? Math.min(0.8, baseAlpha * 3.2)
                    : 0.04;
              return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
            }) as never
          }
          linkWidth={
            ((l: FGLink) => {
              const srcId = linkEndpointId(l.source);
              const tgtId = linkEndpointId(l.target);
              const touchesFocus =
                focusId !== null && (srcId === focusId || tgtId === focusId);
              const base = 0.18 + (l.weight ?? 0) * 0.45;
              return touchesFocus ? base * 1.8 : base;
            }) as never
          }
          nodeCanvasObject={
            ((n: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
              // Obsidian-style size: sqrt(degree), base ~1.4 px.
              const deg = degreeById.get(n.id) ?? 0;
              const r = 1.4 + Math.sqrt(deg) * 0.55;

              // Dim by filter first, then by neighborhood focus.
              const filterHidden = !matches(n);
              const isFocus = focusId === n.id;
              const isNeighbor = focusId !== null && focusNeighbors?.has(n.id);
              const focusFaded = focusId !== null && !isFocus && !isNeighbor;
              const alpha = filterHidden ? 0.08 : focusFaded ? 0.12 : 1;

              ctx.globalAlpha = alpha;
              ctx.fillStyle = nodeColor(n);
              ctx.beginPath();
              ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2, false);
              ctx.fill();

              // Hover ring — subtle white halo on the hovered node.
              if (hoverNode?.id === n.id && !filterHidden) {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "rgba(255,255,255,0.42)";
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.arc(n.x!, n.y!, r + 2, 0, Math.PI * 2, false);
                ctx.stroke();
              }

              // Selection ring — pinned white.
              if (selectedNode?.id === n.id) {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.arc(n.x!, n.y!, r + 3, 0, Math.PI * 2, false);
                ctx.stroke();
              }

              ctx.globalAlpha = 1;
              // Silence unused var hint when scale drops to 1.
              void scale;
            }) as never
          }
          nodePointerAreaPaint={
            ((n: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
              // Slightly larger than the visual radius so tiny nodes stay
              // hoverable.
              const deg = degreeById.get(n.id) ?? 0;
              const r = 1.4 + Math.sqrt(deg) * 0.55 + 3;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2, false);
              ctx.fill();
            }) as never
          }
          onNodeHover={(n) => setHoverNode((n as RichNode) ?? null)}
          onNodeClick={(n) =>
            setSelectedNode(
              selectedNode?.id === (n as RichNode).id ? null : (n as RichNode),
            )
          }
        />

        {/* Legend */}
        <div className="pointer-events-none absolute top-4 left-4 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-[11px] backdrop-blur">
          <div className="mb-1 font-mono text-muted-foreground">
            {colorAxis === "stage"
              ? "stage"
              : colorAxis === "intent"
                ? "intent"
                : "content_type"}{" "}
            · fill
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(colorAxis === "stage"
              ? data.stats.unique_stages
              : colorAxis === "content_type"
                ? Object.keys(data.stats.content_type_counts).sort()
                : data.stats.unique_intents
            ).map((key) => {
              const color =
                colorAxis === "stage"
                  ? (STAGE_COLOR[key] ?? FALLBACK)
                  : colorAxis === "content_type"
                    ? (CONTENT_TYPE_COLOR[key] ?? FALLBACK)
                    : (intentColorMap[key] ?? FALLBACK);
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="font-mono text-muted-foreground">{key}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 font-mono text-muted-foreground">
            size · degree
          </div>
          <div className="font-mono text-muted-foreground">
            hover · focus neighborhood
          </div>
        </div>

        {/* Hover preview */}
        {hoverNode && !selectedNode ? (
          <div
            className="pointer-events-none absolute right-4 bottom-4 max-w-sm rounded-lg border border-border/60 bg-background/90 p-3 text-[12px] backdrop-blur"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            <div className="mb-1 flex items-center gap-2 text-[10.5px] font-mono text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: nodeColor(hoverNode) }}
              />
              {hoverNode.content_type}
              {hoverNode.filename ? (
                <span className="opacity-70">· {hoverNode.filename}</span>
              ) : null}
            </div>
            {hoverNode.summary ? (
              <div className="text-foreground">{hoverNode.summary}</div>
            ) : null}
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              stage: {hoverNode.stage.join(", ") || "—"} · intent:{" "}
              {hoverNode.intent.join(", ") || "—"} · retrieved{" "}
              {hoverNode.retrieval_count}×
            </div>
          </div>
        ) : null}

        {/* Selected detail */}
        {selectedNode ? (
          <div
            className="absolute top-4 right-4 bottom-4 w-[360px] overflow-y-auto rounded-lg border border-border/60 bg-background/95 p-4 backdrop-blur"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-mono text-muted-foreground">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: nodeColor(selectedNode) }}
                  />
                  {selectedNode.content_type}
                </div>
                {selectedNode.filename ? (
                  <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {selectedNode.filename} · chunk #{selectedNode.position}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {selectedNode.summary ? (
              <div className="mb-3 text-[12.5px] text-foreground">
                {selectedNode.summary}
              </div>
            ) : null}

            <Section title="stages">
              {selectedNode.stage.map((s) => (
                <Chip key={s} color={STAGE_COLOR[s] ?? FALLBACK}>
                  {s}
                </Chip>
              ))}
            </Section>
            <Section title="intents">
              {selectedNode.intent.map((i) => (
                <Chip key={i} color={intentColorMap[i] ?? FALLBACK}>
                  {i}
                </Chip>
              ))}
            </Section>
            {selectedNode.entities.length > 0 ? (
              <Section title="entities">
                {selectedNode.entities.map((e) => (
                  <Chip key={e}>{e}</Chip>
                ))}
              </Section>
            ) : null}

            <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-foreground/80">
              {selectedNode.content.slice(0, 700)}
              {selectedNode.content.length > 700 ? "…" : ""}
            </div>

            <div className="mt-3 font-mono text-[10px] text-muted-foreground">
              retrieved {selectedNode.retrieval_count}× · position{" "}
              {selectedNode.position}
              {selectedNode.edited_by_user ? " · edited" : ""}
              {selectedNode.deprecated ? " · deprecated" : ""}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Sidebar bits
// ============================================================

function FilterGroup({
  label,
  children,
  count,
}: {
  label: string;
  children: React.ReactNode;
  count?: Record<string, number>;
}) {
  return (
    <div className="border-b border-border px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {count ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {Object.values(count).reduce((a, b) => a + b, 0)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  children,
  color,
  active,
  count,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors"
      style={{
        borderColor: active ? color : "var(--border2, #2A2A35)",
        background: active ? `${color}28` : "transparent",
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="font-mono">{children}</span>
      {count !== undefined ? (
        <span className="font-mono opacity-60">{count}</span>
      ) : null}
    </button>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex w-full overflow-hidden rounded border"
      style={{ borderColor: "var(--border2, #2A2A35)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex-1 px-2 py-1.5 font-mono text-[10.5px] transition-colors"
            style={{
              background: active ? "rgba(123, 97, 255, 0.22)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.some((c) => c)
    : !!children;
  if (!hasChildren) return null;
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]"
      style={{
        borderColor: color ? `${color}55` : "var(--border2, #2A2A35)",
        background: color ? `${color}1C` : "transparent",
        color: color ? "var(--foreground)" : "var(--muted-foreground)",
      }}
    >
      {color ? (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
      ) : null}
      {children}
    </span>
  );
}
