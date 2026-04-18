import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Inbox } from "lucide-react";
import { getAgent } from "@/lib/services/agents";
import { listFiles } from "@/lib/services/files";
import {
  getFolderCounts,
  getFolderPath,
  listFolders,
} from "@/lib/services/folders";
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

  // -----------------------------------------------------------
  // Root view
  // -----------------------------------------------------------
  if (!activeFolder) {
    const [rootFolders, counts] = await Promise.all([
      listFolders(id, null),
      getFolderCounts(id),
    ]);

    // Best-effort sub_count by folder (one extra query, cheap at this scale)
    const subCounts = await countSubfolders(
      id,
      rootFolders.map((f) => f.id),
    );

    return (
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
        <PageHeader
          crumbs={[
            { href: "/agents", label: "Agents" },
            { href: `/agents/${id}/knowledge`, label: agent.name },
          ]}
          title="Knowledge"
          description="Organize docs, SOPs, glossaries, chat history and tone examples into folders and subfolders. The agent retrieves across all folders at reply time."
        />

        <FolderGrid
          agentId={id}
          parentId={null}
          folders={rootFolders.map((f) => ({
            id: f.id,
            name: f.name,
            file_count: f.file_count,
            sub_count: subCounts.get(f.id) ?? 0,
          }))}
          unsortedCount={counts.unsorted}
          showUnsorted
        />
      </div>
    );
  }

  // -----------------------------------------------------------
  // Unsorted view
  // -----------------------------------------------------------
  if (activeFolder === "unsorted") {
    const files = await listFiles(id, "unsorted");
    return (
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
        <InsideHeader
          agentId={id}
          agentName={agent.name}
          path={[{ id: "unsorted", name: "Unsorted" }]}
          actions={null}
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Inbox className="h-5 w-5" />
            </div>
          }
          summary={`${files.length} file${files.length === 1 ? "" : "s"} not in any folder`}
        />

        <FileUploader agentId={id} folderId={null} />

        <FilesLiveTable
          agentId={id}
          initial={files}
          folderFilter="unsorted"
          folders={[]}
        />
      </div>
    );
  }

  // -----------------------------------------------------------
  // Inside a specific folder
  // -----------------------------------------------------------
  const [path, subfolders, files] = await Promise.all([
    getFolderPath(activeFolder),
    listFolders(id, activeFolder),
    listFiles(id, activeFolder),
  ]);

  if (path.length === 0) {
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

  const current = path[path.length - 1]!;
  const subCounts = await countSubfolders(
    id,
    subfolders.map((f) => f.id),
  );

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <InsideHeader
        agentId={id}
        agentName={agent.name}
        path={path.map((p) => ({ id: p.id, name: p.name }))}
        actions={
          <FolderActionsMenu
            agentId={id}
            folderId={current.id}
            folderName={current.name}
          />
        }
        icon={<FolderBadge />}
        summary={
          [
            subfolders.length > 0
              ? `${subfolders.length} subfolder${subfolders.length === 1 ? "" : "s"}`
              : null,
            files.length > 0
              ? `${files.length} file${files.length === 1 ? "" : "s"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Empty folder"
        }
      />

      <FolderGrid
        agentId={id}
        parentId={current.id}
        folders={subfolders.map((f) => ({
          id: f.id,
          name: f.name,
          file_count: f.file_count,
          sub_count: subCounts.get(f.id) ?? 0,
        }))}
      />

      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Files
        </h2>
        <FileUploader
          agentId={id}
          folderId={current.id}
          folderName={current.name}
        />
        <FilesLiveTable
          agentId={id}
          initial={files}
          folderFilter={current.id}
          folders={subfolders.map((f) => ({ id: f.id, name: f.name }))}
        />
      </div>
    </div>
  );
}

async function countSubfolders(
  agentId: string,
  folderIds: string[],
): Promise<Map<string, number>> {
  if (folderIds.length === 0) return new Map();
  const { createServiceClient } = await import("@/lib/supabase/service");
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("folders")
    .select("parent_id")
    .eq("agent_id", agentId)
    .in("parent_id", folderIds);
  if (error) return new Map();
  const map = new Map<string, number>();
  for (const row of (data ?? []) as { parent_id: string | null }[]) {
    if (!row.parent_id) continue;
    map.set(row.parent_id, (map.get(row.parent_id) ?? 0) + 1);
  }
  return map;
}

function InsideHeader({
  agentId,
  agentName,
  path,
  actions,
  icon,
  summary,
}: {
  agentId: string;
  agentName: string;
  path: { id: string; name: string }[];
  actions: React.ReactNode;
  icon: React.ReactNode;
  summary: string;
}) {
  const current = path[path.length - 1]!;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-3">
        <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
          <Link href="/agents" className="hover:text-foreground">
            Agents
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/agents/${agentId}/knowledge`}
            className="hover:text-foreground"
          >
            {agentName}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/agents/${agentId}/knowledge`}
            className="hover:text-foreground"
          >
            Knowledge
          </Link>
          {path.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
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
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {current.name}
            </h1>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
        </div>
      </div>
      {actions}
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
