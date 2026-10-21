# Prediction Preview Implementation Plan

**Goal:** Finish a disconnected prediction website preview and its read-only backend.
**Architecture:** Shared website shell plus isolated Express module, synthetic preview provider, SQLite read-only provider and Discord identity boundary. Off by default; standalone preview never opens bot data.
**Tech stack:** Existing HTML/CSS/browser JS, Node, Express, better-sqlite3, built-in crypto/fetch.
**Spec:** ../specs/2026-10-21-predictions-preview-design.md

## Global constraints

- Do not create, edit or run tests (AGENTS.md overrides skill test workflows).
- No production reads/writes, navigation promotion, deployment, merge, or bot edits.
- Preserve incumbent template; synthetic preview fields do not approve public policy.

## Tasks

- [x] Implement read-only metric repository with safe integer handling, distinct-match progression, correction credits, reviewed figures, paging and public allowlist serialization.
- [x] Implement gated router, preview data, Discord OAuth and standalone loopback server. Add optional existing-app mount; default remains off.
- [x] Build three responsive pages with shared header/assets and functional standings/account controls; add rules and clear preview labeling.
- [x] Document contract/configuration/metric definitions and remaining activation checks.
- [x] Verify syntax, whitespace and desktop/mobile rendering; review the complete change. Do not run tests.

## Review focus

- Preview must never consult a real DB or honor a supplied Discord ID.
- Uninitialized account stays uninitialized; no bot constructors/migrations.
- Corrections/revisions/ledger snapshots cannot multiply stakes or credits.
- Public mode fails closed without approved policy and explicit consent.
- Private reads and OAuth callback never reach shared caches or analytics.

## Execution record

User clarified implementation scope after the initial proposal: visuals and backend now, integration later. Implement inline in the feature branch. No worktree requested; keep current checkout on the isolated feature branch. No test workflow, per repository instructions.

Validation: node --check passed for new/modified JS; git diff --check passed. Preview opened in headless installed Chrome at 1440x1000 and 390x844: all three pages captured, account/rules body widths remained 390; no browser JS errors. Inspected search, two-page standings, empty account/null balance, simulated stale account and unavailable/retry state. No automated test suite, financial fixtures, actual Discord login or live DB reads. Static reviewer found correction timestamps and account stale preview defects; both fixed. Activity categories now separate betting returns and official-player rewards. Mechanical design detector's white-background contrast assumptions do not resolve the shared dark stylesheet; actual screenshots show the incumbent dark background. Incumbent Inter/Orbitron and logo glow intentionally preserved. Small new labels raised to 12px.
