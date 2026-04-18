import { z } from "zod";
import { ContentTypeSchema, UUID } from "./common";

export const ChunkMetadataSchema = z
  .object({
    stage: z.array(z.string()).default([]),
    intent: z.array(z.string()).default([]),
    entities: z.array(z.string()).default([]),
    summary: z.string().optional(),
  })
  .catchall(z.any());
export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;

export const ChunkSchema = z.object({
  id: UUID,
  file_id: UUID.nullable(),
  agent_id: UUID,
  content: z.string(),
  content_type: ContentTypeSchema,
  metadata: ChunkMetadataSchema,
  position: z.number(),
  edited_by_user: z.boolean(),
  created_at: z.string(),
});
export type Chunk = z.infer<typeof ChunkSchema>;

export const ChunkPatchSchema = z.object({
  content: z.string().min(1),
});
export type ChunkPatch = z.infer<typeof ChunkPatchSchema>;

/** Schema the LLM-enrich call returns for a batch of chunks. */
export const EnrichedBatchSchema = z.object({
  items: z.array(
    z.object({
      stage: z.array(z.string()),
      intent: z.array(z.string()),
      entities: z.array(z.string()),
      summary: z.string(),
    }),
  ),
});
export type EnrichedBatch = z.infer<typeof EnrichedBatchSchema>;
