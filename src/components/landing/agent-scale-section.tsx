"use client";

import { motion } from "motion/react";
import {
  Bot,
  Briefcase,
  HeadphonesIcon,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./reveal";

type AgentCard = {
  name: string;
  role: string;
  accent: string;
  glow: string;
  icon: LucideIcon;
  chunks: number;
  intents: string[];
};

const AGENTS: AgentCard[] = [
  {
    name: "Sales Pre-Discovery",
    role: "B2B outbound · WhatsApp + Telegram",
    accent: "oklch(0.72 0.19 285)",
    glow: "oklch(0.72 0.19 285 / 0.35)",
    icon: Briefcase,
    chunks: 412,
    intents: ["pricing", "objection", "scheduling", "timeline"],
  },
  {
    name: "Tier-1 Support",
    role: "Customer help · Intercom + Email",
    accent: "oklch(0.74 0.16 245)",
    glow: "oklch(0.74 0.16 245 / 0.35)",
    icon: HeadphonesIcon,
    chunks: 1284,
    intents: ["how-to", "bug", "billing", "refund"],
  },
  {
    name: "HR Policy Bot",
    role: "Internal · Slack DM",
    accent: "oklch(0.76 0.14 205)",
    glow: "oklch(0.76 0.14 205 / 0.35)",
    icon: Users,
    chunks: 296,
    intents: ["pto", "benefits", "onboarding"],
  },
  {
    name: "Legal Q&A",
    role: "Contract desk · Email + Teams",
    accent: "oklch(0.74 0.17 325)",
    glow: "oklch(0.74 0.17 325 / 0.35)",
    icon: Scale,
    chunks: 174,
    intents: ["nda", "dpa", "liability", "redline"],
  },
];

export function AgentScaleSection() {
  return (
    <section id="agents" className="relative px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-col gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            /agents, scaled
          </div>
          <h2
            className="font-heading font-black tracking-[-0.035em] text-foreground"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)", lineHeight: 1 }}
          >
            One agent per job.
            <br />
            <span className="text-muted-foreground">Infinite reach.</span>
          </h2>
          <p className="max-w-2xl text-[15px] text-muted-foreground">
            Each agent gets its own knowledge graph, its own config, its own API
            keys. Supabase RLS keeps tenants clean; API keys are agent-scoped so
            a support bot can&apos;t answer a legal question by accident. Spin
            up ten — or ten thousand — from the same codebase.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((a, i) => (
            <AgentTile key={a.name} agent={a} index={i} />
          ))}
        </div>

        <Reveal delay={0.15} className="mt-10">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 font-mono text-[12px] text-muted-foreground">
            <span className="text-foreground">Multi-tenant by design.</span> One
            Supabase project. N agents. M graphs. RLS on every table. Zero
            shared state between agents — and one dashboard to see them all.
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function AgentTile({ agent, index }: { agent: AgentCard; index: number }) {
  const Icon = agent.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{
        duration: 0.55,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors"
      style={{ ["--accent" as string]: agent.accent }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-80"
        style={{ background: agent.glow }}
      />

      <div className="relative flex flex-col gap-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl ring-1"
          style={{
            background: `color-mix(in oklch, ${agent.accent} 22%, transparent)`,
            color: agent.accent,
            borderColor: agent.accent,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[15px] font-semibold tracking-tight text-foreground">
            {agent.name}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {agent.role}
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
          <span className="text-foreground">
            {agent.chunks.toLocaleString()}
          </span>
          <span>chunks</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-foreground">{agent.intents.length}</span>
          <span>intents</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {agent.intents.map((it) => (
            <span
              key={it}
              className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-foreground/70"
              style={{
                borderColor: `color-mix(in oklch, ${agent.accent} 35%, transparent)`,
                background: `color-mix(in oklch, ${agent.accent} 12%, transparent)`,
              }}
            >
              {it}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Keep the icon import tidy.
void Bot;
