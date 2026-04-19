import { createServiceClient } from "@/lib/supabase/service";
import { generateApiKey } from "@/lib/auth/api-key";

export type ApiKeyRow = {
  id: string;
  /** null = workspace key; used by MCP clients that talk to multiple agents. */
  agent_id: string | null;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export type ApiKeyCreated = ApiKeyRow & { plaintext: string };

export async function listKeys(agent_id: string): Promise<ApiKeyRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("api_keys")
    .select("id, agent_id, name, key_prefix, last_used_at, created_at")
    .eq("agent_id", agent_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listWorkspaceKeys(): Promise<ApiKeyRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("api_keys")
    .select("id, agent_id, name, key_prefix, last_used_at, created_at")
    .is("agent_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createKey(
  agent_id: string | null,
  name: string,
): Promise<ApiKeyCreated> {
  const { plaintext, prefix, hash } = generateApiKey();
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("api_keys")
    .insert({ agent_id, name, key_hash: hash, key_prefix: prefix })
    .select("id, agent_id, name, key_prefix, last_used_at, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, plaintext };
}

export async function deleteKey(key_id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("api_keys").delete().eq("id", key_id);
  if (error) throw new Error(error.message);
}
