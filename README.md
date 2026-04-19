# Tiberius

AI reply-drafting agent for B2B sales conversations on WhatsApp / Telegram.
Built for the thinc! × Ivy hackathon.

**Pitch in one line:** given a prospect's incoming message + chat history, Tiberius
retrieves the right context from an editable knowledge base and drafts a grounded
reply with a real confidence score.

**Live**

- App & Playground: https://asktiberius.de
- API base: `https://asktiberius.de/api/v1`
- Swagger UI: https://asktiberius.de/api/docs/ui
- OpenAPI JSON: https://asktiberius.de/api/docs
- Default agent id (seeded "Ivy Sales Pre-Discovery"): `ae3becab-aac4-47ca-b17a-42ed39de4650`
- Worker: PM2 process `tiberius-worker` on the Hetzner dev box (see below).

## What makes it different

- **Hybrid retrieval** (not pure vector): HNSW semantic + FTS tsvector, fused via
  RRF, plus metadata-filtered search, plus entity-triggered lookup. Then an LLM
  listwise reranker over the merged top-25.
- **Structured prompt slots**: `kb_facts`, `sops`, `tov_examples`, `similar_past_convos`,
  `state`, `history`, `instructions` — each populated from retrieval so the generator
  can cite `[kb-N]` / `[sop-N]` tags.
- **Multi-signal confidence**: weighted average of retrieval coverage, intent classifier
  confidence, LLM-judged groundedness of the draft against the chunks, and (stub)
  self-consistency. Below the agent's threshold → `suggested_tool = flag_for_review`.
- **Editable context**: every chunk is inline-editable in the UI; saving re-embeds.
  Content-type-aware chunkers (glossary per-term, chat history per-conversation,
  SOPs per rule, etc.).
- **API-first**: everything the UI does is exposed at `/api/v1/*`, Bearer-auth,
  OpenAPI spec at `/api/docs`, Swagger UI at `/api/docs/ui`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 6 · Tailwind 4 · shadcn 4 ·
Supabase (Postgres + pgvector + Storage + Realtime) · OpenAI (`gpt-5.4`,
`gpt-5.4-mini`, `text-embedding-3-small`) via Vercel `ai` SDK 6 ·
PM2 worker on Hetzner (polls Postgres via service-role RPC — no DB password
in the stack).

## Run locally

```bash
# 1. Create .env.local (gitignored) — see below.
npm install

# 2. Apply DB migrations (shared Supabase project).
SUPABASE_ACCESS_TOKEN=<your_PAT> npx supabase@latest db push

# 3. Seed the default agent.
npm run seed

# 4. Start dev + worker (two terminals).
npm run dev         # app on :3007
npm run worker:dev  # file-processing worker
```

### Env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://kelnokyzpbboyhpfbudu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY=eyJ…
OPENAI_API_KEY=sk-…
OPENAI_MODEL_REPLY=gpt-5.4
OPENAI_MODEL_MINI=gpt-5.4-mini
OPENAI_MODEL_EMBED=text-embedding-3-small
```

## Key API calls

All external requests need `Authorization: Bearer <api_key>`. Create keys in the
UI at `/agents/<id>/api-keys` — the value is shown exactly once.

```bash
export TIB_BASE=https://asktiberius.de
export TIB_KEY=tib_…
export TIB_AGENT=ae3becab-aac4-47ca-b17a-42ed39de4650   # the seeded default
```

### Upload knowledge

```bash
# File upload
curl -X POST "$TIB_BASE/api/v1/agents/$TIB_AGENT/files" \
  -H "Authorization: Bearer $TIB_KEY" \
  -F "file=@./ivy-pricing.pdf" \
  -F "file_type=product_doc"

# Raw text
curl -X POST "$TIB_BASE/api/v1/agents/$TIB_AGENT/files/text" \
  -H "Authorization: Bearer $TIB_KEY" -H "Content-Type: application/json" \
  -d '{
    "filename": "competitor-notes.md",
    "file_type": "tov_example",
    "content": "Totally fair. Weve had a lot of teams move off BVNK for exactly that reason…"
  }'
