"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Copy, ExternalLink, Terminal } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const CURL_SAMPLE = `curl -X POST "$TIB_BASE/api/v1/agents/$TIB_AGENT/reply" \\
  -H "Authorization: Bearer $TIB_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trigger_message": "Hey, what does Ivy charge for USDC pay-ins? We do ~$50M/mo EU.",
    "history": [
      {"role": "assistant", "content": "Hi — Felix from Ivy, saw your USDC volume is growing."}
    ]
  }'

# → {
#     "reply_text": "Thanks — at that volume, pricing would be custom. …",
#     "confidence": 0.87,
#     "confidence_breakdown": { "retrieval": 0.99, "groundedness": 0.80 },
#     "detected_intent": "pricing",
#     "suggested_tool": "send_calendly_link"
#   }`;

const MCP_SAMPLE = `{
  "mcpServers": {
    "asktiberius": {
      "command": "npx",
      "args": ["-y", "@asktiberius/mcp"],
      "env": {
        "ASKTIBERIUS_AGENT": "ae3becab-aac4-47ca-b17a-42ed39de4650",
        "ASKTIBERIUS_KEY": "tib_..."
      }
    }
  }
}

// Tools exposed to Claude / ChatGPT / Cursor:
//   draft_reply(trigger_message, history?)
//   search_knowledge(query, top_k?)
//   list_chunks(filter?)
//   edit_chunk(id, new_content)`;

type Tab = "curl" | "mcp";

export function ApiFirstSection() {
  const [tab, setTab] = useState<Tab>("curl");
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = tab === "curl" ? CURL_SAMPLE : MCP_SAMPLE;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <section id="api" className="relative px-5 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[0.95fr_1.1fr] lg:items-center">
        <Reveal className="flex flex-col gap-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            /api-first · mcp-first
          </div>
          <h2
            className="font-heading font-black tracking-[-0.035em] text-foreground"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)", lineHeight: 1 }}
          >
            API-first.
            <br />
            MCP-first.
            <br />
            <span className="text-muted-foreground">Human-last.</span>
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Most AI tools are UIs dragging an API behind them. asktiberius was
            API-first on day zero — the exact endpoints the web app uses are
            your endpoints too:{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-foreground">
              /api/v1/*
            </code>
            , Bearer-auth, OpenAPI spec, Swagger UI.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            And because MCP is just the next layer over HTTP APIs, every
            asktiberius agent will ship as an MCP server — drop it into Claude,
            ChatGPT, Cursor, or your own agent stack and your knowledge graph
            becomes a first-class tool.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <LinkChip href="/api/docs/ui" label="Swagger UI" external />
            <LinkChip href="/api/docs" label="OpenAPI JSON" external />
            <LinkChip
              href="https://github.com/anthropics"
              label="MCP spec"
              external
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_30px_100px_-20px_oklch(0.7_0.19_285/0.4)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <Terminal className="h-3 w-3" />
                asktiberius · quickstart
              </div>
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
                <TabButton
                  active={tab === "curl"}
                  onClick={() => setTab("curl")}
                >
                  curl
                </TabButton>
                <TabButton active={tab === "mcp"} onClick={() => setTab("mcp")}>
                  mcp.json
                  <span className="ml-1 rounded-sm bg-primary/20 px-1 font-mono text-[9px] tracking-wide text-primary">
                    beta
                  </span>
                </TabButton>
              </div>
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10.5px] text-muted-foreground transition hover:text-foreground"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" /> copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> copy
                  </>
                )}
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.pre
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-relaxed text-foreground/85"
              >
                <code>{tab === "curl" ? CURL_SAMPLE : MCP_SAMPLE}</code>
              </motion.pre>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center rounded-full px-3 py-1 font-mono text-[11px] transition-colors",
        active
          ? "bg-white/10 text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LinkChip({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {label}
      {external ? <ExternalLink className="h-3 w-3" /> : null}
    </a>
  );
}
