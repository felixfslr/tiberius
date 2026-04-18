import { createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

const PREFIX = "tib_";

export type ApiKeyAuth = { agent_id: string; key_id: string; key_name: string };

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const plaintext = `${PREFIX}${raw}`;
  const prefix = plaintext.slice(0, 8);
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function readBearer(req: Request): string | null {
  const hdr = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!hdr) return null;
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Verifies a bearer API key against api_keys.key_hash. Returns null if invalid. */
export async function verifyApiKey(req: Request): Promise<ApiKeyAuth | null> {
  const token = readBearer(req);
  if (!token || !token.startsWith(PREFIX)) return null;
  const hash = hashApiKey(token);
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("api_keys")
    .select("id, agent_id, name")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  // fire-and-forget last-used timestamp
  sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(
    () => void 0,
    () => void 0,
  );
  return { agent_id: data.agent_id, key_id: data.id, key_name: data.name };
}
