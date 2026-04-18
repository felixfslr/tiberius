import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  DATABASE_URL_DIRECT: z.string().startsWith("postgres"),
  OPENAI_API_KEY: z.string().startsWith("sk-"),
  OPENAI_MODEL_REPLY: z.string().default("gpt-5.4"),
  OPENAI_MODEL_MINI: z.string().default("gpt-5.4-mini"),
  OPENAI_MODEL_EMBED: z.string().default("text-embedding-3-small"),
  OPENAI_MODEL_WHISPER: z.string().default("whisper-1"),
  APP_ENV: z.enum(["development", "production", "test"]).default("development"),
});

type PublicEnv = z.infer<typeof publicSchema>;
type ServerEnv = z.infer<typeof serverSchema>;

function readPublic(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Missing/invalid public env: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}

function readServer(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Missing/invalid server env: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}

export const publicEnv = readPublic();

/**
 * Server-only env. Importing this from a Client Component will throw at build time
 * because of the secret references. Only use inside server code (route handlers,
 * server components, server actions, worker).
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() called from browser");
  }
  return readServer();
}
