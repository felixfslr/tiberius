import { notFound } from "next/navigation";
import { listKeys } from "@/lib/services/keys";
import { getAgent } from "@/lib/services/agents";
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
import { CodeBlock } from "@/components/app/code-block";
import { StatusPill } from "@/components/app/status-pill";
import { relativeFromNow } from "@/lib/format/time";
import { getAppUrl } from "@/lib/urls";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  const keys = await listKeys(id);

  const host = getAppUrl();
  const curl = `curl -X POST "${host}/api/v1/agents/${id}/reply" \\
  -H "Authorization: Bearer tib_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trigger_message": "What does Ivy charge for USDC pay-ins?",
    "history": []
  }'`;

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Bearer tokens for external callers — n8n, Make, internal scripts. The
          full value is shown exactly once when created; after that only the
          prefix is visible. Scopes limit which endpoints a key can hit.
        </p>
        <a
          href="/api/docs/ui"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Full API reference
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {keys.length} {keys.length === 1 ? "key" : "keys"}
          </span>
          <CreateKeyForm agentId={id} />
        </div>

        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scope</TableHead>
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
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No keys yet. Create one to start calling the API.
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
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        reply
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
                      <RevokeKeyButton
                        agentId={id}
                        keyId={k.id}
                        keyName={k.name}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <CodeBlock
          title="Example — POST /api/v1/agents/{id}/reply"
          language="bash"
          code={curl}
        />
      </section>
    </div>
  );
}
