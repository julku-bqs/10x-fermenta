---
bootstrapped_at: 2026-05-26T15:53:44Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: fermenta
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: fermenta
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

A solo hobbyist building a wine-batch planning tool in 3 weeks after-hours needs a battle-tested, agent-friendly starter that ships auth, PostgreSQL, and edge deployment out of the box. The 10x Astro Starter (Astro 6 + React 19 + Supabase + Cloudflare Pages) is the recommended default for web-app in JS/TS and clears all four agent-friendly gates — typed, convention-based, popular in training, and well-documented. The short timeline and solo profile favor a batteries-included starter over assembling parts; Supabase handles auth (email + OAuth) and row-level security for per-user data isolation directly matching the PRD's access-control model. CI runs on GitHub Actions with auto-deploy-on-merge — what the starter ships with.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | — | cmd_template starts with `git clone`; no npm CLI package to check |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17T10:33:39Z | fresh | from card.docs_url |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: append-merged
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0

#### HIGH findings

- **devalue** (transitive) — via: devalue advisory. Indirect dependency; no direct action available until upstream fixes.

#### MODERATE findings

- **@astrojs/check** (direct) — via: @astrojs/language-server
- **@astrojs/language-server** (transitive) — via: volar-service-yaml
- **@cloudflare/vite-plugin** (transitive) — via: miniflare, wrangler, ws
- **miniflare** (transitive) — via: ws
- **volar-service-yaml** (transitive) — via: yaml-language-server
- **wrangler** (direct) — via: miniflare
- **ws** (transitive) — via: ws advisory
- **yaml** (transitive) — via: yaml advisory
- **yaml-language-server** (transitive) — via: yaml

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
