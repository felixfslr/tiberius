import { notFound } from "next/navigation";
import { getAgent } from "@/lib/services/agents";
import { listFiles } from "@/lib/services/files";
import { getFolderCounts, listFolders } from "@/lib/services/folders";
import { FileUploader } from "@/components/app/file-uploader";
import { FilesLiveTable } from "@/components/app/files-live-table";
import { FolderSidebar } from "@/components/app/folder-sidebar";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { id } = await params;
  const { folder } = await searchParams;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const activeFolder: "all" | "unsorted" | string = folder ?? "all";
  const [folders, counts, files] = await Promise.all([
    listFolders(id),
    getFolderCounts(id),
    listFiles(id, activeFolder === "all" ? undefined : activeFolder),
  ]);

  const activeFolderName =
    activeFolder === "all"
      ? "All files"
      : activeFolder === "unsorted"
        ? "Unsorted"
        : (folders.find((f) => f.id === activeFolder)?.name ??
          "Unknown folder");
  const uploadFolderId =
    activeFolder === "unsorted"
      ? null
      : activeFolder === "all"
        ? null
        : activeFolder;

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${id}/knowledge`, label: agent.name },
        ]}
        title="Knowledge"
        description="Upload product docs, SOPs, glossaries, chat history, call transcripts or tone-of-voice examples. Organize them into folders; the agent retrieves hybrid over all chunks regardless of folder."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_1fr]">
        <FolderSidebar
          agentId={id}
          folders={folders}
          activeFolder={activeFolder}
          totals={counts}
        />
        <div className="flex min-w-0 flex-col gap-6">
          <FileUploader
            agentId={id}
            folderId={uploadFolderId}
            folderName={
              activeFolder === "all" || activeFolder === "unsorted"
                ? undefined
                : activeFolderName
            }
          />
          <FilesLiveTable
            agentId={id}
            initial={files}
            folderFilter={activeFolder}
            folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          />
        </div>
      </div>
    </div>
  );
}
