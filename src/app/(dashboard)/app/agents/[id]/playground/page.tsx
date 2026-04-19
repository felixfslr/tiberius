import { notFound } from "next/navigation";
import { getAgent } from "@/lib/services/agents";
import { PlaygroundChat } from "@/components/app/playground-chat";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  return <PlaygroundChat agent={agent} />;
}
