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

## shadcn MCP server

Pre-approved via `.mcp.json` + `.claude/settings.json`. Use it to list / view / add shadcn components instead of guessing APIs or reinventing primitives. When adding a new UI component, prefer `shadcn` registry over writing from scratch.

## Known issues

- **`npm run lint` is broken** — `eslint-config-next` is incompatible with ESLint 10 (`TypeError: contextOrFilename.getFilename is not a function`). Don't add an ESLint pre-commit hook until this resolves (downgrade to `eslint@^9` or wait for a Next patch).
