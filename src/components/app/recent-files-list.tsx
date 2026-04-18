"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { FileStatusBadge } from "./file-status-badge";
import { TypeChip } from "./type-chip";
import { relativeFromNow } from "@/lib/format/time";

type RecentFile = {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  uploaded_at: string;
};

export function RecentFilesList({
  agentId,
  files,
}: {
  agentId: string;
  files: RecentFile[];
}) {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No files yet. Upload something above to feed the agent.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {files.map((f) => (
        <li key={f.id}>
          <Link
            href={`/agents/${agentId}/knowledge/files/${f.id}`}
            className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{f.filename}</span>
              <div className="mt-0.5 flex items-center gap-2">
                <TypeChip type={f.file_type} />
                <span className="text-[11px] text-muted-foreground">
                  {relativeFromNow(new Date(f.uploaded_at))}
                </span>
              </div>
            </div>
            <FileStatusBadge status={f.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
