"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/status-pill";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "overview", label: "Overview" },
  { segment: "knowledge", label: "Knowledge" },
  { segment: "playground", label: "Playground" },
  { segment: "api-keys", label: "API keys" },
] as const;

export function AgentHeader({
  agentId,
  agentName,
  live,
}: {
  agentId: string;
  agentName: string;
  live: "live" | "draft";
}) {
  const pathname = usePathname() ?? "";
  const active =
    TABS.find((t) => pathname.includes(`/agents/${agentId}/${t.segment}`))
      ?.segment ?? "overview";

  const [copied, setCopied] = useState(false);
  async function copyId() {
    try {
      await navigator.clipboard.writeText(agentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Agent ID copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{agentName}</h1>
          <StatusPill variant={live} />
        </div>
        <Button variant="outline" size="sm" onClick={copyId}>
          {copied ? (
            <Check className="mr-2 h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="mr-2 h-3.5 w-3.5" />
          )}
          Copy agent ID
        </Button>
      </div>
      <nav className="flex gap-1 px-8">
        {TABS.map((t) => (
          <Link
            key={t.segment}
            href={`/agents/${agentId}/${t.segment}`}
            className={cn(
              "relative -mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active === t.segment
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
