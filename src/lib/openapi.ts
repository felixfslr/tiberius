import { z } from "zod";
import { AgentConfigSchema, AgentCreateSchema, AgentPatchSchema, AgentSchema } from "@/lib/schemas/agent";
import { FileTextCreateSchema } from "@/lib/schemas/file";
import { ChunkPatchSchema } from "@/lib/schemas/chunk";
import { ReplyRequestSchema, ReplyResponseSchema } from "@/lib/schemas/reply";

function toSchema(_name: string, schema: z.ZodType): Record<string, unknown> {
  // Zod v4 ships native JSON-schema conversion. We target OpenAPI 3.1 which
  // tolerates zod's defaults.
  return z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
}

export function buildOpenApi() {
  const envelopeOf = (ref: string) => ({
    type: "object",
    required: ["data", "error"],
    properties: {
      data: { $ref: ref },
      error: { type: ["object", "null"] },
    },
  });

  return {
    openapi: "3.1.0",
    info: {
      title: "Tiberius API",
      version: "0.1.0",
      description:
        "AI reply-drafting agent for sales conversations. Hybrid retrieval + grounded generation + multi-signal confidence. Auth via `Authorization: Bearer <key>`.",
    },
    servers: [
      { url: "/", description: "Same origin" },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "tib_*",
        },
      },
      schemas: {
        AgentConfig: toSchema("AgentConfig", AgentConfigSchema),
        Agent: toSchema("Agent", AgentSchema),
        AgentCreate: toSchema("AgentCreate", AgentCreateSchema),
        AgentPatch: toSchema("AgentPatch", AgentPatchSchema),
        FileTextCreate: toSchema("FileTextCreate", FileTextCreateSchema),
        ChunkPatch: toSchema("ChunkPatch", ChunkPatchSchema),
        ReplyRequest: toSchema("ReplyRequest", ReplyRequestSchema),
        ReplyResponse: toSchema("ReplyResponse", ReplyResponseSchema),
        ApiError: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            details: {},
          },
        },
      },
    },
    paths: {
      "/api/v1/agents": {
        get: {
          summary: "List agents",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: envelopeOf("#/components/schemas/Agent"),
                },
              },
            },
          },
        },
        post: {
          summary: "Create agent",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentCreate" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created",
              content: {
                "application/json": {
                  schema: envelopeOf("#/components/schemas/Agent"),
                },
              },
            },
          },
        },
      },
      "/api/v1/agents/{id}": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { summary: "Get agent", responses: { "200": { description: "OK" } } },
        patch: {
          summary: "Update agent",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentPatch" },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
        delete: { summary: "Delete agent", responses: { "200": { description: "OK" } } },
      },
      "/api/v1/agents/{id}/clone": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        post: {
          summary: "Clone an agent (copies config + chunks)",
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/v1/agents/{id}/files": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { summary: "List files for agent", responses: { "200": { description: "OK" } } },
        post: {
          summary: "Upload file (multipart)",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    file_type: {
                      type: "string",
                      enum: [
                        "product_doc",
                        "sop",
                        "glossary",
                        "chat_history",
                        "convo_snippet",
                        "tov_example",
                        "transcript",
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/v1/agents/{id}/files/text": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        post: {
          summary: "Upload raw text as a file",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FileTextCreate" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/v1/agents/{id}/files/{fileId}": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
          { in: "path", name: "fileId", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { summary: "Get file metadata", responses: { "200": { description: "OK" } } },
        post: { summary: "Reprocess file", responses: { "200": { description: "OK" } } },
        delete: { summary: "Delete file (cascades to chunks)", responses: { "200": { description: "OK" } } },
      },
      "/api/v1/agents/{id}/chunks": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
          { in: "query", name: "file_id", schema: { type: "string", format: "uuid" } },
          { in: "query", name: "content_type", schema: { type: "string" } },
          { in: "query", name: "limit", schema: { type: "integer", default: 50 } },
          { in: "query", name: "offset", schema: { type: "integer", default: 0 } },
        ],
        get: { summary: "List chunks", responses: { "200": { description: "OK" } } },
      },
      "/api/v1/chunks/{id}": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { summary: "Get chunk", responses: { "200": { description: "OK" } } },
        patch: {
          summary: "Update chunk content (re-embeds)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChunkPatch" },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
        delete: { summary: "Delete chunk", responses: { "200": { description: "OK" } } },
      },
      "/api/v1/agents/{id}/reply": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        post: {
          summary: "Draft a reply for an incoming message",
          description:
            "Runs retrieval (hybrid + metadata + entity) → rerank → grounded generation → multi-signal confidence. Below-threshold drafts return with suggested_tool=flag_for_review.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReplyRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: envelopeOf("#/components/schemas/ReplyResponse"),
                },
              },
            },
          },
        },
      },
      "/api/v1/agents/{id}/keys": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { summary: "List API keys (UI only)", responses: { "200": { description: "OK" } } },
        post: { summary: "Create API key (UI only)", responses: { "201": { description: "Created" } } },
      },
      "/api/v1/agents/{id}/keys/{keyId}": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
          { in: "path", name: "keyId", required: true, schema: { type: "string", format: "uuid" } },
        ],
        delete: { summary: "Revoke API key", responses: { "200": { description: "OK" } } },
      },
    },
  };
}
