import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { listAgents } from "@/lib/services/agents";

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

  return (
    <div className="flex min-h-svh">
      <Sidebar
        userEmail={user.email ?? null}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
