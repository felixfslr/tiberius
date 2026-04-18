import Link from "next/link";
import { Bot } from "lucide-react";
import { listAgents } from "@/lib/services/agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateAgentDialog } from "@/components/app/create-agent-dialog";
import { AgentRowActions } from "@/components/app/agent-row-actions";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await listAgents();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Each agent has its own knowledge base, config, and API keys.
          </p>
        </div>
        <CreateAgentDialog />
      </header>

      {agents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" /> No agents yet
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create your first agent to start drafting replies.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Tone</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/agents/${a.id}/knowledge`}
                      className="font-medium hover:underline"
                    >
                      {a.name}
                    </Link>
                    {a.description ? (
                      <div className="text-xs text-muted-foreground">{a.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{a.config.goal}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{a.config.tone}</TableCell>
                  <TableCell className="text-sm">{a.config.confidence_threshold}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <AgentRowActions agentId={a.id} agentName={a.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
