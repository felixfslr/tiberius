"use client";

import dynamic from "next/dynamic";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// R3F uses browser-only APIs. Skip SSR; the radial aura backplate in
// Oceanus3D covers the empty space while the canvas mounts.
const Oceanus3D = dynamic(
  () => import("./oceanus-3d").then((m) => m.Oceanus3D),
  { ssr: false, loading: () => null },
);

export function Hero() {
  return (
    <section className="relative isolate pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 20% 30%, oklch(0.7 0.19 285 / 0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 85% 70%, oklch(0.68 0.17 245 / 0.12), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
        <div className="flex flex-col gap-7">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-wide text-muted-foreground backdrop-blur"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            API-first reply drafting · public beta
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="font-heading font-black tracking-[-0.04em] text-foreground"
            style={{
              fontSize: "clamp(2.6rem, 6.4vw, 5.8rem)",
              lineHeight: 0.95,
            }}
          >
            ask
            <span className="bg-gradient-to-br from-primary via-primary to-[oklch(0.78_0.14_325)] bg-clip-text text-transparent">
              tiberius
            </span>
            <br />
            <span className="text-muted-foreground">anything.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="max-w-xl text-[17px] leading-relaxed text-muted-foreground md:text-[18px]"
          >
            Every conversation. Every objection. Every SOP, pricing sheet,
            tone-of-voice example your team ever wrote — welded into one
            editable knowledge graph, exposed as one API, grounded in every
            reply.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.42 }}
            className="flex flex-wrap items-center gap-3"
          >
            <a
              href="/api/docs/ui"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group h-11 rounded-full px-5 text-[14px] shadow-[0_0_0_1px_oklch(0.7_0.19_285/0.5),0_12px_32px_-8px_oklch(0.7_0.19_285/0.55)] transition-all hover:shadow-[0_0_0_1px_oklch(0.7_0.19_285/0.7),0_14px_40px_-6px_oklch(0.7_0.19_285/0.7)]",
              )}
            >
              Try the API
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#graph"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "h-11 rounded-full px-5 text-[14px] text-muted-foreground hover:text-foreground",
              )}
            >
              See the graph
            </a>
            <div className="font-mono text-[11px] text-muted-foreground">
              <code className="rounded bg-white/5 px-1.5 py-0.5">
                POST /api/v1/agents/:id/reply
              </code>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.8 }}
            className="flex items-center gap-5 pt-2 font-mono text-[11px] text-muted-foreground"
          >
            <Metric value="~300ms" label="retrieval p95" />
            <Separator />
            <Metric value="14" label="chunkers" />
            <Separator />
            <Metric value="~95%" label="groundedness" />
          </motion.div>
        </div>

        <div className="relative h-[420px] w-full lg:h-[560px]">
          <Oceanus3D className="h-full w-full" />
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function Separator() {
  return <span className="text-muted-foreground/40">·</span>;
}
