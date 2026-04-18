"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  FolderInput,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  FileText,
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

  useEffect(() => {
    setRows(initial);
  }, [initial]);

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
            setRows((r) =>
              r.filter((x) => x.id !== (payload.old as FileRow).id),
            );
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
    <Card className="overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id} className="group">
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
                      <Button variant="ghost" size="icon" disabled={pending} />
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
                          onSelect={() => onMove(r.id, null)}
                          disabled={r.folder_id === null}
                        >
                          Unsorted
                        </DropdownMenuItem>
                        {folders.length > 0 ? <DropdownMenuSeparator /> : null}
                        {folders.map((f) => (
                          <DropdownMenuItem
                            key={f.id}
                            onSelect={() => onMove(r.id, f.id)}
                            disabled={r.folder_id === f.id}
                          >
                            {f.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onSelect={() => onReprocess(r.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onDelete(r.id, r.filename)}
                      variant="destructive"
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
