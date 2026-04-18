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
import { PageHeader } from "@/components/app/page-header";

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

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${id}/knowledge`, label: agent.name },
        ]}
        title="API keys"
        description="Use a key with Authorization: Bearer <key> to call this agent from n8n, Make, or any HTTP client."
        actions={<CreateKeyForm agentId={id} />}
      />

      <Card className="overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                  <TableCell className="text-sm text-muted-foreground">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleString()
                      : "never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(k.created_at).toLocaleDateString()}
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
    </div>
  );
}
