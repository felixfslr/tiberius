import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS — use only in trusted server-side
 * code: route handlers authenticated via API key, server actions we've audited,
 * and the pg-boss worker. Never import into client components.
 */
export function createServiceClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
