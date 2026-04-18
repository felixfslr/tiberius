import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/agents");

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_50%),radial-gradient(circle_at_80%_60%,white,transparent_55%)]"
        />
        <div className="relative flex items-center gap-3 p-10 text-primary-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Tiberius</span>
        </div>
        <div className="relative p-10 text-primary-foreground">
          <h1 className="max-w-md text-4xl font-semibold tracking-tight">
            Drafts grounded sales replies for WhatsApp &amp; Telegram leads.
          </h1>
          <p className="mt-4 max-w-md text-base text-primary-foreground/80">
            Hybrid retrieval, multi-signal confidence, agent-specific knowledge
            bases — ship replies your sales team can trust.
          </p>
        </div>
        <div className="relative p-10 text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Tiberius
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Tiberius
            </span>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