```

### Generate a reply

```bash
curl -X POST "$TIB_BASE/api/v1/agents/$TIB_AGENT/reply" \
  -H "Authorization: Bearer $TIB_KEY" -H "Content-Type: application/json" \
  -d '{
    "trigger_message": "Hey, what does Ivy charge for USDC pay-ins? We do ~$50M/mo EU.",
    "history": [
      {"role": "assistant", "content": "Hi — Felix from Ivy, saw your USDC volume is growing."}
    ]
  }'
```

Response (public subset for external callers):

```json
{
  "data": {
    "reply_text": "Thanks — at that volume, pricing would be custom. …",
    "confidence": 0.87,
    "confidence_breakdown": {
      "retrieval": 0.99,
      "intent": 0.98,
      "groundedness": 0.8,
      "consistency": 0.7
    },
    "detected_stage": "qualifying",
    "detected_intent": "pricing",
    "suggested_tool": "send_calendly_link",
    "tool_args": { "calendly_url": "https://calendly.com/ivy-sales/discovery" },
    "reply_log_id": "…",
    "below_threshold": false,
    "retrieved_chunk_ids": ["…", "…"]
  },
  "error": null
}
```

### Config override per call

Add a `config_override` field to the request body to temporarily change
the confidence threshold or Calendly URL without touching the stored
agent config. Tone, length, and intent are mirrored from the incoming
message and are not configurable.

```json
{
  "trigger_message": "…",
  "history": [],
  "config_override": { "confidence_threshold": 0.4 }
}
```

## Architecture

```
Browser / UI                 External caller (n8n, Make, …)
  │ Supabase cookie            │ Authorization: Bearer tib_…
  └───────────┬─────────────────┘
              ▼
         Next 16 App
   ┌──────────┼──────────┐
   │   Service Layer     │   ← src/lib/services/*  (single source of truth)
   └──────────┼──────────┘
              ▼
┌─────────────────────────────────────┐
│ Supabase (Postgres / Storage / RT)  │
│  · pgvector HNSW cosine             │
│  · FTS tsvector                     │
│  · claim_pending_file() SKIP LOCKED │
└─────────────────────────────────────┘
              ▲
              │ service-role (no DB password needed)
┌─────────────────────────────────────┐
│ Worker on Hetzner under PM2         │
│  extract → chunk → enrich → embed   │
└─────────────────────────────────────┘
```

## Development

- `npm run dev` — Next on port 3007 (3000 is in use on the Hetzner box).
- `npm run worker:dev` — worker via `tsx watch`.
- `npm run seed` — creates the default "Ivy Sales Pre-Discovery" agent.
- `npm test` — unit tests (retrieval: entity extractor, RRF merge).
- `npm run eval` — eval runner against `eval/test_set.json` (LLM-as-judge).
- `npx tsx scripts/smoke-ingest.ts` — end-to-end upload + processing.
- `npx tsx scripts/smoke-retrieval.ts` — uploads sample knowledge + 3 probes.
- `npx tsx scripts/smoke-reply.ts` — /reply API smoke (needs seeded knowledge).
- `npx tsx scripts/retrieval-probe.ts "<trigger message>"` — CLI probe.

## Deployment

- **Vercel** hosts the Next.js app. `git push origin main` auto-deploys.
  Environment variables live in Vercel Project Settings → Environment Variables.
- **Hetzner** runs the worker under PM2:
  ```bash
  npm run worker:build   # tsup → dist-worker/index.js
  pm2 start ecosystem.config.js
  pm2 save
  ```
  The worker polls Supabase via the `claim_pending_file()` RPC — no direct
  Postgres connection, no DB password in the worker env.

## Schema changes

The Supabase project is shared across all three devs and production. Every
schema change is committed as a file under
`supabase/migrations/<UTC>_<name>.sql` and applied with:

```bash
SUPABASE_ACCESS_TOKEN=<your_PAT> npx supabase@latest db push
```

Destructive changes are announced in team chat first.
