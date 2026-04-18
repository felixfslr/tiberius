import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

export async function currentUser(): Promise<SessionUser | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}
