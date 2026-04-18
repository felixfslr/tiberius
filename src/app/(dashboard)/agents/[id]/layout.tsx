import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgent } from "@/lib/services/agents";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "knowledge", label: "Knowledge" },
  { href: "playground", label: "Playground" },
  { href: "api-keys", label: "API keys" },
  { href: "config", label: "Config" },
] as const;

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{agent.name}</h1>
            {agent.description ? (
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            ) : null}
          </div>
        </div>
        <nav className="-mb-4 mt-3 flex gap-1 text-sm">
          {TABS.map((t) => (
            <TabLink
              key={t.href}
              href={`/agents/${id}/${t.href}`}
              segment={t.href}
            >
              {t.label}
            </TabLink>
          ))}
        </nav>
      </header>
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

function TabLink({
  href,
  segment,
  children,
}: {
  href: string;
  segment: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-t-md border-b-2 border-transparent px-3 py-2 text-muted-foreground transition-colors hover:text-foreground",
        "data-[active=true]:border-foreground data-[active=true]:text-foreground",
      )}
      data-segment={segment}
    >
      {children}
    </Link>
  );
}
