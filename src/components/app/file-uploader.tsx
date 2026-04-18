"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileText, Type as TypeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function FileUploader({
  agentId,
  folderId = null,
  folderName,
}: {
  agentId: string;
  folderId?: string | null;
  folderName?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [textFilename, setTextFilename] = useState("notes.txt");
  const [textContent, setTextContent] = useState("");

  function onFilePick(files: FileList | null) {
    if (!files || files.length === 0) return;
    startTransition(async () => {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        try {
          const signRes = await fetch(`/api/v1/agents/${agentId}/files/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              size_bytes: file.size,
              mime_type: file.type || null,
              folder_id: folderId,
            }),
          });
          const signBody = await signRes.json();
          if (!signRes.ok) {
            toast.error(
              `${file.name}: ${signBody?.error?.message ?? "sign failed"}`,
            );
            continue;
          }
          const { file_id, storage_path, token } = signBody.data;

          const { error: upErr } = await supabase.storage
            .from("knowledge")
            .uploadToSignedUrl(storage_path, token, file, {
              contentType: file.type || "application/octet-stream",
              upsert: true,
            });
          if (upErr) {
            toast.error(`${file.name}: ${upErr.message}`);
            continue;
          }

          const commitRes = await fetch(
            `/api/v1/agents/${agentId}/files/${file_id}/commit`,
            { method: "POST" },
          );
          const commitBody = await commitRes.json();
          if (!commitRes.ok) {
            toast.error(
              `${file.name}: ${commitBody?.error?.message ?? "commit failed"}`,
            );
            continue;
          }
          toast.success(`Uploaded ${file.name}`);
        } catch (e) {
          toast.error(`${file.name}: ${(e as Error).message}`);
        }
      }
      router.refresh();
    });
  }

  function onPasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textContent.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/agents/${agentId}/files/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: textFilename,
          content: textContent,
          folder_id: folderId,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "upload failed");
      } else {
        toast.success(`Saved ${textFilename}`);
        setTextContent("");
      }
      router.refresh();
    });
  }

  const destLabel = folderName ? `into ${folderName}` : "";

  return (
    <Card className="p-5 shadow-sm">
      <Tabs defaultValue="file" className="gap-4">
        <TabsList>
          <TabsTrigger value="file">
            <FileText className="mr-2 h-4 w-4" /> Upload file
          </TabsTrigger>
          <TabsTrigger value="text">
            <TypeIcon className="mr-2 h-4 w-4" /> Paste text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFilePick(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-sm transition",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div className="font-medium">
              {pending ? "Uploading…" : "Drop a file or click to browse"}
            </div>
            <div className="text-xs text-muted-foreground">
              PDF, DOCX, TXT, MD, JSON · up to ~25 MB {destLabel}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.txt,.md,.json,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json"
              onChange={(e) => onFilePick(e.target.files)}
            />
          </div>
        </TabsContent>

        <TabsContent value="text">
          <form onSubmit={onPasteSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="paste-filename">Filename</Label>
              <Input
                id="paste-filename"
                value={textFilename}
                onChange={(e) => setTextFilename(e.target.value)}
                placeholder="ivy-cheatsheet.txt"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="paste-content">Content</Label>
              <Textarea
                id="paste-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder="Paste glossary, chat history, SOP, or any raw text…"
                required
              />
            </div>
            <div>
              <Button type="submit" disabled={pending || !textContent.trim()}>
                {pending
                  ? "Saving…"
                  : `Save & process${destLabel ? " " + destLabel : ""}`}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
