import { z } from "zod";
import {
  AgentConfigSchema,
  AgentCreateSchema,
  AgentPatchSchema,
  AgentSchema,
} from "@/lib/schemas/agent";
import { FileTextCreateSchema } from "@/lib/schemas/file";
import { ChunkPatchSchema } from "@/lib/schemas/chunk";
import { ReplyRequestSchema, ReplyResponseSchema } from "@/lib/schemas/reply";
import { FeedbackSubmitSchema } from "@/lib/schemas/feedback";
import { getAppUrl } from "@/lib/urls";

function toSchema(_name: string, schema: z.ZodType): Record<string, unknown> {
  // Zod v4 ships native JSON-schema conversion. We target OpenAPI 3.1 which
  // tolerates zod's defaults.
  return z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
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

  const okEnvelope = (description: string) => ({
    description,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["data", "error"],
          properties: { data: {}, error: { type: ["object", "null"] } },
        },
      },
    },
  });

  const agentIdParam = {
    in: "path",
    name: "id",
    required: true,
    schema: { type: "string", format: "uuid" },
    description: "Agent UUID",
  } as const;

  return {
    openapi: "3.1.0",
    info: {
      title: "Tiberius API",
      version: "0.1.0",
      description: [
        "API-first reply-drafting agent for chat-based teams.",
        "",
        '**Pipeline per `/reply` call:** hybrid retrieval (HNSW vectors + tsvector FTS, fused via RRF) + metadata-filtered search + entity-triggered lookup → LLM listwise rerank → structured-slot prompt → grounded generation → multi-signal confidence (retrieval coverage + intent confidence + LLM groundedness). Below-threshold drafts return `suggested_tool: "flag_for_review"`.',
        "",
        "**Auth:** every request needs `Authorization: Bearer tib_…`. Keys are either **agent-scope** (created from the agent's API-keys page, can only act on that one agent) or **workspace-scope** (created via `/api/v1/keys`, used by MCP clients that need to span every agent — passes auth for any agent id).",
        "",
        "**Response envelope:** all responses are `{ data, error }`. On success `error` is `null`; on failure `data` is `null` and `error` is `{ code, message, details? }`.",
      ].join("\n"),
    },
    servers: [
      { url: getAppUrl(), description: "Production" },
      { url: "/", description: "Same origin as the docs" },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "tib_*",
          description:
            "Bearer token. Use `tib_live_…` (agent-scope) or `tib_ws_…` (workspace-scope).",
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
        FeedbackSubmit: toSchema("FeedbackSubmit", FeedbackSubmitSchema),
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
    tags: [
      {
        name: "Agents",
        description: "Create, list, configure, clone, delete agents.",
      },
      {
        name: "Files",
        description:
          "Upload knowledge — multipart, raw text, or signed direct-to-Storage upload.",
      },
      {
        name: "Folders",
        description: "Organize files into a folder tree per agent.",
      },
      {
        name: "Chunks",
        description:
          "Inspect and edit the chunks produced by the ingestion pipeline. Editing re-embeds.",
      },
      {
        name: "Reply",
        description: "The headline endpoint — draft a grounded reply.",
      },
      {
        name: "Feedback",
        description:
          "Closed-loop chunk improvement: submit feedback on a draft, the system proposes an edit, you apply or dismiss.",
      },
      {
        name: "Graph",
        description:
          "Read-only knowledge-graph view (entities + chunk relationships) for the dashboard graph page.",
      },
      {
        name: "Keys",
        description:
          "Manage API keys. Agent-scope keys live under an agent; workspace-scope keys live at the top level for MCP clients.",
      },
    ],
    paths: {
      "/api/v1/agents": {
        get: {
          tags: ["Agents"],
          summary: "List agents",
          description:
            "Returns every agent the authenticated principal can see. Session-scope auth sees the whole workspace; api-key-scope auth sees only the agent the key is pinned to.",
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
          tags: ["Agents"],
          summary: "Create agent",
          description:
            "Creates a new agent with a default `AgentConfig`. The body only needs a name and use-case; everything else (retrieval params, confidence thresholds, voice) can be patched later.",
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
        parameters: [agentIdParam],
        get: {
          tags: ["Agents"],
          summary: "Get agent",
          description: "Returns the full agent record including `config`.",
          responses: { "200": okEnvelope("OK") },
        },
        patch: {
          tags: ["Agents"],
          summary: "Update agent",
          description:
            "Partial update. Patching `config` deep-merges into the existing config — provide only the fields you want to change.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentPatch" },
              },
            },
          },
          responses: { "200": okEnvelope("OK") },
        },
        delete: {
          tags: ["Agents"],
          summary: "Delete agent",
          description:
            "Permanently deletes the agent. Cascades to files, chunks, keys, reply logs, and feedback.",
          responses: { "200": okEnvelope("Deleted") },
        },
      },
      "/api/v1/agents/{id}/clone": {
        parameters: [agentIdParam],
        post: {
          tags: ["Agents"],
          summary: "Clone an agent",
          description:
            "Creates a new agent that copies the source agent's config, files, and chunks. Use this to fork a tuned setup for a new team or use case.",
          responses: { "201": okEnvelope("Created") },
        },
      },
      "/api/v1/agents/{id}/files": {
        parameters: [agentIdParam],
        get: {
          tags: ["Files"],
          summary: "List files",
          description:
            "Returns every file uploaded to this agent with status (`uploading | pending | processing | ready | error`).",
          responses: { "200": okEnvelope("OK") },
        },
        post: {
          tags: ["Files"],
          summary: "Upload file (multipart)",
          description:
            "Multipart upload — the API streams the file to Storage and inserts a `files` row, then the worker picks it up. Use this for files up to a few MB. For larger files, prefer the signed-upload flow (`/files/sign` + `/files/{id}/commit`).",
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
                      description:
                        "Drives the chunker. `glossary` chunks per term, `chat_history` per conversation, `sop` per rule, `tov_example` keeps short tone snippets intact, etc.",
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
                    folder_id: {
                      type: "string",
                      format: "uuid",
                      description: "Optional folder to attach the file to.",
                    },
                  },
                },
              },
            },
          },
          responses: { "201": okEnvelope("Created") },
        },
      },
      "/api/v1/agents/{id}/files/text": {
        parameters: [agentIdParam],
        post: {
          tags: ["Files"],
          summary: "Upload raw text as a file",
          description:
            "Bypasses extraction. The text is stored as a synthetic file and immediately handed to the chunk/enrich/embed pipeline. Useful for pasted snippets, n8n outputs, or transcripts already in plain text.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FileTextCreate" },
              },
            },
          },
          responses: { "201": okEnvelope("Created") },
        },
      },
      "/api/v1/agents/{id}/files/sign": {
        parameters: [agentIdParam],
        post: {
          tags: ["Files"],
          summary: "Get a signed direct-upload URL",
          description:
            "Step 1 of the large-file flow. Returns a one-shot signed URL the client can `PUT` the file to directly (bypasses the API function's body-size limits and 100MB cap). After the PUT, call `POST /files/{fileId}/commit`.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["filename", "size_bytes"],
                  properties: {
                    filename: { type: "string", maxLength: 255 },
                    size_bytes: {
                      type: "integer",
                      maximum: 104857600,
                      description: "100 MB cap.",
                    },
                    mime_type: { type: ["string", "null"] },
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
                      default: "product_doc",
                    },
                    folder_id: {
                      type: ["string", "null"],
                      format: "uuid",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": okEnvelope(
              "Signed URL + file id — PUT the file to `signed_url`, then POST to `/files/{file_id}/commit`.",
            ),
          },
        },
      },
      "/api/v1/agents/{id}/files/{fileId}": {
        parameters: [
          agentIdParam,
          {
            in: "path",
            name: "fileId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        get: {
          tags: ["Files"],
          summary: "Get file metadata",
          description:
            "Returns the file row including current `status` and any error message.",
          responses: { "200": okEnvelope("OK") },
        },
        post: {
          tags: ["Files"],
          summary: "Reprocess file",
          description:
            "Re-queues the file for the worker. Old chunks are cleared first — useful after the chunker or enrichment prompt changes.",
          responses: { "200": okEnvelope("Reprocessing") },
        },
        delete: {
          tags: ["Files"],
          summary: "Delete file",
          description: "Cascades to all chunks produced from this file.",
          responses: { "200": okEnvelope("Deleted") },
        },
      },
      "/api/v1/agents/{id}/files/{fileId}/commit": {
        parameters: [
          agentIdParam,
          {
            in: "path",
            name: "fileId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        post: {
          tags: ["Files"],
          summary: "Commit a signed upload",
          description:
            "Step 2 of the large-file flow. Call this after the client successfully PUT the bytes to the signed URL from `/files/sign`. Flips the file from `uploading` → `pending` so the worker picks it up.",
          responses: { "200": okEnvelope("Committed — pipeline started") },
        },
      },
      "/api/v1/agents/{id}/folders": {
        parameters: [agentIdParam],
        get: {
          tags: ["Folders"],
          summary: "List folders",
          description:
            "Returns the folder tree for this agent. Used by the dashboard knowledge view.",
          responses: { "200": okEnvelope("OK") },
        },
        post: {
          tags: ["Folders"],
          summary: "Create folder",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string", minLength: 1 },
                    parent_id: {
                      type: ["string", "null"],
                      format: "uuid",
                      description: "Optional parent for nesting.",
                    },
                    description: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: { "201": okEnvelope("Created") },
        },
      },
      "/api/v1/agents/{id}/folders/{folderId}": {
        parameters: [
          agentIdParam,
          {
            in: "path",
            name: "folderId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        patch: {
          tags: ["Folders"],
          summary: "Rename / describe folder",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", minLength: 1 },
                    description: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: { "200": okEnvelope("OK") },
        },
        delete: {
          tags: ["Folders"],
          summary: "Delete folder",
          description: "Files inside the folder are detached, not deleted.",
          responses: { "200": okEnvelope("Deleted") },
        },
      },
      "/api/v1/agents/{id}/chunks": {
        parameters: [
          agentIdParam,
          {
            in: "query",
            name: "file_id",
            schema: { type: "string", format: "uuid" },
            description: "Filter to one source file.",
          },
          {
            in: "query",
            name: "content_type",
            schema: { type: "string" },
            description:
              "Filter by enriched content type (e.g. `pricing`, `policy`, `tov_example`).",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 50 },
          },
          {
            in: "query",
            name: "offset",
            schema: { type: "integer", default: 0 },
          },
        ],
        get: {
          tags: ["Chunks"],
          summary: "List chunks",
          description:
            "Returns the chunks the retrieval system can pull from. Each chunk has its enriched metadata (content type, entities, summary).",
          responses: { "200": okEnvelope("OK") },
        },
      },
      "/api/v1/chunks/{id}": {
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        get: {
          tags: ["Chunks"],
          summary: "Get chunk",
          responses: { "200": okEnvelope("OK") },
        },
        patch: {
          tags: ["Chunks"],
          summary: "Edit chunk content",
          description:
            "Saves the new content and **re-embeds** synchronously. Use this from the inline editor when a chunk is wrong or stale — no need to reprocess the whole file.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChunkPatch" },
              },
            },
          },
          responses: { "200": okEnvelope("OK") },
        },
        delete: {
          tags: ["Chunks"],
          summary: "Delete chunk",
          responses: { "200": okEnvelope("Deleted") },
        },
      },
      "/api/v1/agents/{id}/reply": {
        parameters: [agentIdParam],
        post: {
          tags: ["Reply"],
          summary: "Draft a reply for an incoming message",
          description: [
            "The headline endpoint. Given a trigger message and (optional) chat history, returns a grounded draft reply with a confidence score and citations to the chunks it used.",
            "",
            "Pipeline: hybrid retrieval (semantic + FTS, fused via RRF) + metadata-filtered search + entity-triggered lookup → LLM listwise rerank over the merged top-25 → structured-slot prompt (`kb_facts`, `sops`, `tov_examples`, `similar_past_convos`, `state`, `history`, `instructions`) → grounded generation with `[kb-N]` / `[sop-N]` citation tags → multi-signal confidence (weighted avg of retrieval coverage + intent classifier + LLM groundedness).",
            "",
            'If the confidence is below the agent\'s `confidence_threshold`, the response includes `suggested_tool: "flag_for_review"` so callers (n8n, the Gmail extension, etc.) can route the draft to a human instead of sending it.',
          ].join("\n"),
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
      "/api/v1/agents/{id}/feedback": {
        parameters: [agentIdParam],
        get: {
          tags: ["Feedback"],
          summary: "List feedback for this agent",
          description:
            "Returns submitted feedback rows with their analysis status. Use the `status` query param (`pending | analyzing | analyzed | applying | applied | dismissed | failed | all`) to filter.",
          parameters: [
            {
              in: "query",
              name: "status",
              schema: {
                type: "string",
                enum: [
                  "pending",
                  "analyzing",
                  "analyzed",
                  "applying",
                  "applied",
                  "dismissed",
                  "failed",
                  "all",
                ],
              },
            },
          ],
          responses: { "200": okEnvelope("OK") },
        },
        post: {
          tags: ["Feedback"],
          summary: "Submit feedback on a reply",
          description:
            "Attaches free-text feedback to a previous `reply_log` (returned in the reply response). The mini-model then analyzes it against the chunks the reply cited and proposes a concrete `edit_chunk` / `add_chunk` / `deprecate_chunk` action — visible via the list endpoint, applied via `/feedback/{id}/apply`.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedbackSubmit" },
              },
            },
          },
          responses: { "200": okEnvelope("Submitted — analysis is async") },
        },
      },
      "/api/v1/feedback/{id}/apply": {
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        post: {
          tags: ["Feedback"],
          summary: "Apply the proposed chunk edit",
          description:
            "Executes the analyzer's `edit_chunk` / `add_chunk` / `deprecate_chunk` action against the knowledge base. Re-embeds touched chunks.",
          responses: { "200": okEnvelope("Applying") },
        },
      },
      "/api/v1/feedback/{id}/dismiss": {
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        post: {
          tags: ["Feedback"],
          summary: "Dismiss feedback",
          description:
            "Marks the feedback row as `dismissed` without applying any change.",
          responses: { "200": okEnvelope("Dismissed") },
        },
      },
      "/api/v1/feedback/{id}/retry": {
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        post: {
          tags: ["Feedback"],
          summary: "Retry analysis",
          description:
            "Resets the row to `pending` so the analyzer re-runs. Use after a `failed` analysis or after editing the underlying chunks.",
          responses: { "200": okEnvelope("Pending") },
        },
      },
      "/api/v1/agents/{id}/graph": {
        parameters: [
          agentIdParam,
          {
            in: "query",
            name: "fresh",
            schema: { type: "string", enum: ["1"] },
            description: "Set `fresh=1` to bypass the cache and recompute.",
          },
          {
            in: "query",
            name: "topK",
            schema: { type: "integer", minimum: 1, maximum: 15, default: 5 },
            description: "Top-K neighbors per node when building edges (1–15).",
          },
        ],
        get: {
          tags: ["Graph"],
          summary: "Get knowledge-graph data",
          description:
            "Returns nodes (entities + chunks) and edges for the dashboard graph view. Cached server-side; pass `fresh=1` to recompute.",
          responses: { "200": okEnvelope("OK") },
        },
      },
      "/api/v1/agents/{id}/keys": {
        parameters: [agentIdParam],
        get: {
          tags: ["Keys"],
          summary: "List API keys for an agent",
          description:
            "Returns active keys. Only the prefix is exposed — the full key value is shown exactly once at creation time.",
          responses: { "200": okEnvelope("OK") },
        },
        post: {
          tags: ["Keys"],
          summary: "Create an agent-scope API key",
          description:
            "Creates a key pinned to this one agent. The full `tib_…` value is in the response and **cannot be retrieved later** — store it now.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: {
                      type: "string",
                      description:
                        "Human-readable label (e.g. 'n8n production', 'Gmail extension').",
                    },
                  },
                },
              },
            },
          },
          responses: { "201": okEnvelope("Created — full key in response") },
        },
      },
      "/api/v1/agents/{id}/keys/{keyId}": {
        parameters: [
          agentIdParam,
          {
            in: "path",
            name: "keyId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        delete: {
          tags: ["Keys"],
          summary: "Revoke API key",
          description:
            "Permanently revokes the key. Subsequent requests with it return 401.",
          responses: { "200": okEnvelope("Revoked") },
        },
      },
      "/api/v1/keys": {
        get: {
          tags: ["Keys"],
          summary: "List workspace-scope keys",
          description:
            "Workspace keys (`agent_id = null`) span every agent in the workspace. Used by MCP clients (Claude Desktop, ChatGPT) that need one connector for the whole workspace. Session-auth only — api-key callers cannot manage keys.",
          responses: { "200": okEnvelope("OK") },
        },
        post: {
          tags: ["Keys"],
          summary: "Create a workspace-scope key",
          description:
            "Creates a key with `agent_id = null` that passes auth for any agent. Session-auth only.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string", maxLength: 120 } },
                },
              },
            },
          },
          responses: { "201": okEnvelope("Created — full key in response") },
        },
      },
      "/api/v1/keys/{keyId}": {
        parameters: [
          {
            in: "path",
            name: "keyId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        delete: {
          tags: ["Keys"],
          summary: "Revoke a workspace key",
          description: "Session-auth only.",
          responses: { "200": okEnvelope("Revoked") },
        },
      },
    },
  };
}
