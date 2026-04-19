"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#flow", label: "Flow" },
  { href: "#graph", label: "Graph" },
  { href: "#api", label: "API" },
  { href: "#agents", label: "Agents" },
  { href: "#business", label: "Use cases" },
];

export function LandingNav() {
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 120], [0, 14]);
  const bg = useTransform(
    scrollY,
    [0, 120],
    ["rgba(17,17,22,0)", "rgba(17,17,22,0.78)"],
  );
  const borderOpacity = useTransform(scrollY, [0, 120], [0, 1]);

  return (
    <motion.header
      style={{
        backdropFilter: blur.get() ? `blur(${blur.get()}px)` : undefined,
        backgroundColor: bg,
      }}
      className="fixed inset-x-0 top-0 z-40"
    >
      <motion.div
        style={{ opacity: borderOpacity }}
        className="absolute inset-x-0 bottom-0 h-px bg-white/10"
      />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_oklch(0.7_0.19_285/0.9)] transition group-hover:scale-125" />
          <span className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
            ask<span className="text-primary">tiberius</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-[13px] text-muted-foreground md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Log in
          </Link>
          <a
            href="/api/docs/ui"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
          >
            Try the API
          </a>
        </div>
      </div>
    </motion.header>
  );
}
