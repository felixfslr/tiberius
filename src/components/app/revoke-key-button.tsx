"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function RevokeKeyButton({
  agentId,
  keyId,
  keyName,
}: {
  /** Omit for workspace keys. */
  agentId?: string;
  keyId: string;
  keyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const endpoint = agentId
    ? `/api/v1/agents/${agentId}/keys/${keyId}`
    : `/api/v1/keys/${keyId}`;

  function onRevoke() {
    if (
      !confirm(
        `Revoke key "${keyName}"? External callers using it will stop working.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error?.message ?? "Failed to revoke");
        return;
      }
      toast.success("Key revoked");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={onRevoke} disabled={pending}>
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">Revoke</span>
    </Button>
  );
}
