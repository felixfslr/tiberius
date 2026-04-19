"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Renders the Claude Desktop / ChatGPT config snippet so the user can paste it
 * into their MCP client. Uses `tib_…` as a placeholder — the user substitutes
 * their own key that they copied at creation time.
 */
export function McpConnectSnippet({
  serverName,
  url,
}: {
  serverName: string;
  url: string;
}) {
  const snippet = JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          url,
          headers: { Authorization: "Bearer tib_…" },
        },
      },
    },
    null,
    2,
  );

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
