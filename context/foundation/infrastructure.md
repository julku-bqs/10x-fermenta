---
project: fermenta
researched_at: 2026-05-28
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: workerd (Cloudflare Workers)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already configured with `@astrojs/cloudflare` v13, which deploys as a pure Worker with Static Assets — not Pages Functions. This gives full CLI rollback (`wrangler rollback`), gradual deployments (`wrangler versions deploy`), and $0 cost at MVP traffic levels (100k requests/day free). The entire Cloudflare docs corpus is machine-readable via per-product `llms.txt`, and all required features are GA. The current build produces a 391 KiB gzipped bundle — 13% of the free tier's 3 MB limit.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Score |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 5/5 |
| **Vercel** | ✅ Pass | ✅ Pass | ✅ Pass | ⚠️ Partial | ✅ Pass | 4.5/5 |
| **Railway** | ✅ Pass | ⚠️ Partial | ✅ Pass | ✅ Pass | ✅ Pass | 4.5/5 |
| **Netlify** | ⚠️ Partial | ✅ Pass | ✅ Pass | ⚠️ Partial | ✅ Pass | 4/5 |
| **Render** | ✅ Pass | ⚠️ Partial | ✅ Pass | ✅ Pass | ✅ Pass | 4.5/5 |
| **Fly.io** | ✅ Pass | ⚠️ Partial | ✅ Pass | ✅ Pass | ❌ Fail | 3.5/5 |

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Perfect alignment with the existing stack: the project uses `@astrojs/cloudflare` v13 which deploys as a Worker with Static Assets. Zero migration cost. Free tier covers 100k requests/day with zero cost. Full `llms.txt` documentation per product. `wrangler` CLI covers deploy, rollback, gradual deployments, log tailing, and secrets management — all GA. MCP support via the Agents SDK `McpAgent` class and a public MCP server at `mcp.cloudflare.com`.

#### 2. Vercel

Strong serverless alternative with native Astro support via `@astrojs/vercel`. Free Hobby tier covers 1M function invocations/month. Publishes `llms.txt` and has GA MCP integration. Scored Partial on deploy API because the Hobby plan limits rollback to the immediately previous deployment only — no full version history without Pro ($20/mo). Would require switching the Astro adapter and removing `wrangler.jsonc`.

#### 3. Railway

Best-in-class MCP server (local + remote, full CRUD). Persistent container model with native WebSocket support. Deploys Astro via `@astrojs/node` adapter + Railpack auto-detection. Scored Partial on managed/serverless because it runs always-on containers (not isolates) — more operational surface. $5/month minimum (no free tier post-trial). Would require switching to `@astrojs/node` adapter and adding `host: '0.0.0.0'` binding.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **`workerd` is not Node.js** — Libraries relying on `fs`, `child_process`, native addons, or full Node.js APIs will fail at runtime. The `nodejs_compat` flag covers common polyfills but not everything. Future features requiring server-side binary execution (PDF generation, image processing with sharp) are blocked.
2. **128 MB memory hard cap** — No escape hatch. If SSR rendering of complex React 19 trees + heavy data payloads approaches this limit, you hit OOM with no way to scale vertically.
3. **10 ms CPU on free tier** — Pages doing React SSR + Supabase auth can hit 10-20 ms of pure CPU. The $5/month paid plan resolves this (30s default), but the free tier may produce intermittent `exceededCpu` errors on complex pages.
4. **Vendor coupling for co-located services** — D1, KV, R2, Queues are Cloudflare-proprietary. While this project uses Supabase (mitigating DB lock-in), any future use of these bindings creates migration cost.
5. **6 concurrent outbound connections** — Workers can only have 6 simultaneous connections waiting for response headers. Aggressive parallel fan-out patterns (10+ simultaneous fetches) will queue.

### Pre-Mortem — How This Could Fail

Six months in, the solo developer hit a wall. A user-requested feature required server-side PDF generation using `puppeteer` — impossible on `workerd` due to the lack of a real runtime, binary execution, and the 128 MB memory cap. They evaluated `@cloudflare/puppeteer` via Browser Rendering (Workers Paid only, session limits) but found it too constrained for batch generation. Migrating to a Node.js runtime meant swapping the Astro adapter, rewriting all `locals.runtime.env` bindings, and losing the zero-cost edge deployment. The developer tried running a separate Fly.io service for PDF generation, but the operational complexity of managing two platforms for a hobby project led to burnout. Meanwhile, a Supabase Edge Function would have handled it — but only if the project had been architecturally set up to route compute-heavy tasks elsewhere from day one. The assumption that "everything stays simple SSR" was the root cause; the platform's constraints were invisible until they weren't.

### Unknown Unknowns

