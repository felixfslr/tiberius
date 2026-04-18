import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import {
  computeAgentStatus,
  getAgentStats,
  listAgents,
} from "@/lib/services/agents";
import { getWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agents = await listAgents().catch(() => []);

  // Detect active agent from the URL so we can resolve its live status
  const h = await headers();
  const pathname = h.get("x-pathname") ?? h.get("x-invoke-path") ?? "";
  const activeAgent =
    agents.find((a) => pathname.startsWith(`/agents/${a.id}`)) ?? null;

  let activeLive: "live" | "draft" = "draft";
  if (activeAgent) {
    const stats = await getAgentStats(activeAgent.id).catch(() => null);
    if (stats) activeLive = computeAgentStatus(stats);
  }

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar
        userEmail={user.email ?? null}
        workspace={getWorkspace()}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        activeAgentLive={activeLive}
      />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
