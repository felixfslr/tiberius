import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { assertAgentAccess, agentScopeFilter } from "./scope";
import { listAgents, getAgent, getAgentStats } from "@/lib/services/agents";
import {
  listFilesWithChunks,
  uploadText,
  getFile,
  deleteFile,
} from "@/lib/services/files";
import { hybridSearch, embedTrigger } from "@/lib/retrieval/hybrid-search";
import { draftReply } from "@/lib/services/replies";
import { FileTypeSchema } from "@/lib/schemas/file";
import { MessageSchema } from "@/lib/schemas/common";

function text(obj: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
  };
}

export function registerTools(server: McpServer): void {
  // ── Agent inventory ──────────────────────────────────────────────────────
  server.registerTool(
    "list_agents",
    {
      title: "List agents",
      description:
        "List every agent this API key can access. Workspace keys see all agents; agent-pinned keys see only their own. Call this first to discover agent_id values for the other tools.",
      inputSchema: {},
    },
    async (_args, { authInfo }) => {
      const scope = agentScopeFilter(authInfo);
      const all = await listAgents();
      const visible = scope === null ? all : all.filter((a) => a.id === scope);
      const withStats = await Promise.all(
        visible.map(async (a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          stats: await getAgentStats(a.id),
        })),
      );
      return text(withStats);
    },
  );

  server.registerTool(
    "get_agent",
    {
      title: "Get agent details",
      description:
        "Fetch an agent's name, description, config, and knowledge-base stats (file/chunk counts).",
      inputSchema: { agent_id: z.string().uuid() },
    },
    async ({ agent_id }, { authInfo }) => {
      assertAgentAccess(authInfo, agent_id);
      const [agent, stats] = await Promise.all([
        getAgent(agent_id),
        getAgentStats(agent_id),
      ]);
      if (!agent) throw new Error("not_found: agent does not exist");
      return text({ ...agent, stats });
    },
  );

  // ── Knowledge base retrieval ────────────────────────────────────────────
  server.registerTool(
    "search_knowledge",
    {
      title: "Search knowledge base",
      description:
        "Hybrid search (vector + full-text + RRF fusion) over an agent's knowledge base. Returns the top-k chunks ranked by relevance. Use this to answer questions about what the agent knows.",
      inputSchema: {
        agent_id: z.string().uuid(),
        query: z.string().min(1).max(4000),
        k: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ agent_id, query, k }, { authInfo }) => {
      assertAgentAccess(authInfo, agent_id);
      const embedding = await embedTrigger(query);
      const rows = await hybridSearch({
        agent_id,
        query_embedding: embedding,
        query_text: query,
        k: k ?? 10,
      });
      return text(
        rows.map((r) => ({
          id: r.id,
          file_id: r.file_id,
          content: r.content,
          content_type: r.content_type,
          score: r.score,
        })),
      );
    },
  );

  // ── Knowledge base write ────────────────────────────────────────────────
  server.registerTool(
    "add_knowledge",
    {
      title: "Add knowledge entry",
      description:
        "Append a text chunk (FAQ, SOP, product fact, tone-of-voice example, etc.) to an agent's knowledge base. Internally creates a file that the worker will chunk, enrich, and embed. Returns immediately with status='pending'; call list_knowledge to watch status flip to 'ready'.",
      inputSchema: {
        agent_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(50_000),
        file_type: FileTypeSchema.optional(),
      },
    },
    async ({ agent_id, title, content, file_type }, { authInfo }) => {
      assertAgentAccess(authInfo, agent_id);
      const row = await uploadText(
        agent_id,
        title,
        content,
        file_type ?? "product_doc",
        null,
      );
      return text({
        id: row.id,
        filename: row.filename,
        status: row.status,
        file_type: row.file_type,
      });
    },
  );

  server.registerTool(
    "list_knowledge",
    {
      title: "List knowledge entries",
      description:
        "List every file/knowledge entry attached to an agent, with processing status and chunk counts.",
      inputSchema: { agent_id: z.string().uuid() },
    },
    async ({ agent_id }, { authInfo }) => {
      assertAgentAccess(authInfo, agent_id);
      const files = await listFilesWithChunks(agent_id);
      return text(
        files.map((f) => ({
          id: f.id,
          filename: f.filename,
          file_type: f.file_type,
          status: f.status,
          chunks: f.chunks_count,
          uploaded_at: f.uploaded_at,
        })),
      );
    },
  );

  server.registerTool(
    "delete_knowledge",
    {
      title: "Delete knowledge entry",
      description:
        "Remove a file and its chunks from the agent's knowledge base.",
      inputSchema: {
        agent_id: z.string().uuid(),
        file_id: z.string().uuid(),
      },
    },
    async ({ agent_id, file_id }, { authInfo }) => {
      assertAgentAccess(authInfo, agent_id);
      const file = await getFile(file_id);
      if (!file) throw new Error("not_found: file does not exist");
      if (file.agent_id !== agent_id) {
        throw new Error("forbidden: file does not belong to this agent");
      }
      await deleteFile(file_id);
      return text({ deleted: true, file_id });
    },
  );

  // ── Invoke the agent ────────────────────────────────────────────────────
  server.registerTool(
    "ask_agent",
    {
      title: "Ask agent",
      description:
        "Send a message to the agent and get back its drafted reply. Runs the full Tiberius reply pipeline: retrieval → tree-of-drafts → confidence scoring. Optionally pass a short conversation history so the agent handles follow-ups naturally.",
      inputSchema: {
        agent_id: z.string().uuid(),
        message: z.string().min(1).max(4000),
        history: z.array(MessageSchema).max(50).optional(),
      },
    },
    async ({ agent_id, message, history }, { authInfo }) => {
      assertAgentAccess(authInfo, agent_id);
      const result = await draftReply(agent_id, {
        trigger_message: message,
        history: history ?? [],
      });
      // Strip the heavy debug payload — MCP clients get the user-facing reply.
      return text({
        reply_text: result.reply_text,
        confidence: result.confidence,
        detected_stage: result.detected_stage,
        detected_intent: result.detected_intent,
        suggested_tool: result.suggested_tool,
        tool_args: result.tool_args,
        below_threshold: result.below_threshold,
        reply_log_id: result.reply_log_id,
      });
    },
  );
}
