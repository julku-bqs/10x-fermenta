# Plan: Cloudflare Workers Integration & Deployment

## TL;DR

Deploy the Fermenta Astro 6 app to Cloudflare Workers using **Cloudflare Workers Builds** (native Git integration) for auto-deploy on push to `main`. No GitHub Actions deploy job - existing GHA stays as lint-only CI. The project already has `@astrojs/cloudflare` v13 and `wrangler.jsonc`, so this plan covers renaming, local dev setup, first manual deploy, connecting Git for auto-deploy, secrets, and edge-case hardening.

---

## Phase 0: Prerequisites - CLI & Supabase Setup

**Cloudflare CLI (Wrangler)**

- [x] **0.1** Ensure Node.js >= 18 is installed (`node -v`)
- [x] **0.2** Run `npm install` - Wrangler `^4.95.0` is already a devDependency, installs locally
- [x] **0.3** Create a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com) if you don't have one
- [x] **0.4** Opt into the Workers Free plan: Dashboard > Workers & Pages > Overview (must be done once before any deploy will succeed)
- [x] **0.5** **Edge case - corporate network/proxy**: If behind a corporate proxy, set `HTTPS_PROXY` env var before running `wrangler login`. Wrangler uses system proxy settings but doesn't always auto-detect them.

**Supabase (hosted project for production)**

- [x] **0.6** Create a Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard) (free tier is fine)
- [x] **0.7** Note the **Project URL** and **anon public key** from Settings > API:
  - `SUPABASE_URL` = `https://<project-ref>.supabase.co`
  - `SUPABASE_KEY` = the `anon` / `public` key (NOT the `service_role` key)
- [x] **0.8** Configure auth settings in Supabase Dashboard > Authentication > URL Configuration:
  - **Site URL**: set to `http://localhost:4321` (for local dev initially; update to production URL after Phase 3)
  - **Redirect URLs**: add `http://localhost:4321/**` for local dev
- [x] **0.9** **Edge case - email confirmation**: By default Supabase requires email confirmation on signup. For faster dev iteration:
  - Dashboard > Authentication > Providers > Email > disable "Confirm email"
  - Or leave enabled and use Inbucket locally (see 0.11)
- [x] **0.10** **Edge case - rate limits on free tier**: Supabase free tier limits auth to 4 emails/hour for signups. Use local Supabase (0.11) for rapid testing.

**Supabase (local dev - optional but recommended)**

- [x] **0.11** Install Docker Desktop (required for local Supabase, needs ~7 GB RAM)
- [x] **0.12** Run `npx supabase start` - spins up local Postgres, Auth, Studio, and Inbucket (email catcher)
- [x] **0.13** Copy the printed `API URL` and `anon key` into `.dev.vars`:
  ```
  SUPABASE_URL=http://127.0.0.1:54321
  SUPABASE_KEY=<printed-anon-key>
  ```
- [x] **0.14** Access local Studio at `http://127.0.0.1:54323` and Inbucket (email) at `http://127.0.0.1:54324`
- [x] **0.15** **Edge case - port conflicts**: If ports 54321-54324 conflict, override them in `supabase/config.toml` under `[api]`, `[db]`, `[studio]`, `[inbucket]` sections.
- [x] **0.16** To stop: `npx supabase stop` (add `--no-backup` to discard local DB state)

**GitHub repository**

- [x] **0.17** Ensure the repo is pushed to GitHub with `main` as the default branch
- [x] **0.18** Verify you have admin access to the repo (needed to install the Cloudflare GitHub App in Phase 5)

---

## Phase 1: Local Configuration & Renaming

- [ ] **1.1** Rename Worker from `10x-astro-starter` to `fermenta` in `wrangler.jsonc`
- [ ] **1.2** Update `.github/workflows/ci.yml` branch references from `master` to `main` (repo default is already `main`)
- [ ] **1.3** Create `.dev.vars` from `.env.example` template with actual Supabase credentials for local dev
- [ ] **1.4** Add `"deploy"` script to `package.json` (`wrangler deploy`) for manual deploys
- [ ] **1.5** Verify local dev still works with workerd runtime (`npm run dev`)

---

## Phase 2: Cloudflare Account & Authentication

- [ ] **2.1** Authenticate Wrangler CLI (`npx wrangler login`) - opens browser OAuth flow
- [ ] **2.2** Verify account access (`npx wrangler whoami`)
- [ ] **2.3** **Edge case**: If using a Cloudflare account with no Workers plan activated, the free tier must be opted into via the dashboard first (Workers & Pages > Overview). `wrangler deploy` will fail with `workers.api.error.unauthorized` otherwise.

---

## Phase 3: First Manual Deploy

- [ ] **3.1** Run production build: `npm run build`
- [ ] **3.2** Dry-run deploy to verify bundle size and config: `npx wrangler deploy --dry-run`
- [ ] **3.3** Deploy to production: `npx wrangler deploy`
  - First deploy auto-creates the Worker project named `fermenta` on Cloudflare
  - Confirm Worker URL is assigned (format: `fermenta.<subdomain>.workers.dev`)
- [ ] **3.4** **Edge case - first deploy without secrets**: App boots but auth is non-functional. Safe because `createClient()` in `src/lib/supabase.ts` returns `null` when env vars are missing.

---

## Phase 4: Secrets Configuration

- [ ] **4.1** Set Supabase secrets on the Worker:
  - `npx wrangler secret put SUPABASE_URL`
  - `npx wrangler secret put SUPABASE_KEY`
