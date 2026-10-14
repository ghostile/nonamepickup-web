# Canonical NN MVP Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve imported Hampalyzer MVP data while making the `nn-mvp-v1` rank-1 player the canonical MVP for matches from October 7, 2026 at noon Eastern onward.

**Architecture:** Add nullable NN MVP columns to `matches` and expose a `canonical_match_mvps` database view that selects Hampalyzer identities before the cutoff and persisted NN identities afterward. A shared persistence service computes/backfills NN winners and a bounded server synchronizer handles new completed matches; all public MVP queries read the canonical view.

**Tech Stack:** Node.js CommonJS, Express 5, better-sqlite3, SQLite, browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-10-14-nn-mvp-canonical-cutover-design.md`

## Global Constraints

- The fixed cutoff is Unix timestamp `1791388800`, equivalent to `2026-10-07 12:00:00 America/New_York` (noon EDT, UTC−04:00).
- `match_round_mvps` remains unchanged and continues to preserve Hampalyzer source data.
- Post-cutoff winners are selected by raw `nn-mvp-v1` `final_score`; normalized `/100` scores are display-only.
- A post-cutoff match without sufficient NN inputs has no canonical MVP and must not fall back to Hampalyzer.
- No new dependencies.
- Do not create, edit, or run tests, per repository instructions.
- Verification is limited to syntax checks, `git diff --check`, schema/data inspection, backfill dry runs, and direct API checks.

## Review Focus

- A match created exactly at epoch `1791388800` uses NN, while one second earlier uses Hampalyzer.
- Split Hampalyzer round winners before the cutoff remain distinct canonical game-MVP identities; post-cutoff matches expose only one NN winner.
- Incomplete post-cutoff statistics produce an unavailable canonical MVP without erasing preserved Hampalyzer rows.
- Repeated synchronization with the same formula is idempotent and does not change already-current rows.
- Player identity resolution works when only `player_key`, only `steam_id`, or a display-name fallback is available.

---

### Task 1: Additive NN MVP schema and canonical database view

**Files:**
- Create: `api/src/lib/canonicalMvp.js`
- Modify: `api/src/db/schema.js`
- Modify: `docs/database/elo-schema.sql`

**Interfaces:**
- Produces: `NN_MVP_CUTOFF_EPOCH`, `isNnMvpCanonicalMatch(createdAt)`, and `canonicalMvpSource(createdAt)` from `api/src/lib/canonicalMvp.js`.
- Produces: nullable `matches.nn_mvp_player_key`, `nn_mvp_steam_id`, `nn_mvp_display_name`, `nn_mvp_final_score`, `nn_mvp_display_score`, `nn_mvp_formula_version`, `nn_mvp_status`, `nn_mvp_reason`, and `nn_mvp_computed_at` columns.
- Produces: `canonical_match_mvps(match_id, mvp_display_name, mvp_player_key, steam_id, source, final_score, display_score, formula_version)` view.

- [ ] **Step 1: Define the cutoff helper**

Create the pure CommonJS module with cutoff `1791388800`; `isNnMvpCanonicalMatch` returns true for finite timestamps greater than or equal to the cutoff, and `canonicalMvpSource` returns `"nn"` or `"hampalyzer"`.

- [ ] **Step 2: Add idempotent columns and indexes**

In `initializeSchema(db)`, inspect `PRAGMA table_info(matches)` and run one `ALTER TABLE matches ADD COLUMN ...` per missing field. Afterward, create indexes on `nn_mvp_player_key` and `nn_mvp_steam_id`.

- [ ] **Step 3: Create the canonical view**

Drop and recreate `canonical_match_mvps`: select distinct Hampalyzer identities joined to pre-cutoff `matches`, then `UNION ALL` persisted NN identities from post-cutoff matches. Exclude blank identities and exclude post-cutoff rows whose NN formula/winner is absent.

- [ ] **Step 4: Update the schema reference**

Document the additive columns, indexes, and canonical view in `docs/database/elo-schema.sql` without changing the preserved `match_round_mvps` definition.

- [ ] **Step 5: Verify schema code without tests**

Run `node --check api/src/lib/canonicalMvp.js` and `node --check api/src/db/schema.js`. Run `git diff --check`. Inspect a disposable database initialized by `createDatabase` and confirm the nine columns and view exist and that the cutoff boundary selects the intended source.

- [ ] **Step 6: Commit**

```bash
git add api/src/lib/canonicalMvp.js api/src/db/schema.js docs/database/elo-schema.sql
git commit -m "feat: add canonical NN MVP storage"
```

### Task 2: Shared NN MVP persistence and safe backfill

**Files:**
- Create: `api/src/lib/nnMvpStore.js`
- Create: `api/scripts/backfillNnMvps.js`
- Modify: `api/package.json`

**Interfaces:**
- Consumes: `buildNnMvp()` and `FORMULA_VERSION` from `api/src/lib/nnMvp.js`; `NN_MVP_CUTOFF_EPOCH` from Task 1.
- Produces: `loadNnMvpInputs(db, matchId)`, `calculateMatchNnMvp(db, matchId, suppliedInputs?)`, `persistMatchNnMvp(db, matchId, payload, computedAt?)`, and `syncPendingNnMvps(db, options?)`.
- Produces: `npm run backfill:nn-mvps` dry run and `npm run backfill:nn-mvps -- --apply` write mode.

- [ ] **Step 1: Centralize the scoring inputs**

Move the player aggregate, round-player, and flag-carrier-kill SQL needed by `buildNnMvp` into `loadNnMvpInputs(db, matchId)`. Preserve the current identity joins and numeric fields used by the match endpoint.

- [ ] **Step 2: Implement calculation and persistence**

`calculateMatchNnMvp` returns the complete `buildNnMvp` payload. `persistMatchNnMvp` writes an available winner or an explicit unavailable status/reason to the NN columns in one transaction and never alters `match_round_mvps`; an unavailable payload leaves all winner identity and score columns null.

- [ ] **Step 3: Implement bounded synchronization**

`syncPendingNnMvps` selects completed post-cutoff matches missing the current formula plus unavailable rows whose last attempt is at least five minutes old, processes a configurable limit, skips current available rows unless `force` is true, continues after individual match failures, and returns counts plus per-match change records. Updating the retry timestamp rotates unavailable rows instead of allowing them to starve newer matches.

- [ ] **Step 4: Add the dry-run-first command**

The CLI opens `config.ELO_DB`, reports the preserved Hampalyzer identity and proposed NN identity for every eligible match, and writes only with explicit `--apply`. Apply mode uses bounded SQLite busy retries, prints changed/unchanged/unavailable/failed totals, and exits nonzero when any match fails.

- [ ] **Step 5: Register the package command**

Add `"backfill:nn-mvps": "node scripts/backfillNnMvps.js"` to `api/package.json` without changing dependencies.

- [ ] **Step 6: Verify the service and dry run without tests**

Run `node --check` on both new files and `git diff --check`. Against a non-production database copy, run the command without `--apply`, confirm it performs no writes, then run apply twice and confirm the second pass reports no changes and preserved `match_round_mvps` row counts remain identical.

- [ ] **Step 7: Commit**

```bash
git add api/src/lib/nnMvpStore.js api/scripts/backfillNnMvps.js api/package.json
git commit -m "feat: backfill and persist NN MVP winners"
```

### Task 3: Forward synchronization and canonical match payloads

**Files:**
- Modify: `api/src/config.js`
- Modify: `api/.env.example`
- Modify: `api/src/server.js`
- Modify: `api/src/routes/matches.js`

**Interfaces:**
- Consumes: Task 2 store functions and Task 1 source selector.
- Produces: `NN_MVP_SYNC_INTERVAL_MS` configuration with a 60-second default and zero as the disable value.
- Produces: match payload fields `mvp_source`, canonical `match_mvps`, source-filtered `round_mvps`, and detailed `nn_mvp`.

- [ ] **Step 1: Add synchronizer configuration**

Parse `NN_MVP_SYNC_INTERVAL_MS` as a non-negative integer defaulting to `60000`, export it from config, and document it in `api/.env.example`.

- [ ] **Step 2: Start and stop the forward synchronizer**

In `server.js`, run one bounded synchronization after startup, schedule non-overlapping runs at the configured interval, log only summaries/errors, unref the timer, and clear it during shutdown before closing the database.

- [ ] **Step 3: Reuse centralized inputs in the match route**

Replace duplicate NN input SQL with `calculateMatchNnMvp`. For eligible post-cutoff completed matches, persist the current result before serializing the response.

- [ ] **Step 4: Select the canonical match payload**

Before the cutoff, keep distinct Hampalyzer `match_mvps` and round badges. At or after the cutoff, set `match_mvps` to the single NN winner, set `round_mvps` to an empty array, set `mvp_source: "nn"`, and never fall back to Hampalyzer when NN is unavailable.

- [ ] **Step 5: Verify without tests**

Run `node --check` on all four modified JavaScript files and `git diff --check`. With a non-production database copy, request one pre-cutoff and one post-cutoff match and inspect the source, winner identity, and absence of post-cutoff round MVP badges.

- [ ] **Step 6: Commit**

```bash
git add api/src/config.js api/.env.example api/src/server.js api/src/routes/matches.js
git commit -m "feat: make NN MVP canonical after cutoff"
```

### Task 4: Switch aggregate MVP consumers to the canonical view

**Files:**
- Modify: `api/src/app.js`
- Modify: `api/src/routes/home.js`
- Modify: `api/src/routes/stats.js`
- Modify: `api/src/routes/players.js`
- Modify: `api/src/routes/analytics.js`

**Interfaces:**
- Consumes: `canonical_match_mvps` from Task 1.
- Produces: consistent canonical `is_mvp`, `mvp_games`, leader, rate, and analytics identities across all public endpoints.

- [ ] **Step 1: Replace leaderboard recent-form lookup**

Change the `is_mvp` existence query in `app.js` to resolve player Steam identities against `canonical_match_mvps`.

- [ ] **Step 2: Replace home and stats aggregations**

Change MVP identity CTEs, game counts, and rate calculations in `home.js` and `stats.js` to read the canonical view while preserving distinct-match counting and existing identity fallbacks.

- [ ] **Step 3: Replace player profile and recent-match lookups**

Change both profile `mvp_games` and recent `is_mvp` queries in `players.js` to use the canonical view.

- [ ] **Step 4: Replace analytics MVP rows**

Change `MVP_CTES` in `analytics.js` to source canonical rows without altering downstream response shapes.

- [ ] **Step 5: Audit remaining source references**

Run `rg -n "match_round_mvps" api/src`. Only schema preservation, match-detail pre-cutoff loading, and explicitly non-canonical source/audit code may remain.

- [ ] **Step 6: Verify without tests**

Run `node --check` on every modified file and `git diff --check`. Query the relevant endpoints against a non-production database copy and reconcile totals with direct `canonical_match_mvps` counts.

- [ ] **Step 7: Commit**

```bash
git add api/src/app.js api/src/routes/home.js api/src/routes/stats.js api/src/routes/players.js api/src/routes/analytics.js
git commit -m "feat: use canonical MVPs in player statistics"
```

### Task 5: Present one canonical MVP in post-cutoff UI

**Files:**
- Modify: `assets/js/match.js`

**Interfaces:**
- Consumes: `mvp_source`, canonical `match_mvps`, filtered `round_mvps`, and `nn_mvp` from Task 3.
- Produces: post-cutoff match pages that show the NN winner as `Game MVP` with NN score/reasons and no Hampalyzer comparison or round stars.

- [ ] **Step 1: Render source-aware MVP content**

For `mvp_source === "nn"`, render the canonical NN winner in the score header and one Game MVP detail card using the existing score chips and reasons. Do not render `Systems Agree/Disagree` or a Hampalyzer card.

- [ ] **Step 2: Preserve historical rendering**

For pre-cutoff payloads, retain the current Hampalyzer match and round MVP behavior so older matches do not change.

- [ ] **Step 3: Verify without tests**

Run `node --check assets/js/match.js` and `git diff --check`. Open representative pre- and post-cutoff match pages; confirm historical round stars remain only before the cutoff and `LFRR4J` shows Kix as Game MVP.

- [ ] **Step 4: Commit**

```bash
git add assets/js/match.js
git commit -m "feat: show canonical NN game MVP"
```

### Task 6: Backfill, reconcile, and document rollout

**Files:**
- Create: `api/docs/nn-mvp-cutover.md`

**Interfaces:**
- Consumes: the backfill command and canonical endpoints from Tasks 1–5.
- Produces: an operator runbook covering backup, dry run, apply, restart, reconciliation, and rollback.

- [ ] **Step 1: Write the rollout runbook**

Document the exact cutoff, database backup requirement, commands for dry run/apply, expected summaries, API restart, direct SQL reconciliation, live URL checks, and rollback by clearing only the additive `nn_mvp_*` columns while leaving Hampalyzer rows untouched.

- [ ] **Step 2: Perform repository verification**

Run `node --check` for every changed JavaScript file and `git diff --check`. Do not invoke the repository test suite.

- [ ] **Step 3: Run and review the production dry run**

Resolve the exact production `ELO_DB`, create a recoverable database backup, run the backfill without `--apply`, and review every old→new winner change plus unavailable/failed rows before any write.

- [ ] **Step 4: Apply and reconcile the production backfill**

Run with `--apply`, verify `PRAGMA integrity_check`, confirm preserved `match_round_mvps` counts, reconcile eligible completed matches to current-formula NN rows, and restart the API so cached aggregate responses are cleared.

- [ ] **Step 5: Verify live behavior**

Inspect `/api/match/LFRR4J`, its match page, player recent-form badges, MVP totals, home leader data, and `/api/stats/mvps`. Confirm Kix is canonical for `LFRR4J` and no post-cutoff response falls back to Hampalyzer.

- [ ] **Step 6: Commit the runbook**

```bash
git add api/docs/nn-mvp-cutover.md
git commit -m "docs: add NN MVP cutover runbook"
```
