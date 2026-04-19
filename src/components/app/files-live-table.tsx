"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  FolderInput,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  FileText,
  X,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileStatusBadge } from "./file-status-badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type FileRow = {
  id: string;
  agent_id: string;
  folder_id: string | null;
  filename: string;
  file_type: string;
  status: string;
  error: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  processed_at: string | null;
};

type FolderOption = { id: string; name: string };

export function FilesLiveTable({
  agentId,
  initial,
  folderFilter = "all",
  folders = [],
}: {
  agentId: string;
  initial: FileRow[];
  folderFilter?: "all" | "unsorted" | string;
  folders?: FolderOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FileRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  // Drop selection when the folder filter changes — feels cleaner than letting
  // off-screen rows stay checked.
  useEffect(() => {
    setSelected(new Set());
  }, [folderFilter]);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`files-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "files",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRows((r) => [payload.new as FileRow, ...r]);
          } else if (payload.eventType === "UPDATE") {
            setRows((r) =>
              r.map((x) =>
                x.id === (payload.new as FileRow).id
                  ? (payload.new as FileRow)
                  : x,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as FileRow).id;
            setRows((r) => r.filter((x) => x.id !== deletedId));
            setSelected((s) => {
              if (!s.has(deletedId)) return s;
              const next = new Set(s);
              next.delete(deletedId);
              return next;
            });
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [agentId]);

  const filtered = useMemo(() => {
    if (folderFilter === "all") return rows;
    if (folderFilter === "unsorted")
      return rows.filter((r) => r.folder_id === null);
    return rows.filter((r) => r.folder_id === folderFilter);
  }, [rows, folderFilter]);

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleIds.some((id) => selected.has(id));
  const selectedCount = selected.size;

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected((s) => {
        const next = new Set(s);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelected((s) => {
        const next = new Set(s);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  }

  function onReprocess(fileId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/files/${fileId}`, {
        method: "POST",
      });
      if (res.ok) toast.success("Reprocessing queued");
      else toast.error("Reprocess failed");
    });
  }

  function onDelete(fileId: string, filename: string) {
    if (
      !confirm(`Delete ${filename}? All chunks for this file will be removed.`)
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Deleted");
        router.refresh();
      } else toast.error("Delete failed");
    });
  }

  function onMove(fileId: string, folderId: string | null) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (res.ok) {
        toast.success("Moved");
        router.refresh();
      } else toast.error("Move failed");
    });
  }

  function onBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} file${ids.length === 1 ? "" : "s"}? All chunks will be removed.`,
      )
    )
      return;
    startTransition(async () => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/v1/agents/${agentId}/files/${id}`, { method: "DELETE" }),
        ),
      );
      const ok = results.filter(
        (r) => r.status === "fulfilled" && r.value.ok,
      ).length;
      const failed = ids.length - ok;
      if (failed === 0)
        toast.success(`Deleted ${ok} file${ok === 1 ? "" : "s"}`);
      else if (ok === 0) toast.error(`Delete failed for all ${ids.length}`);
      else toast.warning(`Deleted ${ok}, ${failed} failed`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function onBulkMove(folderId: string | null) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/v1/agents/${agentId}/files/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: folderId }),
          }),
        ),
      );
      const ok = results.filter(
        (r) => r.status === "fulfilled" && r.value.ok,
      ).length;
      if (ok === ids.length)
        toast.success(`Moved ${ok} file${ok === 1 ? "" : "s"}`);
      else toast.warning(`Moved ${ok} of ${ids.length}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  if (filtered.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>No files here yet. Upload something to feed the agent.</div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span>{selectedCount} selected</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setSelected(new Set())}
              disabled={pending}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" disabled={pending} />
                }
              >
                <FolderInput className="mr-1.5 h-3.5 w-3.5" />
                Move to
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Move {selectedCount} to folder
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onBulkMove(null)}>
                  Unsorted
                </DropdownMenuItem>
                {folders.length > 0 ? <DropdownMenuSeparator /> : null}
                {folders.map((f) => (
                  <DropdownMenuItem key={f.id} onClick={() => onBulkMove(f.id)}>
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              disabled={pending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}
      <Card className="overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <IndeterminateCheckbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onChange={toggleAllVisible}
                  ariaLabel="Select all visible files"
                />
              </TableHead>
              <TableHead>File</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const isSelected = selected.has(r.id);
              return (
                <TableRow
                  key={r.id}
                  className="group"
                  data-state={isSelected ? "selected" : undefined}
                >
                  <TableCell className="w-10">
                    <IndeterminateCheckbox
                      checked={isSelected}
                      indeterminate={false}
                      onChange={() => toggleRow(r.id)}
                      ariaLabel={`Select ${r.filename}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/agents/${agentId}/knowledge/files/${r.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {r.filename}
                    </Link>
                    {r.error ? (
                      <div className="mt-0.5 text-xs text-destructive">
                        {r.error}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.file_type}
                  </TableCell>
                  <TableCell>
                    <FileStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.uploaded_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                          />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <FolderInput className="mr-2 h-4 w-4" /> Move to
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                              Move to folder
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => onMove(r.id, null)}
                              disabled={r.folder_id === null}
                            >
                              Unsorted
                            </DropdownMenuItem>
                            {folders.length > 0 ? (
                              <DropdownMenuSeparator />
                            ) : null}
                            {folders.map((f) => (
                              <DropdownMenuItem
                                key={f.id}
                                onClick={() => onMove(r.id, f.id)}
                                disabled={r.folder_id === f.id}
                              >
                                {f.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => onReprocess(r.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(r.id, r.filename)}
                          variant="destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={onChange}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
    />
  );
}
