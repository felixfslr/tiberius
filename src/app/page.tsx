import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-zinc-50 px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tiberius
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          A simple starting point.
        </p>
      </div>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </span>
          <Link href="/dashboard" className={buttonVariants()}>
            Dashboard
          </Link>
        </div>
      ) : (
        <Link href="/login" className={buttonVariants()}>
          Login
        </Link>
      )}
    </main>
  );
}
