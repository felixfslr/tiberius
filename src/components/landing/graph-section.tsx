"use client";

import { Layers, Link2, Pencil } from "lucide-react";
import { KnowledgeGraphEmbed } from "@/components/app/knowledge-graph-embed";
import { landingGraph } from "@/data/landing-graph";
import { Reveal } from "./reveal";

export function GraphSection() {
  return (
    <section id="graph" className="relative px-5 py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 50% 40%, oklch(0.7 0.19 285 / 0.12), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-col gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            /knowledge graph
          </div>
          <h2
            className="font-heading font-black tracking-[-0.035em] text-foreground"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)", lineHeight: 1 }}
          >
            Your ops. One graph.
            <br />
            <span className="text-muted-foreground">
              Every chunk editable, every edge earned.
            </span>
          </h2>
          <p className="max-w-2xl text-[15px] text-muted-foreground">
            Product docs, SOPs, glossaries, chat transcripts, tone-of-voice
            samples — chunked by content-type-aware splitters, enriched with
            stage / intent / entities, embedded, linked. Similarity edges come
            from cosine neighbours; co-retrieval edges earn themselves when two
            chunks keep getting pulled together for real replies.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-2 shadow-[0_30px_120px_-20px_oklch(0.7_0.19_285/0.4)]">
            <KnowledgeGraphEmbed
              data={landingGraph}
              agentName="asktiberius · demo"
            />
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Layers className="h-4 w-4" />}
            title="Hybrid retrieval, not pure vector"
            body="pgvector HNSW + Postgres FTS, fused via RRF, then an LLM listwise reranker. Metadata filters + entity-triggered lookups stack on top."
          />
          <FeatureCard
            icon={<Pencil className="h-4 w-4" />}
            title="Every chunk is editable"
            body="Click a node, fix the sentence, save. The chunk re-embeds, the graph updates. No CI, no redeploys, no prompt engineering."
          />
          <FeatureCard
            icon={<Link2 className="h-4 w-4" />}
            title="Edges the graph earned"
            body="Co-retrieval edges grow from real reply logs. Over time the graph shows which chunks actually answer questions — not just which ones we indexed."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Reveal className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        {icon}
      </div>
      <div className="text-[14px] font-semibold tracking-tight text-foreground">
        {title}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </Reveal>
  );
}
