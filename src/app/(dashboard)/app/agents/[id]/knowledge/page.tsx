import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAgent } from "@/lib/services/agents";
import { listFiles, listFilesWithChunks } from "@/lib/services/files";
import {
  getFolderCounts,
  getFolderPath,
  listFolders,
} from "@/lib/services/folders";
import { buildRichGraph, type RichGraph } from "@/lib/services/graph-rich";
import { createServiceClient } from "@/lib/supabase/service";
import { buttonVariants } from "@/components/ui/button";
import { CreateFolderDialog } from "@/components/app/create-folder-dialog";
import { FolderTable } from "@/components/app/folder-table";
import { KnowledgeTopStrip } from "@/components/app/knowledge-top-strip";
import { KnowledgeGraphEmbed } from "@/components/app/knowledge-graph-embed";
import { FolderDetailView } from "@/components/app/folder-detail-view";

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

  // ========================================================
  // Root view
  // ========================================================
  if (!folder) {
    const [rootFolders, counts, recent, graphData] = await Promise.all([
      listFolders(id, null),
      getFolderCounts(id),
      listFiles(id).then((fs) => fs.slice(0, 6)),
      buildRichGraph(id).catch((err): RichGraph => {
        console.error("[knowledge] buildRichGraph failed", {
          agent_id: id,
          message: err instanceof Error ? err.message : String(err),
        });
        return {
          agent_id: id,
          nodes: [],
          edges: [],
          computed_at: new Date().toISOString(),
          stats: {
            chunk_count: 0,
            edge_count: 0,
            similarity_edges: 0,
            co_retrieval_edges: 0,
            unique_stages: [],
            unique_intents: [],
            top_entities: [],
            content_type_counts: {},
          },
        };
      }),
    ]);
    const subCounts = await countSubfolders(
      id,
      rootFolders.map((f) => f.id),
    );

    return (
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
        <KnowledgeTopStrip
          agentId={id}
          files={recent.map((f) => ({
            id: f.id,
            filename: f.filename,
            file_type: f.file_type,
          }))}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Folders
            </h2>
            <CreateFolderDialog
              agentId={id}
              parentId={null}
              variant="outline"
            />
          </div>
          <FolderTable
            agentId={id}
            rows={rootFolders.map((f) => ({
              id: f.id,
              name: f.name,
              file_count: f.file_count,
              sub_count: subCounts.get(f.id) ?? 0,
              updated_at: f.updated_at,
            }))}
            unsortedCount={counts.unsorted}
            includeUnsorted
            empty={
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No folders yet. Create one to organize your knowledge.
              </div>
            }
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Knowledge graph
          </h2>
          <KnowledgeGraphEmbed data={graphData} agentName={agent.name} />
        </section>
      </div>
    );
  }

  // ========================================================
  // Unsorted view
  // ========================================================
  if (folder === "unsorted") {
    const files = await listFilesWithChunks(id, "unsorted");
    return (
      <FolderDetailView
        agentId={id}
        agentName={agent.name}
        path={[{ id: "unsorted", name: "Unsorted" }]}
        description={null}
        subfolders={[]}
        files={files.map(serializeFile)}
        isUnsorted
      />
    );
  }

  // ========================================================
  // Inside a specific folder
  // ========================================================
  const [path, subfolders, files] = await Promise.all([
    getFolderPath(folder),
    listFolders(id, folder),
    listFilesWithChunks(id, folder),
  ]);

  if (path.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Folder not found.</p>
        <Link
          href={`/app/agents/${id}/knowledge`}
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
    <FolderDetailView
      agentId={id}
      agentName={agent.name}
      path={path.map((p) => ({ id: p.id, name: p.name }))}
      description={current.description}
      currentFolderId={current.id}
      updatedAt={current.updated_at}
      subfolders={subfolders.map((f) => ({
        id: f.id,
        name: f.name,
        file_count: f.file_count,
        sub_count: subCounts.get(f.id) ?? 0,
        updated_at: f.updated_at,
      }))}
      files={files.map(serializeFile)}
    />
  );
}

function serializeFile(f: {
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
  chunks_count?: number;
}) {
  return {
    id: f.id,
    agent_id: f.agent_id,
    folder_id: f.folder_id,
    filename: f.filename,
    file_type: f.file_type,
    status: f.status,
    error: f.error,
    size_bytes: f.size_bytes,
    uploaded_at: f.uploaded_at,
    processed_at: f.processed_at,
    chunks_count: f.chunks_count ?? 0,
  };
}

async function countSubfolders(
  agentId: string,
  folderIds: string[],
): Promise<Map<string, number>> {
  if (folderIds.length === 0) return new Map();
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
