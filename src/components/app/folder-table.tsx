"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  Inbox,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeFromNow } from "@/lib/format/time";

export type FolderTableRow = {
  id: string;
  name: string;
  file_count: number;
  sub_count?: number;
  updated_at: string;
};

export function FolderTable({
  agentId,
  rows,
  unsortedCount,
  includeUnsorted = false,
  empty,
}: {
  agentId: string;
  rows: FolderTableRow[];
  unsortedCount?: number;
  includeUnsorted?: boolean;
  empty?: React.ReactNode;
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
        `Delete folder "${name}"? Nested subfolders are also deleted; files fall back to Unsorted.`,
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

  const nothing =
    rows.length === 0 && !(includeUnsorted && (unsortedCount ?? 0) > 0);
  if (nothing) return <>{empty ?? null}</>;

  return (
    <Card className="overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Files</TableHead>
            <TableHead className="w-40">Updated</TableHead>
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {includeUnsorted && (unsortedCount ?? 0) > 0 ? (
            <TableRow className="group">
              <TableCell>
                <Link
                  href={`/agents/${agentId}/knowledge?folder=unsorted`}
                  className="flex items-center gap-2.5 font-medium"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Inbox className="h-4 w-4" />
                  </span>
                  Unsorted
                </Link>
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {unsortedCount}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">—</TableCell>
              <TableCell />
            </TableRow>
          ) : null}

          {rows.map((f) => (
            <TableRow key={f.id} className="group">
              <TableCell>
                {editingId === f.id ? (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FolderOpen className="h-4 w-4" />
                    </span>
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
                      className="h-8 w-64 text-sm"
                    />
                  </div>
                ) : (
                  <Link
                    href={`/agents/${agentId}/knowledge?folder=${f.id}`}
                    className="flex items-center gap-2.5 font-medium group-hover:text-primary"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary transition group-hover:bg-primary/15">
                      <Folder className="h-4 w-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{f.name}</span>
                      {f.sub_count && f.sub_count > 0 ? (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {f.sub_count} subfolder
                          {f.sub_count === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                )}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {f.file_count}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {relativeFromNow(new Date(f.updated_at))}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      />
                    }
                  >
                    <MoreHorizontal className="h-4 w-4" />
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
