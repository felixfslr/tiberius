import { z } from "zod";

export const UUID = z.string().uuid();

export const ContentTypeSchema = z.enum([
  "product_doc",
  "sop",
  "glossary",
  "chat_history",
  "convo_snippet",
  "tov_example",
  "transcript",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const FileStatusSchema = z.enum([
  "pending",
  "extracting",
  "chunking",
  "enriching",
  "embedding",
  "ready",
  "failed",
]);
export type FileStatus = z.infer<typeof FileStatusSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.string().optional(),
});
export type Message = z.infer<typeof MessageSchema>;
