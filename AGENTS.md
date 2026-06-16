# Rules for AI

## Hard Rules

- Never concatenate Tailwind class strings manually — always use the `cn()` helper from `@/lib/utils`.
- Never use Next.js directives ("use client" etc.) in React components.
- Never commit secrets. Local secrets go in `.dev.vars` (Cloudflare) or `.env` (Node); both are gitignored.
- Always enable RLS on new Supabase tables with granular per-operation, per-role policies.
- API route handlers must validate input with zod schemas.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers. SSR mode — see @astro.config.mjs.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`.
- **React**: extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

Environment setup and deployment: see @README.md.

### Supabase workflow

- **Local dev**: `supabase-dev` MCP tools (connected to local instance at `http://127.0.0.1:54321/mcp`, started via `npx supabase start` in WSL).
- **Production**: `supabase` MCP tools (connected to hosted project).
- **Rule**: Always validate migrations locally (`supabase-dev-apply_migration`) before promoting to production.
- Migrations live in `supabase/migrations/` with format `YYYYMMDDHHmmss_short_description.sql`.

## GitHub Issues & PRs

### Issue conventions

- **Title format:** `[<roadmap-id>] Short description` — e.g., `[S-01] Batch creation form, parameters, and list page`
- **Roadmap ID prefixes:** `F-*` for foundation, `S-*` for slices
- **Labels:**
  - Type: `foundation` or `slice` (matches roadmap prefix)
  - Status: `status: proposed` → `status: ready` → `status: in-progress` → (closed)
  - Special: `north-star` for the validation milestone slice
- **Body:** Blockquote user story, then metadata table (Roadmap ID, Change ID, PRD refs, Prerequisites, Status)
- **Assignee:** Always assign to the implementing user

### PR conventions

- **Title:** Matches the linked issue title
- **Body:** Must include `Closes #<issue-number>`, a summary section, and a list of key changes
- **Base branch:** `main`
- **Merge strategy:** Squash merge preferred

### Workflow

After implementation is committed, use `/submit-pr` skill to automate: push → issue → PR → link output. Merge is always manual after review.

## Domain Knowledge

This is a **home winemaking** application. Domain-specific rules (fermentation timelines, sugar thresholds, process steps, stabilization protocols) are documented in `context/foundation/domain_knowledge.md`. Load that file when making changes to domain logic (e.g., process plan generation, validation rules, calculation services). Skip it for UI-only or infrastructure work.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to master. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.
