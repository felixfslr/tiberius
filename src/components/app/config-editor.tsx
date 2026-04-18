"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Agent, AgentConfig } from "@/lib/schemas/agent";

const TONES = [
  { value: "professional-warm", label: "Professional + warm" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "direct", label: "Direct" },
  { value: "friendly", label: "Friendly" },
];

const LENGTHS = [
  { value: "short", label: "Short (1–2 sentences)" },
  { value: "medium", label: "Medium (2–4 sentences)" },
  { value: "long", label: "Long (4–8 sentences)" },
];

const GOALS = [
  { value: "book_discovery_call", label: "Book a discovery call" },
  { value: "qualify_lead", label: "Qualify the lead" },
  { value: "answer_question", label: "Answer the question" },
  { value: "handle_objection", label: "Handle an objection" },
  { value: "follow_up", label: "Follow up (re-engage)" },
];

const PUSHINESS = [
  { value: "low", label: "Low — soft asks, offer only" },
  { value: "medium", label: "Medium — confident, concrete" },
  { value: "high", label: "High — drive to the goal each reply" },
];

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
            <Label>Tone</Label>
            <Select value={cfg.tone} onValueChange={(v) => v && update("tone", v as AgentConfig["tone"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Response length</Label>
            <Select
              value={cfg.response_length}
              onValueChange={(v) => v && update("response_length", v as AgentConfig["response_length"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTHS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Goal</Label>
            <Select value={cfg.goal} onValueChange={(v) => v && update("goal", v as AgentConfig["goal"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Pushiness</Label>
            <Select
              value={cfg.pushiness}
              onValueChange={(v) => v && update("pushiness", v as AgentConfig["pushiness"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PUSHINESS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="threshold">
              Confidence threshold (<span className="font-mono">{cfg.confidence_threshold.toFixed(2)}</span>)
            </Label>
            <Input
              id="threshold"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={cfg.confidence_threshold}
              onChange={(e) =>
                update("confidence_threshold", Math.max(0, Math.min(1, Number(e.target.value))))
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
                update("calendly_url", e.target.value ? e.target.value : undefined)
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
