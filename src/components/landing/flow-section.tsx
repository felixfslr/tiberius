"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import {
  MessageSquareText,
  Workflow,
  Boxes,
  Sparkles,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./reveal";

type Step = {
  title: string;
  body: string;
  code: string;
  icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    title: "Message in",
    body: "Prospect pings you on WhatsApp, Telegram, Intercom, or your own widget. Forward the payload to /reply.",
    code: `trigger_message: "What's pricing for $50M/mo USDC?"`,
    icon: MessageSquareText,
  },
  {
    title: "Hybrid retrieve",
    body: "pgvector HNSW + Postgres FTS fused via Reciprocal Rank Fusion, plus entity-triggered + metadata-filtered lookups.",
    code: `retrieved: 17 chunks · RRF top-25 → LLM rerank → top-7`,
    icon: Workflow,
  },
  {
    title: "Fill slots",
    body: "Facts, SOPs, ToV examples, similar past convos, state, history — each slot populated from retrieval, citeable by tag.",
    code: `slots: [kb-3, sop-1, tov-2, convo-5]`,
    icon: Boxes,
  },
  {
    title: "Draft",
    body: "The generator drafts a reply grounded in the slots, with inline citations the sales op can double-check in one click.",
    code: `reply_text: "At $50M/mo pricing is custom — [sop-1]…"`,
    icon: Sparkles,
  },
  {
    title: "Score",
    body: "Multi-signal confidence: retrieval coverage, intent classifier, LLM-judged groundedness, self-consistency. Below threshold → flag.",
    code: `confidence: 0.87 · below_threshold: false`,
    icon: Gauge,
  },
];

export function FlowSection() {
  return (
    <section id="flow" className="relative px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-col gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            /the flow
          </div>
          <h2
            className="font-heading font-black tracking-[-0.035em] text-foreground"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)", lineHeight: 1 }}
          >
            One API call. Five stages. Sub-second.
          </h2>
          <p className="max-w-2xl text-[15px] text-muted-foreground">
            Tiberius isn&apos;t a wrapper around a chat model. It&apos;s a
            deterministic retrieval pipeline that feeds the generator exactly
            the context a human op would pull — and scores the result before
            anyone sees it.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {STEPS.map((s, i) => (
            <StepCard
              key={s.title}
              step={s}
              index={i}
              last={i === STEPS.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  index,
  last,
}: {
  step: Step;
  index: number;
  last: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const Icon = step.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, rotateX: 12 }}
      animate={
        inView ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 28 }
      }
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ transformStyle: "preserve-3d" }}
      className="group relative flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-white/[0.05]"
    >
      {/* Connector */}
      {!last && (
        <motion.svg
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-full z-10 hidden h-10 w-8 -translate-y-1/2 lg:block"
          viewBox="0 0 32 40"
          fill="none"
        >
          <motion.path
            d="M 0 20 L 32 20"
            stroke="oklch(0.7 0.19 285 / 0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3 3"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 0.6, delay: 0.35 + index * 0.1 }}
          />
          <motion.circle
            cx="30"
            cy="20"
            r="2.2"
            fill="oklch(0.7 0.19 285)"
            initial={{ scale: 0 }}
            animate={inView ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 0.35, delay: 0.9 + index * 0.1 }}
          />
        </motion.svg>
      )}

      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 text-primary ring-1 ring-primary/30">
          <Icon className="h-4 w-4" />
        </div>
        <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
          0{index + 1}
        </div>
      </div>

      <div className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">
        {step.title}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {step.body}
      </p>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2.5 font-mono text-[10.5px] leading-snug text-foreground/80">
        {step.code}
      </div>
    </motion.div>
  );
}
