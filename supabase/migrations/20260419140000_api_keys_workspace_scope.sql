-- Make api_keys.agent_id nullable to support workspace-scope keys.
--   agent_id = <uuid>  → agent-pinned key (can only act on that agent) — existing REST API keys.
--   agent_id = NULL    → workspace key — can act on any agent in the workspace. Used by
--                        MCP clients (Claude Desktop, ChatGPT) that want one connector to
--                        talk to every agent.
alter table api_keys alter column agent_id drop not null;

-- Cheap filter index for workspace keys.
create index if not exists api_keys_workspace_idx on api_keys ((agent_id is null));
