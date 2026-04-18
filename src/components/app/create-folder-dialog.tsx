"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateFolderDialog({
  agentId,
  parentId = null,
  variant = "primary",
}: {
  agentId: string;
  parentId?: string | null;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          parent_id: parentId,
          description: description.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Create failed");
        return;
      }
      toast.success(`Folder "${trimmed}" created`);
      setName("");
      setDescription("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={variant === "primary" ? "default" : "outline"}
            size="sm"
          />
        }
      >
        <Plus className="mr-2 h-3.5 w-3.5" /> New folder
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create folder</DialogTitle>
          <DialogDescription>
            {parentId
              ? "Inside the current folder. Nest as deep as you want."
              : "Organize knowledge at the top level."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pricing & tiers"
              required
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-description">Description</Label>
            <Textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this folder is for…"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
