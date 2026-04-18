import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { getAgent } from "@/lib/services/agents";
import { listFiles } from "@/lib/services/files";
import { getFolderCounts, listFolders } from "@/lib/services/folders";
import { FileUploader } from "@/components/app/file-uploader";
import { FilesLiveTable } from "@/components/app/files-live-table";
import { FolderGrid, FolderActionsMenu } from "@/components/app/folder-grid";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";

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

  const activeFolder = folder ?? null; // null = root grid view

  // Root view: show folder grid
  if (!activeFolder) {
    const [folders, counts] = await Promise.all([
      listFolders(id),
      getFolderCounts(id),
    ]);

    return (
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
        <PageHeader
          crumbs={[
            { href: "/agents", label: "Agents" },
            { href: `/agents/${id}/knowledge`, label: agent.name },
          ]}
          title="Knowledge"
          description="Organize docs, SOPs, glossaries, chat history and tone examples into folders. The agent retrieves across all folders at reply time."
        />

        <FolderGrid
          agentId={id}
          folders={folders}
          unsortedCount={counts.unsorted}
        />

        <section className="mt-2">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Quick upload
          </h2>
          <FileUploader agentId={id} folderId={null} />
          <p className="mt-2 text-xs text-muted-foreground">
            Files uploaded here land in{" "}
            <span className="font-medium text-foreground">Unsorted</span>. Open
            a folder to upload straight into it.
          </p>
        </section>
      </div>
    );
  }

  // Inside-folder view
  const [folders, counts, files] = await Promise.all([
    listFolders(id),
    getFolderCounts(id),
    listFiles(id, activeFolder),
  ]);

  const isUnsorted = activeFolder === "unsorted";
  const folderRecord = isUnsorted
    ? null
    : folders.find((f) => f.id === activeFolder);

  if (!isUnsorted && !folderRecord) {
    // Folder doesn't exist — bounce back
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Folder not found.</p>
        <Link
          href={`/agents/${id}/knowledge`}
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to folders
        </Link>
      </div>
    );
  }

  const folderName = isUnsorted ? "Unsorted" : (folderRecord?.name ?? "Folder");
  const uploadFolderId = isUnsorted ? null : activeFolder;

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Link
            href={`/agents/${id}/knowledge`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All folders
          </Link>
          <div className="flex items-center gap-3">
            {isUnsorted ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Inbox className="h-5 w-5" />
              </div>
            ) : (
              <FolderBadge />
            )}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {folderName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {files.length === 0
                  ? "Empty"
                  : files.length === 1
                    ? "1 file"
                    : `${files.length} files`}
                {" · "}
                {agent.name}
              </p>
            </div>
          </div>
        </div>
        {!isUnsorted && folderRecord ? (
          <FolderActionsMenu
            agentId={id}
            folderId={folderRecord.id}
            folderName={folderRecord.name}
          />
        ) : null}
      </div>

      <FileUploader
        agentId={id}
        folderId={uploadFolderId}
        folderName={isUnsorted ? undefined : folderName}
      />

      <FilesLiveTable
        agentId={id}
        initial={files}
        folderFilter={activeFolder}
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      />

      <div className="text-xs text-muted-foreground">
        Total: {counts.all} file{counts.all === 1 ? "" : "s"} across all folders
        · {counts.unsorted} unsorted
      </div>
    </div>
  );
}

function FolderBadge() {
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      </svg>
    </div>
  );
}
