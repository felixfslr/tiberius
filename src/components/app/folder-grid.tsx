"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Inbox, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { FolderCard, NewFolderTile } from "./folder-card";

export type FolderRow = {
  id: string;
  name: string;
  file_count: number;
};

export function FolderGrid({
  agentId,
  folders,
  unsortedCount,
}: {
  agentId: string;
  folders: FolderRow[];
  unsortedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {unsortedCount > 0 ? (
        <FolderCard
          href={`/agents/${agentId}/knowledge?folder=unsorted`}
          name="Unsorted"
          fileCount={unsortedCount}
          variant="unsorted"
        />
      ) : null}

      {folders.map((f) =>
        editingId === f.id ? (
          <div
            key={f.id}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5"
          >
            <div className="mx-auto flex h-32 items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Pencil className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 w-full">
              <Input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(f.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => rename(f.id)}
                disabled={pending}
                className="text-center"
              />
            </div>
          </div>
        ) : (
          <FolderCard
            key={f.id}
            href={`/agents/${agentId}/knowledge?folder=${f.id}`}
            name={f.name}
            fileCount={f.file_count}
            onRename={() => {
              setEditName(f.name);
              setEditingId(f.id);
            }}
            onDelete={() => remove(f.id, f.name)}
          />
        ),
      )}

      <NewFolderTile agentId={agentId} />
    </div>
  );
}

// Compact chevron-back header used inside a folder
export function FolderActionsMenu({
  agentId,
  folderId,
  folderName,
}: {
  agentId: string;
  folderId: string;
  folderName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folderName);

  function submit() {
    const name = draft.trim();
    if (!name || name === folderName) {
      setEditing(false);
      setDraft(folderName);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body?.error?.message ?? "Rename failed");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (
      !confirm(
        `Delete folder "${folderName}"? Files inside fall back to Unsorted (not deleted).`,
      )
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders/${folderId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body?.error?.message ?? "Delete failed");
        return;
      }
      toast.success("Folder deleted");
      router.push(`/agents/${agentId}/knowledge`);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(folderName);
          }
        }}
        onBlur={submit}
        disabled={pending}
        className="h-9 w-64 text-base font-semibold"
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" disabled={pending} />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Rename folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={remove}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UnsortedIcon() {
  return <Inbox className="h-5 w-5" />;
}
