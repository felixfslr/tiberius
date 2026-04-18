<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Tiberius

Team project. Stack versions are newer than most training data — check `package.json` and `node_modules` docs before writing code, don't rely on memory.

## Stack

- **Next.js 16** (App Router, RSC) — read `node_modules/next/dist/docs/` for anything non-trivial
- **React 19.2** — new hooks, `use()`, Actions
- **TypeScript 6**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`) — CSS-first config in `src/app/globals.css`, no `tailwind.config.*` file
- **shadcn 4** (`style: base-nova`, `baseColor: neutral`, Lucide icons) — components under `src/components/ui/`
- **Base UI** (`@base-ui/react`) — headless primitives, used alongside shadcn. The local `Button` does **not** support `asChild`; wrap links with `buttonVariants()` instead.
- **Supabase** (`@supabase/ssr`) — SSR auth. See Auth section below.
- **Satoshi** — self-hosted variable font via `next/font/local` from `src/app/fonts/`. Exposed as `--font-satoshi` → mapped to `--font-sans` and `--font-heading` in `globals.css`. Don't add a second sans font.
- **Prettier 3.8** — formats on every Write/Edit via Claude hook

## Layout & aliases

```
src/
  app/         # App Router (layout.tsx, page.tsx, globals.css)
  components/  # @/components, UI primitives under ui/
  lib/         # @/lib, utils under utils
```

Aliases from `components.json`: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.

## Commands

```bash
npm run dev     # next dev
npm run build   # next build
npm run lint    # eslint (currently broken, see below)
```

## Auth (Supabase)

- Clients in `src/lib/supabase/`: `client.ts` (browser), `server.ts` (RSC + route handlers), `middleware.ts` (session refresh helper).
- **`src/proxy.ts`, not `middleware.ts`** — Next 16 renamed the file convention from `middleware` to `proxy`. Export a function named `proxy`. The helper in `src/lib/supabase/middleware.ts` keeps its name for parity with Supabase docs.
- Protected routes: the proxy redirects unauthenticated requests under `/dashboard` to `/login`. Extend that list in `src/proxy.ts` → `updateSession`, not via per-page guards.
- In Server Components always read the user with `supabase.auth.getUser()` (not `getSession()`) — `getUser()` validates the JWT.
- Env vars required in every environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Missing → 500 on every page (the server client throws at construction).

## Working with this repo (for Claude agents)

This is a 3-person hackathon team. **None of the teammates use the terminal** — they drive everything through Claude Code chat. Optimize for zero-friction.

### First-time setup on a new machine

After cloning, create `.env.local` in the repo root (it's gitignored — every machine needs its own):

```
NEXT_PUBLIC_SUPABASE_URL=https://kelnokyzpbboyhpfbudu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_wlXVnPxbq0tvG3YCphNOXA_vvBwWndn
```

Both values are publishable/public and safe to put in docs. Then `npm install && npm run dev`.

### Previewing locally before shipping

When the user wants to see a change before it goes live:

1. Start the dev server in the background: `npm run dev` (keep it running across turns; don't restart between edits).
2. Tell the user the URL — usually http://localhost:3000, but Next falls back to 3001+ if the port is taken, so read the actual port from the dev server output.
3. Edit files; Next.js hot-reloads in the browser automatically. No manual refresh needed.
4. If the user wants to share a preview with someone else without shipping to prod: push to a branch (e.g. `preview/<topic>`) — Vercel auto-deploys each branch to its own URL.
5. When the user says "ship it" / "push to main", commit and push.

### Shipping changes

- **Default: commit and push straight to `main`.** Every push to `main` auto-deploys to Vercel production in ~1 min.
- No PRs, no review gates, no branches — unless the user explicitly asks for a branch.
- Before pushing: `git pull --rebase origin main` to avoid collisions with teammates working in parallel.
- Small, frequent commits. Describe _why_ in the message, not _what_.

### When push is blocked

If the Claude Code harness blocks a direct push to main with a "bypasses PR review" message, **don't create a branch and PR workaround** — the user wants it on main. Tell the user to run `! git push origin main` in their prompt (the `!` prefix runs it in their shell, outside Claude's permission system).

### Supabase is a shared, cloud-only database

All three developers' localhosts **and** Vercel production talk to the same Supabase project (`kelnokyzpbboyhpfbudu`). There is no local DB. Schema changes take effect instantly for everyone — you can't "stage" a schema change.

Implications:

- Destructive changes (drop column, rename, `DELETE FROM`) break teammates' running localhosts the moment they run. Announce destructive changes in the team chat first.
- Test data lands in production-shared state. Use throwaway emails for seed users and clean up at demo time.
- App code (pages, components, types) still flows code → git → Vercel as normal.

### Schema changes must be committed as migrations

Even though the DB applies changes instantly, **every schema change gets a checked-in SQL file** so the team can see what changed and why. This is the only record of schema history.

Workflow for schema changes:

1. Apply the change via the Supabase MCP (`execute_sql` for iteration, then `apply_migration` once it's right — or hand-write the SQL).
2. Write the final SQL to `supabase/migrations/<YYYYMMDDHHMMSS>_<short_description>.sql`. Use UTC timestamp, snake_case description (e.g. `20260418093000_add_todos_table.sql`).
3. Enable RLS on any new table in an exposed schema (`public`) and add policies in the same migration file. No exceptions — the publishable key is public, RLS is the only defense.
4. Regenerate TypeScript types if the app code will use the new shape: ask Claude to run the MCP `generate_typescript_types` tool and write the output to `src/lib/supabase/database.types.ts`.
5. Commit the migration file, types file, and any app code touching the new schema in one commit. Push.

Reading existing schema: ask Claude to list tables / inspect columns via the Supabase MCP — don't guess.

### Env vars live in Vercel

Production/Preview/Development env vars are set on Vercel (managed via `vercel env`). When a page 500s after deploy, check env vars there first. `.env.local` is local-only; never commit it.

## shadcn MCP server

Pre-approved via `.mcp.json` + `.claude/settings.json`. Use it to list / view / add shadcn components instead of guessing APIs or reinventing primitives. When adding a new UI component, prefer `shadcn` registry over writing from scratch.

## Known issues

- **`npm run lint` is broken** — `eslint-config-next` is incompatible with ESLint 10 (`TypeError: contextOrFilename.getFilename is not a function`). Don't add an ESLint pre-commit hook until this resolves (downgrade to `eslint@^9` or wait for a Next patch).