- [ ] **4.2** Verify secrets registered: `npx wrangler secret list`
- [ ] **4.3** **Edge case - Astro env schema**: Env vars declared as `optional: true` in `astro.config.mjs`. Correct for CI/build-time (no secrets needed), but means runtime won't throw if missing. Verify auth works after setting secrets.
- [ ] **4.4** Verify live deployment: open `.workers.dev` URL, test signin page, confirm Supabase auth completes
- [ ] **4.5** **Edge case - Supabase redirect URLs**: Add the production Worker URL (`https://fermenta.<account>.workers.dev`) to Supabase Auth > URL Configuration > Redirect URLs. Without this, OAuth/magic-link flows fail with "redirect URL mismatch".

---

## Phase 5: Connect Workers Builds (Auto-Deploy on Push to `main`)

- [ ] **5.1** In Cloudflare Dashboard: Workers & Pages > select `fermenta` Worker > Settings > Builds > Connect
- [ ] **5.2** Authorize the GitHub integration (installs Cloudflare app on the repo)
- [ ] **5.3** Select the repository and configure build settings:
  - **Production branch**: `main`
  - **Build command**: `npm run build`
  - **Deploy command**: `npx wrangler deploy` (default)
  - **Root directory**: `/` (monorepo root)
- [ ] **5.4** Add **build variables** (needed at build time for Astro env schema):
  - `SUPABASE_URL` (as build secret)
  - `SUPABASE_KEY` (as build secret)
  - These are separate from the runtime secrets set in Phase 4 - build vars are only available during the build step
- [ ] **5.5** **Critical**: Verify the Worker name in `wrangler.jsonc` (`fermenta`) matches the Worker name on the dashboard. Mismatches cause build failure with: `The name in your Wrangler configuration file must match the name of your Worker`.
- [ ] **5.6** Push a test commit to `main` to trigger the first automated build+deploy. Verify in Dashboard > Deployments > View Build History.
- [ ] **5.7** **Edge case - non-production branches (preview)**: By default, pushes to branches other than `main` run `npx wrangler versions upload` (creates a preview version without promoting to production). Non-production branch builds must be explicitly enabled in Settings > Builds > Build branches if you want PR preview URLs.
- [ ] **5.8** **Edge case - build timeout**: Workers Builds has a 20-minute max build duration. Current Astro build is fast (~15s), but if npm install + build exceeds this, enable build caching in Settings > Builds.

---

## Phase 6: Observability & Rollback

- [ ] **6.1** Verify observability active: `npx wrangler tail` after deploy - confirm request logs stream
- [ ] **6.2** Test rollback: `npx wrangler rollback` reverts to previous version (<5s)
- [ ] **6.3** Caveat: Worker rollback does NOT revert Supabase database migrations

---

## Phase 7: Edge Cases & Hardening

- [ ] **7.1** **Bundle size monitoring**: Currently 391 KB gzipped (free limit 3 MB). Check build logs for size after each deploy. Monitor as React islands grow.
- [ ] **7.2** **CPU time on free tier**: 10ms CPU limit. If SSR + Supabase auth approaches this, upgrade to Workers Paid ($5/mo). Detect with `npx wrangler tail --status error` (look for `exceededCpu`).
- [ ] **7.3** **`wrangler.jsonc` quirks**: Less community documentation than `.toml`. Trailing commas valid, uses `//` comments. The `$schema` field provides IDE autocomplete/validation.
- [ ] **7.4** **Supabase on workerd**: Test full auth flows (signin, signup, signout, cookie persistence) locally via `npm run dev` (real workerd runtime). No connection pooling in stateless isolates - each request creates a fresh client.
- [ ] **7.5** **Build secrets vs runtime secrets**: Workers Builds has two separate secret scopes. Build secrets (Phase 5.4) are available during `npm run build` only. Runtime secrets (Phase 4.1) are available to the running Worker. Both must be configured separately. If you change a Supabase key, update BOTH.
- [ ] **7.6** **Git integration token**: Workers Builds auto-generates an API token with broad permissions (Account Settings read, Workers Scripts edit, KV/R2 edit, Workers Routes edit). Review the auto-generated token in My Profile > API Tokens after connecting and consider scoping it down.

---

## Relevant Files

| File | Action |
|------|--------|
| `wrangler.jsonc` | Rename `name` to `fermenta` |
| `package.json` | Add `deploy` script |
| `.github/workflows/ci.yml` | `master` -> `main` |
| `.dev.vars` | Create (gitignored) |
| `astro.config.mjs` | No changes needed |
| `src/lib/supabase.ts` | No changes |

---

## Verification

1. `npm run dev` starts locally with workerd runtime
2. `npm run build` produces `dist/` output
3. `npx wrangler deploy --dry-run` reports bundle < 3 MB
4. Manual deploy: `https://fermenta.<account>.workers.dev` loads SSR pages
5. Auth flow (sign up / sign in / sign out) works end-to-end on production URL
6. Push commit to `main` - Workers Builds triggers, deploys automatically
7. `npx wrangler tail` streams logs without errors
8. `npx wrangler rollback` confirms version management

---

## Decisions

- **Worker name**: `fermenta` (renamed from template `10x-astro-starter`)
- **Auto-deploy**: Cloudflare Workers Builds (Git integration), not GitHub Actions
- **Production branch**: `main`
- **GHA**: lint + build only (no deploy responsibility)
- **Secrets**: runtime via `wrangler secret put`, build-time via Workers Builds dashboard (separate)
- **Free tier** assumed sufficient for MVP; paid upgrade path documented

---

## Further Considerations

1. **Custom domain** - not in this plan. Add later via `routes` in `wrangler.jsonc` or Dashboard. Requires domain on Cloudflare DNS already.
2. **Supabase redirect URLs** - production URL MUST be added to Supabase Auth config before auth works (included in Phase 4).
3. **Workers Paid upgrade** - if CPU errors appear, $5/mo removes the 10ms limit (raises to 30s).
