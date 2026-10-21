# Spelling Invaders Shared Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-backed named-player summaries for Arcade, Practice, and Friday Test sessions, then display those results in the protected Parent Zone.

**Architecture:** Add a small versioned JSON score store beside the existing spelling-list store. Public clients submit validated session summaries; only the protected admin route can read or clear the collection. The browser keeps existing LocalStorage progress and treats server sync as non-blocking.

**Tech Stack:** Node.js, Express, JSON file persistence, TypeScript, Vite, Vitest, existing Nginx Basic Auth.

**Spec:** `docs/superpowers/specs/2026-10-13-spelling-scoreboard-design.md`

## Global Constraints

- The feature must work without accounts, external services, or a database migration.
- No answer text, speech data, device identifiers, or other personal information is sent to the server.
- Anyone able to use the public game can submit a name and summary; results are self-reported, not verified identities.
- Existing local progress and weekly lists remain valid.
- Failed score submission must not block the results screen.
- Do not create new test files; extend existing tests only where useful.

## Review Focus

- Malformed or oversized public score payloads must be rejected without writing a file; cover with validation smoke checks in the API task.
- A missing, empty, or corrupt score file must recover to an empty collection; cover with store-level smoke checks.
- Duplicate session IDs must not create duplicate rows; cover with store-level smoke checks.
- A default `Player 1` profile must be named before a scored session is submitted; cover with a browser interaction check.
- A failed public POST must leave the results screen usable and visibly explain that syncing failed; cover with a browser/API failure check.

### Task 1: Add the versioned server score store

**Files:**
- Create: `api/src/spellingScores.js`
- Modify: `api/src/config.js`
- Modify: `api/src/app.js`
- Modify: `api/src/routes/index.js`
- Modify: `api/spelling.env.example`

**Interfaces:**
- Produces `createSpellingScoreStore({ fs, file })` with `read()`, `append(record)`, and `clear()` methods.
- Produces config value `SPELLING_SCORES_FILE`, defaulting beside `SPELLING_LISTS_FILE` under the configured data directory.
- Passes `SPELLING_SCORES_FILE` through `createApp` into route registration.

- [ ] **Step 1: Define the store contract and recovery behavior**

Implement schema `{ version: 1, records: [] }`, normalize invalid/missing files to an empty collection, cap retained records at a documented bounded maximum, and write atomically using the existing spelling-list pattern. `append(record)` must return the stored collection unchanged when the record ID already exists.

- [ ] **Step 2: Wire configuration through the app**

Export `SPELLING_SCORES_FILE` from config, pass it through `createApp`, and include the placeholder in `api/spelling.env.example` without exposing credentials or absolute secrets.

- [ ] **Step 3: Run static checks**

Run `node --check api/src/spellingScores.js`, `node --check api/src/config.js`, and `node --check api/src/app.js`. Expected: all commands exit successfully.

- [ ] **Step 4: Commit**

```bash
git add api/src/spellingScores.js api/src/config.js api/src/app.js api/src/routes/index.js api/spelling.env.example
git commit -m "feat: add spelling score persistence"
```

### Task 2: Add public submission and protected Parent Zone score APIs

**Files:**
- Modify: `api/src/routes/spelling.js`
- Modify: `api/src/routes/index.js`

**Interfaces:**
- `POST /api/spelling/scores` accepts `{ id, playerName, listId, listName, total, correct, firstAttemptCorrect, mode, score, completedAt }` and returns `{ ok: true, record }`.
- `GET /api/spelling/admin/scores` returns `{ ok: true, records, totals }` through the existing `requireAdmin` middleware.
- `DELETE /api/spelling/admin/scores` clears records through the same middleware and returns `{ ok: true }`.

- [ ] **Step 1: Add strict score-summary validation**

Validate mode as exactly `arcade`, `practice`, or `test`; require bounded trimmed names and list fields; require integer counts where `0 <= correct <= total`; require finite non-negative score; require an ISO timestamp; and reject unknown or oversized payloads with `400 invalid_spelling_score`.

- [ ] **Step 2: Implement the three routes**

Use the score store from Task 1. Public POST must be safe to retry by ID. Admin GET must calculate totals for record count, player count, and mode counts. Admin DELETE must clear only score records, never weekly lists.

- [ ] **Step 3: Run API smoke checks without creating a test file**

Use a temporary in-memory/mock filesystem invocation or a one-off Node command to verify valid append, duplicate suppression, corrupt-file recovery, invalid payload rejection, and admin route auth behavior. Expected: valid submissions return 200, malformed submissions return 400, unauthenticated admin requests return 401, and duplicate IDs remain one record.

- [ ] **Step 4: Commit**

