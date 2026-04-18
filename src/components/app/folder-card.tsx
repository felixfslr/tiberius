"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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

/**
 * Manila-folder illustration.
 * Back panel + tab peek behind a lighter front panel. Subtle highlight on top
 * of the front face gives the 3D lift.
 */
function FolderIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="folder-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.65 0.22 285)" />
          <stop offset="100%" stopColor="oklch(0.48 0.24 285)" />
        </linearGradient>
        <linearGradient id="folder-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 285)" />
          <stop offset="55%" stopColor="oklch(0.68 0.2 285)" />
          <stop offset="100%" stopColor="oklch(0.55 0.22 285)" />
        </linearGradient>
        <linearGradient id="folder-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(1 0 0 / 0.35)" />
          <stop offset="100%" stopColor="oklch(1 0 0 / 0)" />
        </linearGradient>
      </defs>

      {/* Back panel with tab */}
      <path
        d="M10 30 a8 8 0 0 1 8-8 h38 c2.5 0 4.8 1.2 6.3 3.2 L68 32 h74 a8 8 0 0 1 8 8 v66 a8 8 0 0 1 -8 8 H18 a8 8 0 0 1 -8 -8 Z"
        fill="url(#folder-back)"
      />
      {/* Subtle divider line above the front */}
      <rect x="10" y="44" width="140" height="2" fill="oklch(0 0 0 / 0.12)" />

      {/* Front panel */}
      <rect
        x="8"
        y="46"
        width="144"
        height="70"
        rx="10"
        fill="url(#folder-front)"
      />
      {/* Top highlight on front panel */}
      <rect
        x="8"
        y="46"
        width="144"
        height="20"
        rx="10"
        fill="url(#folder-shine)"
      />
      {/* Bottom inner shadow */}
      <rect
        x="8"
        y="106"
        width="144"
        height="10"
        rx="6"
        fill="oklch(0 0 0 / 0.08)"
      />
    </svg>
  );
}

export function FolderCard({
  href,
  name,
  fileCount,
  subCount,
  onRename,
  onDelete,
}: {
  href: string;
  name: string;
  fileCount: number;
  subCount?: number;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const summary =
    fileCount === 0 && (subCount ?? 0) === 0
      ? "Empty"
      : [
          subCount && subCount > 0
            ? `${subCount} folder${subCount === 1 ? "" : "s"}`
            : null,
          fileCount > 0
            ? `${fileCount} file${fileCount === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="group relative">
      <Link
        href={href}
        className="block rounded-2xl border border-border bg-card p-4 pb-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
      >
        <div className="relative mx-auto flex h-32 items-end justify-center">
          <FolderIllustration className="h-32 w-auto drop-shadow-[0_10px_22px_oklch(0.5_0.22_285_/_0.28)]" />
        </div>
        <div className="mt-4 space-y-1 text-center">
          <div className="line-clamp-1 font-semibold tracking-tight">
            {name}
          </div>
          <div className="text-xs text-muted-foreground">{summary}</div>
        </div>
      </Link>

      {onRename || onDelete ? (
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

export function UnsortedCard({
  href,
  fileCount,
}: {
  href: string;
  fileCount: number;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border bg-card p-4 pb-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
    >
      <div className="relative mx-auto flex h-32 items-center justify-center">
        <div className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground transition group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary">
          <FileText className="h-7 w-7" strokeWidth={1.75} />
          <div className="text-[10px] font-medium uppercase tracking-wider">
            Loose
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1 text-center">
        <div className="font-semibold tracking-tight">Unsorted</div>
        <div className="text-xs text-muted-foreground">
          {fileCount === 0
            ? "Empty"
            : fileCount === 1
              ? "1 file"
              : `${fileCount} files`}
        </div>
      </div>
    </Link>
  );
}

export function NewFolderTile({
  agentId,
  parentId = null,
}: {
  agentId: string;
  parentId?: string | null;
}) {
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
        body: JSON.stringify({ name: trimmed, parent_id: parentId }),
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
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 pb-5">
        <div className="mx-auto flex h-32 items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 text-primary">
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
        "group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-transparent p-4 pb-5 text-center transition",
        "hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      <div className="mx-auto flex h-32 items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition group-hover:bg-primary/15 group-hover:text-primary">
          <Plus className="h-8 w-8" strokeWidth={2} />
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <div className="font-semibold tracking-tight">New folder</div>
        <div className="text-xs text-muted-foreground">
          {parentId ? "Inside current folder" : "At the top level"}
        </div>
      </div>
    </button>
  );
}
