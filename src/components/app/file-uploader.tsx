"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileText, Type as TypeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const FILE_TYPES = [
  { value: "product_doc", label: "Product doc" },
  { value: "sop", label: "SOP" },
  { value: "glossary", label: "Glossary" },
  { value: "chat_history", label: "Chat history" },
  { value: "transcript", label: "Call transcript" },
  { value: "tov_example", label: "Tone-of-voice examples" },
  { value: "convo_snippet", label: "Conversation snippet" },
] as const;

export function FileUploader({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState<string>("product_doc");

  // Text paste
  const [textFilename, setTextFilename] = useState("notes.txt");
  const [textContent, setTextContent] = useState("");
  const [textType, setTextType] = useState<string>("product_doc");

  function onFilePick(files: FileList | null) {
    if (!files || files.length === 0) return;
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("file_type", fileType);
        const res = await fetch(`/api/v1/agents/${agentId}/files`, {
          method: "POST",
          body: fd,
        });
        const body = await res.json();
        if (!res.ok) {
          toast.error(`${file.name}: ${body?.error?.message ?? "upload failed"}`);
        } else {
          toast.success(`Uploaded ${file.name}`);
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
          file_type: textType,
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

  return (
    <Card className="p-4">
      <Tabs defaultValue="file" className="gap-4">
        <TabsList>
          <TabsTrigger value="file">
            <FileText className="mr-2 h-4 w-4" /> Upload file
          </TabsTrigger>
          <TabsTrigger value="text">
            <TypeIcon className="mr-2 h-4 w-4" /> Paste text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label>Type</Label>
              <Select value={fileType} onValueChange={(v) => v && setFileType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
            className={
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm transition " +
              (dragging ? "border-foreground bg-muted" : "hover:bg-muted/50")
            }
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="font-medium">
              {pending ? "Uploading…" : "Drop a file or click to browse"}
            </div>
            <div className="text-xs text-muted-foreground">
              PDF, DOCX, TXT, MD, JSON · up to ~25 MB
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
          <form onSubmit={onPasteSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-[2fr_1fr] gap-3">
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
                <Label>Type</Label>
                <Select value={textType} onValueChange={(v) => v && setTextType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                {pending ? "Saving…" : "Save & process"}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
