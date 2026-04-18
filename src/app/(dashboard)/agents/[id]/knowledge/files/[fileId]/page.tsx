import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getFile } from "@/lib/services/files";
import { listChunks } from "@/lib/services/chunks";
import { buttonVariants } from "@/components/ui/button";
import { FileStatusBadge } from "@/components/app/file-status-badge";
import { ChunksEditor } from "@/components/app/chunks-editor";

export const dynamic = "force-dynamic";

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ id: string; fileId: string }>;
}) {
  const { id, fileId } = await params;
  const file = await getFile(fileId);
  if (!file || file.agent_id !== id) notFound();
  const chunks = await listChunks(id, { file_id: fileId, limit: 500 });

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href={`/agents/${id}/knowledge`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to knowledge
          </Link>
          <h2 className="text-lg font-semibold">{file.filename}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{file.file_type}</span>
            <span>·</span>
            <FileStatusBadge status={file.status} />
            <span>·</span>
            <span>{chunks.length} chunks</span>
          </div>
          {file.error ? (
            <div className="mt-1 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
              {file.error}
            </div>
          ) : null}
        </div>
      </header>

      {chunks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {file.status === "ready"
            ? "No chunks — this file produced nothing. Try reprocessing or editing the raw content."
            : "Chunks will appear here once processing completes."}
        </div>
      ) : (
        <ChunksEditor chunks={chunks} />
      )}
    </div>
  );
}
