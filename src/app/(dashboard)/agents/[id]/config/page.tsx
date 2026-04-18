import { notFound } from "next/navigation";
import { getAgent } from "@/lib/services/agents";
import { ConfigEditor } from "@/components/app/config-editor";

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
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h2 className="text-lg font-semibold">Config</h2>
        <p className="text-sm text-muted-foreground">
          Shapes the draft for every /reply call. The threshold gates whether a draft is
          returned as-is or flagged for human review.
        </p>
      </header>
      <ConfigEditor agent={agent} />
    </div>
  );
}
