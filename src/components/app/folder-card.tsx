"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function FolderIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="folderBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.18 285)" />
          <stop offset="100%" stopColor="oklch(0.58 0.22 285)" />
        </linearGradient>
        <linearGradient id="folderFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 285)" />
          <stop offset="100%" stopColor="oklch(0.64 0.2 285)" />
        </linearGradient>
      </defs>
      <path
        d="M8 22 a8 8 0 0 1 8-8 h36 l10 10 h62 a8 8 0 0 1 8 8 v62 a8 8 0 0 1 -8 8 H16 a8 8 0 0 1 -8 -8 Z"
        fill="url(#folderBack)"
      />
      <rect
        x="6"
        y="34"
        width="128"
        height="66"
        rx="10"
        fill="url(#folderFront)"
      />
      <rect
        x="6"
        y="34"
        width="128"
        height="8"
        rx="4"
        fill="oklch(1 0 0 / 0.15)"
      />
    </svg>
  );
}

type FolderChip = { label: string; color?: string };

export function FolderCard({
  href,
  name,
  fileCount,
  tools = [],
  onRename,
  onDelete,
  variant = "default",
}: {
  href: string;
  name: string;
  fileCount: number;
  tools?: FolderChip[];
  onRename?: () => void;
  onDelete?: () => void;
  variant?: "default" | "unsorted" | "all";
}) {
  const isSpecial = variant !== "default";
  return (
    <div className="group relative">
      <Link
        href={href}
        className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative mx-auto flex h-32 items-end justify-center">
          {variant === "unsorted" ? (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Inbox className="h-10 w-10" strokeWidth={1.5} />
            </div>
          ) : (
            <>
              <FolderIllustration className="h-32 w-auto drop-shadow-[0_8px_16px_oklch(0.55_0.22_285_/_0.25)]" />
              {tools.length > 0 ? (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 -space-x-1.5">
                  {tools.slice(0, 5).map((t, i) => (
                    <div
                      key={i}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[10px] font-semibold text-primary shadow-sm ring-1 ring-white/50"
                    >
                      {t.label}
                    </div>
                  ))}
                  {tools.length > 5 ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[10px] font-semibold text-primary shadow-sm ring-1 ring-white/50">
                      +{tools.length - 5}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-4 space-y-1 text-center">
          <div className="font-semibold tracking-tight">{name}</div>
          <div className="text-xs text-muted-foreground">
            {fileCount === 0
              ? "Empty"
              : fileCount === 1
                ? "1 file"
                : `${fileCount} files`}
          </div>
        </div>
      </Link>

      {!isSpecial && (onRename || onDelete) ? (
        <div className="absolute top-3 right-3 opacity-0 transition group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-background/80 backdrop-blur hover:bg-background"
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onRename ? (
                <DropdownMenuItem onSelect={onRename}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
              ) : null}
              {onRename && onDelete ? <DropdownMenuSeparator /> : null}
              {onDelete ? (
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

export function NewFolderTile({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Create failed");
        return;
      }
      toast.success(`Folder "${trimmed}" created`);
      setName("");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
        <div className="mx-auto flex h-32 items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Plus className="h-8 w-8" />
          </div>
        </div>
        <div className="mt-4 w-full">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setEditing(false);
                setName("");
              }
            }}
            onBlur={submit}
            placeholder="Folder name"
            disabled={pending}
            className="text-center"
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-transparent p-5 text-center transition",
        "hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      <div className="mx-auto flex h-32 items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
          <Plus className="h-8 w-8" strokeWidth={2} />
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <div className="font-semibold tracking-tight">New folder</div>
        <div className="text-xs text-muted-foreground">
          Group related knowledge
        </div>
      </div>
    </button>
  );
}
