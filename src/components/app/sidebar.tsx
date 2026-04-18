import Link from "next/link";
import { headers } from "next/headers";
import {
  BookOpen,
  Bot,
  LogOut,
  MessageSquare,
  Settings,
  KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listAgents } from "@/lib/services/agents";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function pathnameFromHeaders(h: Headers): string {
  // Next exposes request pathname via x-invoke-path or x-pathname; fall back to "/".
  return h.get("x-invoke-path") ?? h.get("x-pathname") ?? "/";
}

export async function Sidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const agents = await listAgents().catch(() => []);
  const h = await headers();
  const pathname = pathnameFromHeaders(h);

  const activeAgent =
    agents.find((a) => pathname.startsWith(`/agents/${a.id}`)) ?? null;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <span className="font-semibold tracking-tight">Tiberius</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 text-sm">
        <SidebarLink
          href="/agents"
          active={pathname === "/agents"}
          icon={<Bot className="h-4 w-4" />}
        >
          All agents
        </SidebarLink>

        {activeAgent ? (
          <>
            <Separator className="my-3" />
            <div className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {activeAgent.name}
            </div>
            <SidebarLink
              href={`/agents/${activeAgent.id}/knowledge`}
              active={pathname.startsWith(`/agents/${activeAgent.id}/knowledge`)}
              icon={<BookOpen className="h-4 w-4" />}
            >
              Knowledge
            </SidebarLink>
            <SidebarLink
              href={`/agents/${activeAgent.id}/playground`}
              active={pathname.startsWith(`/agents/${activeAgent.id}/playground`)}
              icon={<MessageSquare className="h-4 w-4" />}
            >
              Playground
            </SidebarLink>
            <SidebarLink
              href={`/agents/${activeAgent.id}/api-keys`}
              active={pathname.startsWith(`/agents/${activeAgent.id}/api-keys`)}
              icon={<KeyRound className="h-4 w-4" />}
            >
              API keys
            </SidebarLink>
            <SidebarLink
              href={`/agents/${activeAgent.id}/config`}
              active={pathname.startsWith(`/agents/${activeAgent.id}/config`)}
              icon={<Settings className="h-4 w-4" />}
            >
              Config
            </SidebarLink>
          </>
        ) : null}
      </nav>

      <div className="border-t p-3 text-sm">
        <div className="truncate text-xs text-muted-foreground">
          {user?.email}
        </div>
        <form action="/auth/signout" method="post" className="mt-2">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 transition",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
