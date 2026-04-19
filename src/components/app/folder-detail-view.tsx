"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Inbox, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { FolderInput, MoreHorizontal, RefreshCw } from "lucide-react";
import { CreateFolderDialog } from "./create-folder-dialog";
import { FolderTable, type FolderTableRow } from "./folder-table";
import { UploadDialog } from "./upload-dialog";
import { TypeChip } from "./type-chip";
import { FileStatusBadge } from "./file-status-badge";
import { StatusPill } from "./status-pill";
import { relativeFromNow } from "@/lib/format/time";
import { cn } from "@/lib/utils";

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
  chunks_count: number;
};

export function FolderDetailView({
  agentId,
  agentName,
  path,
  description,
  updatedAt,
  currentFolderId,
  subfolders,
  files,
  isUnsorted = false,
}: {
  agentId: string;
  agentName: string;
  path: { id: string; name: string }[];
  description: string | null;
  updatedAt?: string;
  currentFolderId?: string;
  subfolders: FolderTableRow[];
  files: FileRow[];
  isUnsorted?: boolean;
}) {
  const router = useRouter();
  const current = path[path.length - 1]!;
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.filename.toLowerCase().includes(q));
  }, [files, search]);

  // Drop selection when the file set changes underneath us (e.g. nav between folders).
  useEffect(() => {
    setSelected((s) => {
      if (s.size === 0) return s;
      const ids = new Set(files.map((f) => f.id));
      const next = new Set<string>();
      for (const id of s) if (ids.has(id)) next.add(id);
      return next.size === s.size ? s : next;
    });
  }, [files]);

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
          fetch(`/api/v1/app/agents/${agentId}/files/${id}`, {
            method: "DELETE",
          }),
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
          fetch(`/api/v1/app/agents/${agentId}/files/${id}`, {
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

  function saveDescription() {
    if (!currentFolderId) {
      setEditingDesc(false);
      return;
    }
    const trimmed = descDraft.trim();
    const normalized = description ?? "";
    if (trimmed === normalized) {
      setEditingDesc(false);
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/app/agents/${agentId}/folders/${currentFolderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: trimmed || null }),
        },
      );
      if (!res.ok) {
        const body = await res.json();
        toast.error(body?.error?.message ?? "Save failed");
        return;
      }
      setEditingDesc(false);
      router.refresh();
    });
  }

  function deleteFolder() {
    if (!currentFolderId) return;
    if (
      !confirm(
        `Delete folder "${current.name}"? Nested subfolders are also deleted; files fall back to Unsorted.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/app/agents/${agentId}/folders/${currentFolderId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json();
        toast.error(body?.error?.message ?? "Delete failed");
        return;
      }
      toast.success("Folder deleted");
      router.push(`/app/agents/${agentId}/knowledge`);
      router.refresh();
    });
  }

  function onFileDelete(fileId: string, filename: string) {
    if (
      !confirm(`Delete ${filename}? All chunks for this file will be removed.`)
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/app/agents/${agentId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Deleted");
        router.refresh();
      } else toast.error("Delete failed");
    });
  }

  function onFileReprocess(fileId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/app/agents/${agentId}/files/${fileId}`, {
        method: "POST",
      });
      if (res.ok) toast.success("Reprocessing queued");
      else toast.error("Reprocess failed");
    });
  }

  function onFileMove(fileId: string, folderId: string | null) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/app/agents/${agentId}/files/${fileId}`, {
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

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href={`/app/agents/${agentId}/knowledge`}
          className="text-primary hover:underline"
        >
          Knowledge
        </Link>
        {path.map((p, i) => (
          <span
            key={p.id}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <span>/</span>
            {i === path.length - 1 ? (
              <span className="text-foreground">{p.name}</span>
            ) : (
              <Link
                href={
                  p.id === "unsorted"
                    ? `/app/agents/${agentId}/knowledge?folder=unsorted`
                    : `/app/agents/${agentId}/knowledge?folder=${p.id}`
                }
                className="hover:text-foreground"
              >
                {p.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {current.name}
          </h1>
          {isUnsorted ? null : editingDesc ? (
            <Textarea
              autoFocus
              rows={2}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={saveDescription}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  saveDescription();
                if (e.key === "Escape") {
                  setEditingDesc(false);
                  setDescDraft(description ?? "");
                }
              }}
              placeholder="Describe what this folder is for…"
              className="max-w-2xl text-sm"
            />
          ) : description ? (
            <button
              type="button"
              onClick={() => setEditingDesc(true)}
              className="max-w-2xl text-left text-sm text-foreground/80 hover:text-foreground"
            >
              {description}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditingDesc(true)}
              className="max-w-2xl text-left text-sm italic text-muted-foreground hover:text-foreground"
            >
              Add description…
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isUnsorted ? (
              <StatusPill variant="draft" label="loose" />
            ) : (
              <StatusPill variant="shared" />
            )}
            <span>·</span>
            <span>
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
            {updatedAt ? (
              <>
                <span>·</span>
                <span>updated {relativeFromNow(new Date(updatedAt))}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isUnsorted && currentFolderId ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={deleteFolder}
              disabled={pending}
              aria-label="Delete folder"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <UploadDialog
            agentId={agentId}
            folderId={isUnsorted ? null : (currentFolderId ?? null)}
            folderName={isUnsorted ? undefined : current.name}
          />
        </div>
      </div>

      {/* Subfolders section */}
      {!isUnsorted && currentFolderId ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Folders
            </h2>
            <CreateFolderDialog
              agentId={agentId}
              parentId={currentFolderId}
              variant="outline"
            />
          </div>
          {subfolders.length > 0 ? (
            <FolderTable agentId={agentId} rows={subfolders} />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No subfolders yet.
            </div>
          )}
        </section>
      ) : null}

      {/* Files section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "file" : "files"}
            {search ? ` matching "${search}"` : ""}
          </span>
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

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
                  {subfolders.length > 0 ? <DropdownMenuSeparator /> : null}
                  {subfolders.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => onBulkMove(f.id)}
                    >
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

        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              {isUnsorted ? (
                <Inbox className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              {search
                ? "No files match this search."
                : "No files here yet. Upload something to feed the agent."}
            </div>
          </Card>
        ) : (
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
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-20">Chunks</TableHead>
                  <TableHead className="w-24">Size</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-28">Added</TableHead>
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
                          href={`/app/agents/${agentId}/knowledge/files/${r.id}`}
                          className="flex items-center gap-2 font-medium hover:text-primary"
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
                      <TableCell>
                        <TypeChip type={r.file_type} />
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {r.chunks_count}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatBytes(r.size_bytes)}
                      </TableCell>
                      <TableCell>
                        <FileStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {relativeFromNow(new Date(r.uploaded_at))}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={pending}
                                className={cn(
                                  "h-7 w-7 opacity-0 group-hover:opacity-100",
                                )}
                              />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
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
                                  onClick={() => onFileMove(r.id, null)}
                                  disabled={r.folder_id === null}
                                >
                                  Unsorted
                                </DropdownMenuItem>
                                {subfolders.length > 0 ? (
                                  <DropdownMenuSeparator />
                                ) : null}
                                {subfolders.map((f) => (
                                  <DropdownMenuItem
                                    key={f.id}
                                    onClick={() => onFileMove(r.id, f.id)}
                                    disabled={r.folder_id === f.id}
                                  >
                                    {f.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                              onClick={() => onFileReprocess(r.id)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onFileDelete(r.id, r.filename)}
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
        )}
      </section>

      {/* agent-name muted footer to explain context */}
      <div className="text-xs text-muted-foreground">
        Knowledge base of{" "}
        <span className="font-medium text-foreground">{agentName}</span>
      </div>
    </div>
  );
}

function formatBytes(b: number | null): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
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
