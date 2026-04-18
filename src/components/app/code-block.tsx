"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CodeBlock({
  title,
  code,
  language = "bash",
  className,
}: {
  title?: string;
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCopy}
            aria-label="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : null}
      <pre className="overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}
