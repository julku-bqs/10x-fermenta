---
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
---

## Why this stack

A solo hobbyist building a wine-batch planning tool in 3 weeks after-hours needs a battle-tested, agent-friendly starter that ships auth, PostgreSQL, and edge deployment out of the box. The 10x Astro Starter (Astro 6 + React 19 + Supabase + Cloudflare Pages) is the recommended default for web-app in JS/TS and clears all four agent-friendly gates — typed, convention-based, popular in training, and well-documented. The short timeline and solo profile favor a batteries-included starter over assembling parts; Supabase handles auth (email + OAuth) and row-level security for per-user data isolation directly matching the PRD's access-control model. CI runs on GitHub Actions with auto-deploy-on-merge — what the starter ships with.
