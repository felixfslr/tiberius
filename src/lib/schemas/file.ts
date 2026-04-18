import { z } from "zod";
import { ContentTypeSchema, FileStatusSchema, UUID } from "./common";

export const FileTypeSchema = ContentTypeSchema;
export type FileType = z.infer<typeof FileTypeSchema>;

export const FileSchema = z.object({
  id: UUID,
  agent_id: UUID,
  filename: z.string(),
  storage_path: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().nullable(),
  file_type: FileTypeSchema,
  status: FileStatusSchema,
  error: z.string().nullable(),
  metadata: z.record(z.string(), z.any()),
  uploaded_at: z.string(),
  processed_at: z.string().nullable(),
});
export type FileRow = z.infer<typeof FileSchema>;

export const FileTextCreateSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1),
  file_type: FileTypeSchema.default("product_doc"),
  folder_id: z.string().uuid().nullable().optional(),
});
export type FileTextCreate = z.infer<typeof FileTextCreateSchema>;
