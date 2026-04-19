"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronsUpDown,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MessageSquareWarning,
  Moon,
  Plug,
  Sparkles,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/status-pill";
import { cn } from "@/lib/utils";

type SidebarAgent = { id: string; name: string };

export function Sidebar({
  userEmail,
  workspace,
  agents,
  activeAgentLive,
}: {
  userEmail: string | null;
  workspace?: { name: string; domain: string };
  agents: SidebarAgent[];
  activeAgentLive?: "live" | "draft";
}) {
  const pathname = usePathname() ?? "/";
  const activeAgent =
    agents.find((a) => pathname.startsWith(`/app/agents/${a.id}`)) ?? null;
  const ws = workspace ?? { name: "Tiberius", domain: "localhost:3007" };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Workspace header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-tight">
            {ws.name}
          </div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {ws.domain}
          </div>
        </div>
        <button
          type="button"
          onClick={() => toast.message("Workspace switcher coming soon")}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3 text-sm">
        <SectionLabel>Workspace</SectionLabel>
        <SidebarLink
          href="/app/agents"
          active={
            pathname === "/app/agents" || pathname.startsWith("/app/agents")
          }
          icon={<Bot className="h-[18px] w-[18px]" />}
        >
          Agents
        </SidebarLink>
        <SidebarLink
          href="/app/mcp"
          active={pathname.startsWith("/app/mcp")}
          icon={<Plug className="h-[18px] w-[18px]" />}
        >
          MCP
        </SidebarLink>

        {activeAgent ? (
          <>
            <div className="mt-5 mb-1 flex items-center justify-between px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Agent
              </span>
              <StatusPill variant={activeAgentLive ?? "draft"} />
            </div>
            <div className="px-3 pb-2 text-[13px] font-semibold tracking-tight">
              {activeAgent.name}
            </div>
            <SidebarLink
              href={`/app/agents/${activeAgent.id}/overview`}
              active={pathname.startsWith(
                `/app/agents/${activeAgent.id}/overview`,
              )}
              icon={<LayoutDashboard className="h-[18px] w-[18px]" />}
            >
              Overview
            </SidebarLink>
            <SidebarLink
              href={`/app/agents/${activeAgent.id}/knowledge`}
              active={pathname.startsWith(
                `/app/agents/${activeAgent.id}/knowledge`,
              )}
              icon={<BookOpen className="h-[18px] w-[18px]" />}
            >
              Knowledge
            </SidebarLink>
            <SidebarLink
              href={`/app/agents/${activeAgent.id}/playground`}
              active={pathname.startsWith(
                `/app/agents/${activeAgent.id}/playground`,
              )}
              icon={<MessageSquare className="h-[18px] w-[18px]" />}
            >
              Playground
            </SidebarLink>
            <SidebarLink
              href={`/app/agents/${activeAgent.id}/feedback`}
              active={pathname.startsWith(
                `/app/agents/${activeAgent.id}/feedback`,
              )}
              icon={<MessageSquareWarning className="h-[18px] w-[18px]" />}
            >
              Feedback
            </SidebarLink>
            <SidebarLink
              href={`/app/agents/${activeAgent.id}/api-keys`}
              active={pathname.startsWith(
                `/app/agents/${activeAgent.id}/api-keys`,
              )}
              icon={<KeyRound className="h-[18px] w-[18px]" />}
            >
              API keys
            </SidebarLink>
          </>
        ) : null}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {userEmail ?? "Unknown"}
          </div>
          <ThemeCycleButton />
        </div>
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  children,
  onClickIfFake,
}: {
  href: string;
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClickIfFake?: () => void;
}) {
  if (onClickIfFake) {
    return (
      <button
        type="button"
        onClick={onClickIfFake}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
        )}
      >
        {icon}
        <span>{children}</span>
      </button>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors",
        active
          ? "bg-sidebar-accent/60 text-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r bg-primary"
        />
      ) : null}
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function ThemeCycleButton() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground"
        aria-label="Theme"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
    );
  }

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";
  const nextTheme =
    theme === "system" ? "light" : theme === "light" ? "dark" : "system";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} — click for ${nextTheme}`}
    >
      {isDark ? (
        <Moon className="h-3.5 w-3.5" />
      ) : (
        <Sun className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
