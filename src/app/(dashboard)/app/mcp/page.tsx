import { listWorkspaceKeys } from "@/lib/services/keys";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { CreateKeyForm } from "@/components/app/create-key-form";
import { RevokeKeyButton } from "@/components/app/revoke-key-button";
import { StatusPill } from "@/components/app/status-pill";
import { McpConnectSnippet } from "@/components/app/mcp-connect-snippet";
import { relativeFromNow } from "@/lib/format/time";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const keys = await listWorkspaceKeys();

  const host = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3007";
  const mcpUrl = `${host}/api/mcp`;

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            MCP — connect Tiberius to Claude, ChatGPT, Cursor
          </h1>
          <p className="text-sm text-muted-foreground">
            A workspace key unlocks every agent in this workspace through one
            connector. From inside Claude Desktop or ChatGPT you can then search
            and update any agent&apos;s knowledge base, and ask agents to draft
            replies — all via natural-language prompts. Agent-pinned keys for
            single-agent access live on the per-agent{" "}
            <span className="font-mono text-xs">API keys</span> tab.
          </p>
        </div>
        <a
          href="/api/docs/ui"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          API reference
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {keys.length} workspace {keys.length === 1 ? "key" : "keys"}
          </span>
          <CreateKeyForm workspace label="Create workspace key" />
        </div>

        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No workspace keys yet. Create one to connect an MCP client.
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {k.key_prefix}…
                      </code>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(k.created_at).toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.last_used_at
                        ? relativeFromNow(new Date(k.last_used_at))
                        : "never"}
                    </TableCell>
                    <TableCell>
                      <StatusPill variant="active" />
                    </TableCell>
                    <TableCell className="text-right">
                      <RevokeKeyButton keyId={k.id} keyName={k.name} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Claude Desktop</h2>
          <p className="text-sm text-muted-foreground">
            Settings → Developer → Edit Config. Paste this in, replace{" "}
            <code className="font-mono text-xs">tib_…</code> with the key you
            just copied, then restart Claude Desktop.
          </p>
        </div>
        <McpConnectSnippet serverName="tiberius" url={mcpUrl} />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">ChatGPT / Cursor / Windsurf</h2>
          <p className="text-sm text-muted-foreground">
            Any client that speaks Streamable HTTP MCP. Add a remote server at{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {mcpUrl}
            </code>{" "}
            with header{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              Authorization: Bearer tib_…
            </code>
            . Stdio-only clients can wrap it with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              npx mcp-remote
            </code>
            .
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Available tools</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <code className="font-mono text-xs">list_agents</code> — discover
            agents in this workspace
          </li>
          <li>
            <code className="font-mono text-xs">get_agent</code> — name,
            description, stats
          </li>
          <li>
            <code className="font-mono text-xs">ask_agent</code> — draft a reply
            from the agent (full pipeline)
          </li>
          <li>
            <code className="font-mono text-xs">search_knowledge</code> — hybrid
            search an agent&apos;s knowledge base
          </li>
          <li>
            <code className="font-mono text-xs">add_knowledge</code> — append a
            text chunk to the knowledge base
          </li>
          <li>
            <code className="font-mono text-xs">list_knowledge</code> /{" "}
            <code className="font-mono text-xs">delete_knowledge</code> — manage
            existing entries
          </li>
        </ul>
      </section>
    </div>
  );
}