- **Workers/Pages dashboard unification is ongoing** — While the adapter targets Workers, some dashboard features (PR preview URLs, Git-integrated CI) are still Pages-only. If you later want automatic preview deployments per PR, you may need to configure Workers Builds or use GitHub Actions.
- **Supabase client on `workerd`** — `@supabase/ssr` works, but the client's internal fetch implementation may behave subtly differently on `workerd` vs. Node.js (e.g., connection pooling is irrelevant in stateless isolates, timeout handling differs).
- **`wrangler.jsonc` vs `wrangler.toml`** — The JSONC config format is newer and less documented in community tutorials. Debugging config issues from StackOverflow answers may require mentally translating between formats.
- **Build output size grows with React 19 islands** — Each island adds server-side render functions to the Worker bundle. With many interactive components, approach the free 3 MB gzip limit. Currently at 391 KB — safe margin but monitor as features grow.
- **GitHub Actions deploy requires API token scoping** — Cloudflare API tokens for CI must be manually scoped to Workers; an overly broad token risks account-wide exposure.

## Operational Story

- **Preview deploys**: Use `wrangler versions upload` to upload without deploying, then `wrangler versions deploy <version-id>@10` to canary at 10% traffic. For PR-based previews, configure GitHub Actions to deploy to a separate Worker name (e.g., `fermenta-preview-{PR}`) or use Workers Builds (beta). No automatic PR preview URLs without additional CI setup.
- **Secrets**: Stored via `wrangler secret put <KEY>` — encrypted at rest, accessible in Worker via `env.<KEY>`. For local dev, use `.dev.vars` (gitignored). In CI (GitHub Actions), store the Cloudflare API token as a repository secret; scope it to Workers for this account only.
- **Rollback**: `wrangler rollback` instantly reverts to a previous version. `wrangler versions list` shows the last 100 versions. `wrangler deployments list` shows deployment history. Typical time-to-revert: <5 seconds. Caveat: rollback does not revert Supabase database migrations — those must be handled separately.
- **Approval**: Human-required actions: publish to production (`wrangler deploy` or `wrangler versions deploy @100%`), rotate API tokens (dashboard), delete the Worker project (dashboard). Agent-safe actions: `wrangler versions upload` (upload without deploying), `wrangler tail` (read-only logs), `wrangler secret list` (list secret names, not values).
- **Logs**: `wrangler tail` streams live `console.log` output + exceptions with filters (`--status error`, `--method POST`, `--search "keyword"`). For historical logs, enable `"observability": { "enabled": true }` in `wrangler.jsonc` (already present) to access via dashboard or Workers Analytics API.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CPU time exceeded on free tier (10ms limit) | Research finding | Medium | Medium | Upgrade to Workers Paid ($5/mo) which raises limit to 30s. Monitor with `wrangler tail --status error`. |
| Future feature needs native Node.js runtime | Pre-mortem | Low | High | Architect compute-heavy tasks as separate services from day one (Supabase Edge Functions, or a dedicated Fly.io microservice). Keep SSR thin. |
| 128 MB memory OOM on complex pages | Devil's advocate | Low | High | Profile with `wrangler tail` memory metrics. Keep server components lean; offload data aggregation to Supabase. |
| Supabase client behaves differently on workerd | Unknown unknowns | Low | Medium | Test auth flows in `wrangler dev` (uses real workerd runtime since Astro 6). Report issues to `@supabase/ssr` maintainers. |
| Bundle size exceeds 3 MB gzip as app grows | Unknown unknowns | Low | Medium | Monitor with `wrangler deploy --dry-run`. Currently 391 KB — safe. If approaching limit, upgrade to paid (10 MB) or code-split. |
| No automatic PR preview URLs without extra CI setup | Research finding | Medium | Low | Add GitHub Actions workflow step: `wrangler deploy --env preview` with a unique Worker name per PR. |
| API token over-scoped in CI | Unknown unknowns | Low | High | Create a Cloudflare API token scoped only to "Workers Scripts: Edit" for the specific account. Never use Global API Key. |

## Getting Started

1. **Verify local dev works with workerd runtime**:
   ```bash
   npm run dev
   ```
   Astro 6 + `@astrojs/cloudflare` v13 uses the real `workerd` runtime locally via the Cloudflare Vite plugin — no separate `wrangler dev` needed.

2. **Deploy to production**:
   ```bash
   npx wrangler deploy
   ```
   This builds (if not already built) and uploads the Worker + static assets. First run will prompt to create the Worker project if it doesn't exist on Cloudflare.

3. **Set secrets**:
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```

4. **Verify deployment**:
   ```bash
   npx wrangler tail
   ```
   Open the deployed URL, confirm SSR renders correctly, check logs for errors.

5. **Set up GitHub Actions CI/CD** (optional, for auto-deploy on merge):
   Add a Cloudflare API Token (scoped to Workers Scripts: Edit) as a GitHub repository secret, then add a deploy step to `.github/workflows/ci.yml`:
   ```yaml
   - name: Deploy to Cloudflare
     run: npx wrangler deploy
     env:
       CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (covered in Getting Started as a pointer only)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare-specific services (D1, KV, R2) beyond noting their availability
