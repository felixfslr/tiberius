"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Save, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ChunkRow = {
  id: string;
  content: string;
  position: number;
  edited_by_user: boolean;
  metadata: Record<string, unknown>;
};

export function ChunksEditor({ chunks }: { chunks: ChunkRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(c: ChunkRow) {
    setEditing(c.id);
    setDraft(c.content);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  function save(chunkId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/chunks/${chunkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error?.message ?? "Save failed");
        return;
      }
      toast.success("Chunk updated and re-embedded");
      setEditing(null);
      setDraft("");
      router.refresh();
    });
  }

  function del(chunkId: string) {
    if (!confirm("Delete this chunk? It will not be retrievable by the agent anymore.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/chunks/${chunkId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {chunks.map((c) => {
        const meta = c.metadata as {
          stage?: string[];
          intent?: string[];
          entities?: string[];
          summary?: string;
        };
        const isEditing = editing === c.id;
        return (
          <Card key={c.id} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{c.position}</span>
                {c.edited_by_user ? (
                  <Badge variant="secondary" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> edited
                  </Badge>
                ) : null}
              </div>
              <div className="flex gap-1">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => save(c.id)}
                      disabled={pending || !draft.trim()}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <Textarea
                rows={Math.max(4, Math.min(24, draft.split("\n").length + 1))}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-mono text-xs"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {c.content}
              </pre>
            )}

            {(meta.summary || (meta.stage?.length ?? 0) > 0 || (meta.intent?.length ?? 0) > 0) && (
              <div className="mt-3 flex flex-col gap-1 border-t pt-2 text-xs text-muted-foreground">
                {meta.summary ? <div>{meta.summary}</div> : null}
                <div className="flex flex-wrap gap-1.5">
                  {(meta.stage ?? []).map((s) => (
                    <Badge key={`s-${s}`} variant="outline" className="text-[10px]">
                      stage: {s}
                    </Badge>
                  ))}
                  {(meta.intent ?? []).map((i) => (
                    <Badge key={`i-${i}`} variant="outline" className="text-[10px]">
                      intent: {i}
                    </Badge>
                  ))}
                  {(meta.entities ?? []).slice(0, 6).map((e) => (
                    <Badge key={`e-${e}`} variant="outline" className="text-[10px]">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
