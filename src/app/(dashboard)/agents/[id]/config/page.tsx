import { notFound } from "next/navigation";
import { getAgent } from "@/lib/services/agents";
import { ConfigEditor } from "@/components/app/config-editor";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      <PageHeader
        crumbs={[
          { href: "/agents", label: "Agents" },
          { href: `/agents/${id}/knowledge`, label: agent.name },
        ]}
        title="Config"
        description="Shapes the draft for every /reply call. The threshold gates whether a draft is returned as-is or flagged for human review."
      />
      <ConfigEditor agent={agent} />
    </div>
  );
}
