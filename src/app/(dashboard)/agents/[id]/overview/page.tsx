import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  Database,
  FileCheck2,
  KeyRound,
  MessageSquare,
  Target,
} from "lucide-react";
import { getAgent, getAgentStats } from "@/lib/services/agents";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  const stats = await getAgentStats(id).catch(() => null);

  const cfg = agent.config;

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      {agent.description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">
          {agent.description}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FileCheck2 className="h-4 w-4" />}
          label="Files ready"
          value={stats?.files_ready ?? 0}
          sub={`of ${stats?.files_total ?? 0} total`}
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="Chunks"
          value={stats?.chunks ?? 0}
          sub="indexed for retrieval"
        />
        <StatCard
          icon={<KeyRound className="h-4 w-4" />}
          label="API keys"
          value={stats?.keys ?? 0}
          sub={stats?.keys ? "callable" : "no keys yet"}
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Threshold"
          value={cfg.confidence_threshold.toFixed(2)}
          sub="confidence gate"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Configuration
          </h2>
          <Link
            href={`/agents/${id}/config`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit config →
          </Link>
        </div>
        <Card className="divide-y divide-border overflow-hidden p-0 shadow-sm">
          <ConfigRow label="Goal" value={cfg.goal} />
          <ConfigRow label="Tone" value={cfg.tone} />
          <ConfigRow label="Response length" value={cfg.response_length} />
          <ConfigRow label="Pushiness" value={cfg.pushiness} />
          <ConfigRow
            label="Calendly URL"
            value={cfg.calendly_url ?? "—"}
            mono={!!cfg.calendly_url}
          />
          <ConfigRow label="Folders" value={`${stats?.folders ?? 0}`} />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickLink
          href={`/agents/${id}/knowledge`}
          icon={<BookOpen className="h-5 w-5" />}
          title="Knowledge"
          description="Upload files, organize into folders, inspect chunks."
        />
        <QuickLink
          href={`/agents/${id}/playground`}
          icon={<MessageSquare className="h-5 w-5" />}
          title="Playground"
          description="Test replies, inspect retrieval trace and confidence."
        />
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
      {sub ? (
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      ) : null}
    </Card>
  );
}

function ConfigRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={buttonVariants({
        variant: "outline",
        className:
          "!h-auto flex-col !items-start gap-2 whitespace-normal p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md",
      })}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <div className="font-semibold">{title}</div>
        <div className="text-xs font-normal text-muted-foreground">
          {description}
        </div>
      </div>
    </Link>
  );
}
