"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "./reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CURL = `curl -X POST https://tiberius-nu.vercel.app/api/v1/agents/$ID/reply \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "trigger_message": "What are you charging per USDC txn?" }'`;

export function CtaFooter() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CURL);
      setCopied(true);
      toast.success("Copied — now go grab an API key");
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <section className="relative overflow-hidden px-5 pt-24 pb-16 md:pt-32 md:pb-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 70% at 50% 30%, oklch(0.7 0.19 285 / 0.25), transparent 70%)",
        }}
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <Reveal className="flex flex-col items-center gap-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            /get started
          </div>
          <h2
            className="font-heading font-black tracking-[-0.04em] text-foreground"
            style={{
              fontSize: "clamp(2.4rem, 5.6vw, 4.2rem)",
              lineHeight: 0.95,
            }}
          >
            Get a key.
            <br />
            Post a message.
            <br />
            <span className="text-muted-foreground">Get a reply.</span>
          </h2>
          <p className="max-w-xl text-[15px] text-muted-foreground">
            No SDK. No SaaS onboarding. A bearer token and an HTTP client is
            enough.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="w-full">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 text-left shadow-[0_30px_100px_-20px_oklch(0.7_0.19_285/0.5)] backdrop-blur">
            <button
              type="button"
              onClick={copy}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[10.5px] text-muted-foreground transition hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> copy
                </>
              )}
            </button>
            <pre className="overflow-x-auto px-5 py-6 font-mono text-[12.5px] leading-relaxed text-foreground/85">
              <code>{CURL}</code>
            </pre>
          </div>
        </Reveal>

        <Reveal
          delay={0.2}
          className="flex flex-wrap items-center justify-center gap-3 pt-4"
        >
          <a
            href="/api/docs/ui"
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-11 rounded-full px-5 text-[14px] shadow-[0_12px_32px_-8px_oklch(0.7_0.19_285/0.55)]",
            )}
          >
            Open Swagger
            <ExternalLink className="ml-1.5 h-4 w-4" />
          </a>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "h-11 rounded-full px-5 text-[14px] text-muted-foreground hover:text-foreground",
            )}
          >
            Log in
          </Link>
        </Reveal>

        <Reveal delay={0.3} className="pt-12">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 font-heading text-[14px] font-semibold tracking-tight text-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_oklch(0.7_0.19_285/0.9)]" />
              ask<span className="text-primary">tiberius</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} · thinc! × Ivy · built in 48h
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
