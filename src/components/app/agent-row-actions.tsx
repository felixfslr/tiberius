"use client";

import { useTransition } from "react";
import { MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cloneAgentAction, deleteAgentAction } from "@/app/actions/agents";
import { toast } from "sonner";

export function AgentRowActions({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [pending, startTransition] = useTransition();

  function onClone() {
    startTransition(async () => {
      try {
        await cloneAgentAction(agentId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        if (msg.includes("NEXT_REDIRECT")) return;
        toast.error(msg);
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${agentName}"? This removes all its files and chunks.`)) return;
    startTransition(async () => {
      try {
        await deleteAgentAction(agentId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        if (msg.includes("NEXT_REDIRECT")) return;
        toast.error(msg);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" disabled={pending} />}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onClone}>
          <Copy className="mr-2 h-4 w-4" /> Clone agent
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
