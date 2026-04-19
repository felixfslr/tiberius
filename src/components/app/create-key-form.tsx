"use client";

import { useState, useTransition } from "react";
import { Plus, Copy, Check } from "lucide-react";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CreateKeyForm({
  agentId,
  workspace,
  label,
}: {
  /** Omit for a workspace-scope key (MCP multi-agent). */
  agentId?: string;
  workspace?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ plaintext: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const endpoint = workspace
    ? "/api/v1/keys"
    : `/api/v1/agents/${agentId}/keys`;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to create key");
        return;
      }
      setCreated({ plaintext: body.data.plaintext });
    });
  }

  function onClose() {
    setOpen(false);
    setName("");
    setCreated(null);
    setCopied(false);
    router.refresh();
  }

  async function copy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : onClose())}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> {label ?? "Create key"}
      </DialogTrigger>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                You&apos;ll see the key once, right after creation. Copy it
                somewhere safe.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="n8n production"
                  required
                  minLength={1}
                  maxLength={120}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Your API key</DialogTitle>
              <DialogDescription>
                Store this now — it won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">
              {created.plaintext}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </>
                )}
              </Button>
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
