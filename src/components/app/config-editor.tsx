"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Agent, AgentConfig } from "@/lib/schemas/agent";

export function ConfigEditor({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<AgentConfig>(agent.config);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [pending, startTransition] = useTransition();

  function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          config: cfg,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error?.message ?? "save failed");
        return;
      }
      toast.success("Config saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-6">
      <Card className="p-4">
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-desc">Description</Label>
            <Input
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="threshold">
              Confidence threshold (
              <span className="font-mono">
                {cfg.confidence_threshold.toFixed(2)}
              </span>
              )
            </Label>
            <Input
              id="threshold"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={cfg.confidence_threshold}
              onChange={(e) =>
                update(
                  "confidence_threshold",
                  Math.max(0, Math.min(1, Number(e.target.value))),
                )
              }
            />
            <div className="text-xs text-muted-foreground">
              Below this, the tool is forced to <code>flag_for_review</code>.
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="calendly">Calendly URL</Label>
            <Input
              id="calendly"
              type="url"
              value={cfg.calendly_url ?? ""}
              onChange={(e) =>
                update(
                  "calendly_url",
                  e.target.value ? e.target.value : undefined,
                )
              }
              placeholder="https://calendly.com/…"
            />
          </div>
        </div>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          <Save className="mr-2 h-4 w-4" />
          {pending ? "Saving…" : "Save config"}
        </Button>
      </div>
    </form>
  );
}