```bash
git add api/src/spellingScores.js api/src/routes/spelling.js api/src/routes/index.js
git commit -m "feat: expose spelling score APIs"
```

### Task 3: Submit named player session summaries from the game

**Files:**
- Modify: `spelling-invaders/src/domain.ts`
- Modify: `spelling-invaders/src/main.ts`
- Modify: `spelling-invaders/tests/domain.test.ts`

**Interfaces:**
- Add `ScoreMode = 'arcade' | 'practice' | 'test'` and `SpellingScoreSummary` types matching the API payload.
- Add a pure `scoreSummaryForSession(...)` helper that computes accuracy and first-attempt fields from session data.
- Add `submitSessionScore(summary)` in `main.ts`; it must be non-blocking, retry-safe by summary ID, and announce failure without replacing the results screen.

- [ ] **Step 1: Extend the existing domain test file with summary cases**

Add assertions for 20/20 accuracy, 15/20 accuracy, zero-total rejection or safe handling, and mode preservation. Do not create a new test file.

- [ ] **Step 2: Implement the pure summary helper**

Generate a stable session ID at session start, preserve the active profile name and weekly-list snapshot, and calculate `correct`, `total`, `score`, and `firstAttemptCorrect` without sending answer text.

- [ ] **Step 3: Add the non-blocking submission flow**

Submit once from `finish()` after LocalStorage persistence. Guard with `sessionDone` and the session ID, handle non-2xx responses as a recoverable sync warning, and never prevent the results screen from rendering.

- [ ] **Step 4: Require a meaningful player name**

When a profile still has the default `Player 1` name, prompt from the player-selection/start flow before any scored session. Trim and cap the local name consistently with the server.

- [ ] **Step 5: Run frontend tests and build**

Run `npm test` and `npm run build` in `spelling-invaders`. Expected: all existing and new domain assertions pass, and Vite produces the deployable `spelling/` output.

- [ ] **Step 6: Commit**

```bash
git add spelling-invaders/src/domain.ts spelling-invaders/src/main.ts spelling-invaders/tests/domain.test.ts spelling/
git commit -m "feat: submit named spelling session scores"
```

### Task 4: Build the protected Parent Zone results dashboard

**Files:**
- Modify: `spelling-invaders/src/main.ts`
- Modify: `spelling-invaders/src/styles.css`

**Interfaces:**
- Parent Zone fetches `GET /api/spelling/admin/scores` with the browser’s Basic Auth challenge.
- Dashboard state exposes selected mode filter, server records, loading/error state, and aggregate totals.

- [ ] **Step 1: Add score loading and auth handling**

Load server records on Parent Zone entry, prompt for the existing Parent Zone credentials after a 401, and show a clear non-fatal error if the dashboard cannot load.

- [ ] **Step 2: Add grouped summaries and filters**

Render player cards with sessions, best score, latest accuracy, and average accuracy. Add All, Arcade, Practice, and Test filters and a recent-results table showing player, mode, list, score, accuracy, correct/total, and date. Label results as self-reported.

- [ ] **Step 3: Add protected clear-results control**

Require confirmation, call `DELETE /api/spelling/admin/scores`, and refresh the dashboard only after a successful response. Never clear LocalStorage progress or weekly lists.

- [ ] **Step 4: Verify responsive accessibility styling**

Use existing design tokens and touch-friendly controls, ensure table/card layout works in portrait and landscape, and preserve visible focus states and high contrast.

- [ ] **Step 5: Run frontend tests and build**

Run `npm test` and `npm run build`. Expected: all tests pass and the built Parent Zone contains the scoreboard UI.

- [ ] **Step 6: Commit**

```bash
git add spelling-invaders/src/main.ts spelling-invaders/src/styles.css spelling/
git commit -m "feat: show shared player spelling results"
```

### Task 5: Document deployment and perform final verification

**Files:**
- Modify: `README.md`
- Modify: `PARENT_GUIDE.md`
- Modify: `api/spelling.env.example`

**Interfaces:**
- Documentation identifies the score file, environment variable, server update/restart steps, self-reported-name limitation, and reset behavior.

- [ ] **Step 1: Document server setup**

Add `SPELLING_SCORES_FILE` setup, PM2 restart instructions, and the protected API/dashboard behavior to the existing docs.

- [ ] **Step 2: Run final verification**

Run API syntax checks, the existing API test command, `npm test`, `npm run build`, and `git diff --check`. Use live curl checks after deployment for public POST, protected GET, and protected DELETE, without printing credentials.

- [ ] **Step 3: Review status and commit**

Confirm only scoreboard-related files changed, inspect `git status`, and commit documentation or verification fixes with a focused message.

- [ ] **Step 4: Push**

Push the committed branch to `origin main` without force-pushing, then report the commit hash and exact server pull/restart commands.
