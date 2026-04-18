"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAgent,
  deleteAgent,
  cloneAgent,
  updateAgent,
} from "@/lib/services/agents";
import { AgentConfigSchema, AgentPatchSchema } from "@/lib/schemas/agent";
import { requireUser } from "@/lib/auth/session";

export async function createAgentAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || undefined;
  if (!name) throw new Error("Name is required");
  const agent = await createAgent({ name, description });
  revalidatePath("/agents");
  redirect(`/agents/${agent.id}/knowledge`);
}

export async function deleteAgentAction(id: string) {
  await requireUser();
  await deleteAgent(id);
  revalidatePath("/agents");
  redirect("/agents");
}

export async function cloneAgentAction(id: string) {
  await requireUser();
  const cloned = await cloneAgent(id);
  revalidatePath("/agents");
  redirect(`/agents/${cloned.id}/knowledge`);
}

export async function updateAgentConfigAction(id: string, formData: FormData) {
  await requireUser();
  const parsed = AgentConfigSchema.partial().parse({
    confidence_threshold: formData.get("confidence_threshold")
      ? Number(formData.get("confidence_threshold"))
      : undefined,
    calendly_url: formData.get("calendly_url") || undefined,
  });
  const patch = AgentPatchSchema.parse({ config: parsed });
  await updateAgent(id, patch);
  revalidatePath(`/agents/${id}`, "layout");
}
