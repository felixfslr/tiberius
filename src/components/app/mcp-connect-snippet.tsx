"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Copy box for an MCP config snippet. In `url`-only mode renders the plain
 * URL (what Claude Desktop's Custom Connector dialog asks for); in `json`
 * mode renders the full `mcpServers` block for config-file based clients.
 * Uses `tib_…` as the key placeholder — the user substitutes their own.
 */
export function McpConnectSnippet(
  props: { url: string } | { url: string; serverName: string },
) {
  const snippet =
    "serverName" in props
      ? JSON.stringify(
          {
            mcpServers: {
              [props.serverName]: {
                url: props.url,
                headers: { Authorization: "Bearer tib_…" },
              },
            },
          },
          null,
          2,
        )
      : props.url;

  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative rounded-md border bg-muted/40 font-mono text-xs">
      <pre className="overflow-x-auto whitespace-pre p-3 leading-relaxed">
        {snippet}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute top-2 right-2"
        onClick={copy}
      >
        {copied ? (
          <>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
          </>
        )}
      </Button>
    </div>
  );
}
