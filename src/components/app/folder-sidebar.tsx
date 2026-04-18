"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  Inbox,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type FolderRow = {
  id: string;
  name: string;
  file_count: number;
};

export function FolderSidebar({
  agentId,
  folders,
  activeFolder,
  totals,
}: {
  agentId: string;
  folders: FolderRow[];
  activeFolder: "all" | "unsorted" | string;
  totals: { all: number; unsorted: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function createFolder() {
    const name = draft.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Create failed");
        return;
      }
      toast.success(`Folder "${name}" created`);
      setDraft("");
      setCreating(false);
      router.refresh();
    });
  }

  function rename(id: string) {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body?.error?.message ?? "Rename failed");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string, name: string) {
    if (
      !confirm(
        `Delete folder "${name}"? Files inside fall back to Unsorted (not deleted).`,
      )
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body?.error?.message ?? "Delete failed");
        return;
      }
      toast.success("Folder deleted");
      router.refresh();
    });
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setCreating((v) => !v)}
          title="New folder"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <FolderLink
        href={`/agents/${agentId}/knowledge`}
        active={activeFolder === "all"}
        icon={<Layers className="h-[18px] w-[18px]" />}
        label="All files"
        count={totals.all}
      />
      <FolderLink
        href={`/agents/${agentId}/knowledge?folder=unsorted`}
        active={activeFolder === "unsorted"}
        icon={<Inbox className="h-[18px] w-[18px]" />}
        label="Unsorted"
        count={totals.unsorted}
      />

      {folders.length > 0 ? (
        <div className="mt-3 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Custom
        </div>
      ) : null}

      {folders.map((f) => {
        const active = activeFolder === f.id;
        if (editingId === f.id) {
          return (
            <div key={f.id} className="flex items-center gap-1 px-1">
              <Input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(f.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => rename(f.id)}
                className="h-8 text-sm"
                disabled={pending}
              />
            </div>
          );
        }
        return (
          <div key={f.id} className="group relative">
            <FolderLink
              href={`/agents/${agentId}/knowledge?folder=${f.id}`}
              active={active}
              icon={
                active ? (
                  <FolderOpen className="h-[18px] w-[18px]" />
                ) : (
                  <Folder className="h-[18px] w-[18px]" />
                )
              }
              label={f.name}
              count={f.file_count}
            />
            <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="h-6 w-6" />
                  }
                >
                  <Pencil className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditName(f.name);
                      setEditingId(f.id);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => remove(f.id, f.name)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {creating ? (
        <div className="mt-2 flex items-center gap-1 px-1">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createFolder();
              if (e.key === "Escape") {
                setCreating(false);
                setDraft("");
              }
            }}
            placeholder="Folder name"
            className="h-8 text-sm"
            disabled={pending}
          />
        </div>
      ) : null}
    </aside>
  );
}

function FolderLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          active ? "text-primary/80" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
