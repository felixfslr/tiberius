"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  ChevronsUpDown,
  HelpCircle,
  KeyRound,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ThemeMenuItems } from "@/components/app/theme-toggle";
import { cn } from "@/lib/utils";

type SidebarAgent = { id: string; name: string };

export function Sidebar({
  userEmail,
  agents,
}: {
  userEmail: string | null;
  agents: SidebarAgent[];
}) {
  const pathname = usePathname() ?? "/";
  const activeAgent =
    agents.find((a) => pathname.startsWith(`/agents/${a.id}`)) ?? null;
  const initials = initialsOf(userEmail);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
        </div>
        <span className="text-base font-semibold tracking-tight">Tiberius</span>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 text-left text-sm transition hover:bg-sidebar-accent/40"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            T
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Workspace
            </div>
            <div className="truncate font-medium">Tiberius</div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3 text-sm">
        <SidebarLink
          href="/agents"
          active={pathname === "/agents"}
          icon={<Bot className="h-[18px] w-[18px]" />}
        >
          Agents
        </SidebarLink>

        {activeAgent ? (
          <>
            <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {activeAgent.name}
            </div>
            <SidebarLink
              href={`/agents/${activeAgent.id}/knowledge`}
              active={pathname.startsWith(
                `/agents/${activeAgent.id}/knowledge`,
              )}
              icon={<BookOpen className="h-[18px] w-[18px]" />}
            >
              Knowledge
            </SidebarLink>
            <SidebarLink
              href={`/agents/${activeAgent.id}/playground`}
              active={pathname.startsWith(
                `/agents/${activeAgent.id}/playground`,
              )}
              icon={<MessageSquare className="h-[18px] w-[18px]" />}
            >
              Playground
            </SidebarLink>
            <SidebarLink
              href={`/agents/${activeAgent.id}/api-keys`}
              active={pathname.startsWith(`/agents/${activeAgent.id}/api-keys`)}
              icon={<KeyRound className="h-[18px] w-[18px]" />}
            >
              API keys
            </SidebarLink>
            <SidebarLink
              href={`/agents/${activeAgent.id}/config`}
              active={pathname.startsWith(`/agents/${activeAgent.id}/config`)}
              icon={<Settings className="h-[18px] w-[18px]" />}
            >
              Config
            </SidebarLink>
          </>
        ) : null}
      </nav>

      <div className="px-3 pb-2 text-sm">
        <SidebarIconButton
          icon={<Settings className="h-[18px] w-[18px]" />}
          label="Workspace settings"
        />
        <SidebarIconButton
          icon={<HelpCircle className="h-[18px] w-[18px]" />}
          label="Help"
        />
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <button
                {...props}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-sidebar-accent/40"
              />
            )}
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">
                {userEmail ?? "Unknown"}
              </div>
            </div>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <ThemeMenuItems />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem
                render={(props) => (
                  <button
                    {...props}
                    type="submit"
                    className={cn(props.className, "w-full")}
                  />
                )}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </form>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>
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
        "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function SidebarIconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function initialsOf(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[.\-_+]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
