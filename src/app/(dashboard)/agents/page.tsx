import Link from "next/link";
import { Bot, Sparkles } from "lucide-react";
import { listAgents } from "@/lib/services/agents";
import { Card } from "@/components/ui/card";
import { CreateAgentDialog } from "@/components/app/create-agent-dialog";
import { AgentRowActions } from "@/components/app/agent-row-actions";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await listAgents();

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Each agent has its own knowledge base, config, and API keys.
          </p>
        </div>
        <CreateAgentDialog />
      </header>

      {agents.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles className="h-6 w-6" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">No agents yet</h2>
            <p className="text-sm text-muted-foreground">
              Create your first agent to start drafting replies.
            </p>
          </div>
          <CreateAgentDialog />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <Card
              key={a.id}
              className="group relative overflow-hidden p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="absolute top-3 right-3 z-10">
                <AgentRowActions agentId={a.id} agentName={a.name} />
              </div>
              <Link
                href={`/agents/${a.id}/knowledge`}
                className="flex flex-col gap-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/20">
                  <Bot className="h-6 w-6" strokeWidth={2.25} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {a.name}
                  </h3>
                  {a.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {a.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>threshold {a.config.confidence_threshold}</span>
                  <span className="text-border">·</span>
                  <span>
                    created{" "}
                    {new Date(a.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
