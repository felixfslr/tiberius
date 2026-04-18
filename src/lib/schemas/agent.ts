import { z } from "zod";
import { UUID } from "./common";

export const AgentConfigSchema = z.object({
  confidence_threshold: z.number().min(0).max(1).default(0.6),
  calendly_url: z.string().url().optional(),
  available_documents: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        storage_path: z.string().optional(),
      }),
    )
    .default([]),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentSchema = z.object({
  id: UUID,
  name: z.string(),
  description: z.string().nullable().optional(),
  config: AgentConfigSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  config: AgentConfigSchema.partial().optional(),
});
export type AgentCreate = z.infer<typeof AgentCreateSchema>;

export const AgentPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  config: AgentConfigSchema.partial().optional(),
});
export type AgentPatch = z.infer<typeof AgentPatchSchema>;
