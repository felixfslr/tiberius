"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileUploader } from "./file-uploader";

export function UploadDialog({
  agentId,
  folderId = null,
  folderName,
  trigger,
}: {
  agentId: string;
  folderId?: string | null;
  folderName?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            <>{trigger}</>
          ) : (
            <Button size="sm">
              <Upload className="mr-2 h-3.5 w-3.5" /> Upload files
            </Button>
          )
        }
      />
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {folderName ? `Upload into ${folderName}` : "Upload files"}
          </DialogTitle>
        </DialogHeader>
        <FileUploader
          agentId={agentId}
          folderId={folderId}
          folderName={folderName}
        />
      </DialogContent>
    </Dialog>
  );
}
