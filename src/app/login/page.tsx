import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/agents");

  return (
    <main className="flex min-h-svh items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <LoginForm />
    </main>
  );
}
