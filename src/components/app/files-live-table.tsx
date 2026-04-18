"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw, Trash2, FileText } from "lucide-react";
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
import { FileStatusBadge } from "./file-status-badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type FileRow = {
  id: string;
  agent_id: string;
  filename: string;
  file_type: string;
  status: string;
  error: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  processed_at: string | null;
};

export function FilesLiveTable({
  agentId,
  initial,
}: {
  agentId: string;
  initial: FileRow[];
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
              r.map((x) => (x.id === (payload.new as FileRow).id ? (payload.new as FileRow) : x)),
            );
          } else if (payload.eventType === "DELETE") {
            setRows((r) => r.filter((x) => x.id !== (payload.old as FileRow).id));
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [agentId]);

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
    if (!confirm(`Delete ${filename}? All chunks for this file will be removed.`)) return;
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

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No files yet. Upload something above to feed the agent.
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-28 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link
                  href={`/agents/${agentId}/knowledge/files/${r.id}`}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {r.filename}
                </Link>
                {r.error ? (
                  <div className="mt-0.5 text-xs text-red-600 dark:text-red-400">
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onReprocess(r.id)}
                  disabled={pending}
                  title="Reprocess"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(r.id, r.filename)}
                  disabled={pending}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
