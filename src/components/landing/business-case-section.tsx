"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, motion } from "motion/react";
import {
  Briefcase,
  HeadphonesIcon,
  HeartHandshake,
  LifeBuoy,
  Truck,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./reveal";

type UseCase = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const CASES: UseCase[] = [
  {
    title: "B2B Sales",
    body: "Outbound reps replying on WhatsApp / Telegram / LinkedIn need the right pricing, ToV, and SOP in three seconds.",
    icon: Briefcase,
  },
  {
    title: "Customer Support",
    body: "Tier-1 agents covering thousands of tickets a week can't memorize every product page — but the graph can.",
    icon: HeadphonesIcon,
  },
  {
    title: "Partner Success",
    body: "CSMs draft check-ins that pull the partner's usage, last QBR, and open tickets without switching tabs.",
    icon: HeartHandshake,
  },
  {
    title: "Internal Help Desk",
    body: "Employees ping HR / IT / Finance over Slack. One graph per function, answers that cite the actual policy.",
    icon: LifeBuoy,
  },
  {
    title: "Recruiting",
    body: "Sourcers mirror the candidate's tone, pull the most recent JD, and keep the story consistent across 40 replies/day.",
    icon: UserRoundSearch,
  },
  {
    title: "Field Ops",
    body: "Dispatch + technicians answering from the cab. Chunks land on mobile as clean, grounded text — no hallucinated part numbers.",
    icon: Truck,
  },
];

type Metric = {
  value: number;
  suffix: string;
  label: string;
  format?: "ms" | "percent" | "count";
};

const METRICS: Metric[] = [
  { value: 300, suffix: "ms", label: "retrieval p95", format: "ms" },
  { value: 14, suffix: "", label: "content-type chunkers", format: "count" },
  {
    value: 95,
    suffix: "%",
    label: "groundedness (eval set)",
    format: "percent",
  },
];

export function BusinessCaseSection() {
  return (
    <section id="business" className="relative px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-col gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            /business case
          </div>
          <h2
            className="font-heading font-black tracking-[-0.035em] text-foreground"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)", lineHeight: 1 }}
          >
            Wherever humans
            <br />
            <span className="text-muted-foreground">reply to humans.</span>
          </h2>
          <p className="max-w-2xl text-[15px] text-muted-foreground">
            Sales was the wedge. The pattern is universal: any chat-based job
            where an op needs the right context in three seconds, cites a
            source, and moves on.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <Reveal
              key={c.title}
              delay={i * 0.05}
              className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-primary/30"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                <c.icon className="h-4 w-4" />
              </div>
              <div className="text-[15px] font-semibold tracking-tight text-foreground">
                {c.title}
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </Reveal>
          ))}
        </div>

        <MetricsBand />
      </div>
    </section>
  );
}

function MetricsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <div
      ref={ref}
      className="mt-16 grid grid-cols-1 gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/[0.02] to-white/[0.02] p-8 md:grid-cols-3"
    >
      {METRICS.map((m, i) => (
        <CountUpTile key={m.label} metric={m} active={inView} delay={i * 0.2} />
      ))}
    </div>
  );
}

function CountUpTile({
  metric,
  active,
  delay,
}: {
  metric: Metric;
  active: boolean;
  delay: number;
}) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const target = metric.value;
    const duration = 1400;

    function tick(now: number) {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, delay, metric.value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col gap-1"
    >
      <div className="font-heading text-[44px] font-black tracking-[-0.04em] text-foreground md:text-[56px]">
        {metric.format === "ms" || metric.format === "percent"
          ? `~${val}${metric.suffix}`
          : `${val}${metric.suffix}`}
      </div>
      <div className="font-mono text-[12px] text-muted-foreground">
        {metric.label}
      </div>
    </motion.div>
  );
}
