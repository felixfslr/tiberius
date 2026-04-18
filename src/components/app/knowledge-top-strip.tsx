"use client";

import Link from "next/link";
import { FileText, Network, Upload } from "lucide-react";
import { UploadDialog } from "./upload-dialog";
import { TypeChip } from "./type-chip";
import { cn } from "@/lib/utils";

export type RecentFile = {
  id: string;
  filename: string;
  file_type: string;
};

export function KnowledgeTopStrip({
  agentId,
  files,
}: {
  agentId: string;
  files: RecentFile[];
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <UploadDialog
        agentId={agentId}
        trigger={
          <button
            type="button"
            className={cn(
              "group relative flex h-28 w-56 shrink-0 flex-col justify-between rounded-xl bg-gradient-to-br from-primary to-primary/75 p-4 text-left text-primary-foreground shadow-md shadow-primary/20 transition hover:shadow-lg",
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold tracking-tight">
                Upload files
              </div>
              <div className="text-[11px] text-primary-foreground/80">
                PDF, DOCX, TXT, MD, JSON
              </div>
            </div>
          </button>
        }
      />

      <Link
        href={`/agents/${agentId}/knowledge/graph`}
        className="group flex h-28 w-56 shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
          <Network className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-semibold tracking-tight">
            Knowledge graph
          </div>
          <div className="text-[11px] text-muted-foreground">
            See how chunks connect
          </div>
        </div>
      </Link>

      <Link
        href={`/agents/${agentId}/knowledge/graph-v2`}
        className="group relative flex h-28 w-56 shrink-0 flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
          <Network className="h-4 w-4" />
        </div>
        <span className="absolute top-3 right-3 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-wide text-primary uppercase">
          v2
        </span>
        <div className="space-y-0.5">
          <div className="text-sm font-semibold tracking-tight">
            Graph · multi-axis
          </div>
          <div className="text-[11px] text-muted-foreground">
            Stage · intent · entities
          </div>
        </div>
      </Link>

      {files.map((f) => (
        <Link
          key={f.id}
          href={`/agents/${agentId}/knowledge/files/${f.id}`}
          className="group flex h-28 w-56 shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="line-clamp-1 text-sm font-medium">{f.filename}</div>
            <TypeChip type={f.file_type} />
          </div>
        </Link>
      ))}
    </div>
  );
}
