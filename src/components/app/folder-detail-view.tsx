"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Inbox, Search, Trash2 } from "lucide-react";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.filename.toLowerCase().includes(q));
  }, [files, search]);

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
        `/api/v1/agents/${agentId}/folders/${currentFolderId}`,
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
        `/api/v1/agents/${agentId}/folders/${currentFolderId}`,
        { method: "DELETE" },
      );
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

  function onFileDelete(fileId: string, filename: string) {
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

  function onFileReprocess(fileId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/files/${fileId}`, {
        method: "POST",
      });
      if (res.ok) toast.success("Reprocessing queued");
      else toast.error("Reprocess failed");
    });
  }

  function onFileMove(fileId: string, folderId: string | null) {
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

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href={`/agents/${agentId}/knowledge`}
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
                    ? `/agents/${agentId}/knowledge?folder=unsorted`
                    : `/agents/${agentId}/knowledge?folder=${p.id}`
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
                {filtered.map((r) => (
                  <TableRow key={r.id} className="group">
                    <TableCell>
                      <Link
                        href={`/agents/${agentId}/knowledge/files/${r.id}`}
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
                ))}
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
