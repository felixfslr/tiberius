import { listFiles } from "@/lib/services/files";
import { FileUploader } from "@/components/app/file-uploader";
import { FilesLiveTable } from "@/components/app/files-live-table";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const files = await listFiles(id);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h2 className="text-lg font-semibold">Knowledge</h2>
        <p className="text-sm text-muted-foreground">
          Upload product docs, SOPs, glossaries, chat history, call transcripts or
          tone-of-voice examples. The agent uses hybrid retrieval (semantic + FTS +
          metadata filter) over the resulting chunks at reply time.
        </p>
      </header>

      <FileUploader agentId={id} />
      <FilesLiveTable agentId={id} initial={files} />
    </div>
  );
}
