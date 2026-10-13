# Speedrun Replay Split Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build replay timer, compatible split comparison, checkpoint seeking, and legacy-safe split handling in the existing speedrun viewer.

**Architecture:** Keep split math in a pure CommonJS module, expose optional recorded events through the existing replay API, and render all timing UI from the replay payload and current playback time. No schema migration is added because the recorder/schema is outside this repository.

**Tech Stack:** Node.js CommonJS API, MySQL-compatible queries, vanilla browser JavaScript, existing HTML/CSS/Three.js replay viewer.

**Spec:** `docs/superpowers/specs/2026-10-13-speedrun-replay-splits-design.md`

## Global Constraints

- Never fabricate checkpoint events for old replays.
- Preserve official run duration as authoritative finish time.
- Compare only compatible map/class/ruleset/checkpoint sequences.
- Preserve existing replay controls and responsive visual system.
- Do not deploy or verify production from Codex.

## Review Focus

- Missing event payloads must render Start/Finish only and explain the limitation.
- Duplicate or out-of-order checkpoint events must not become valid splits.
- Finish metadata and replay-frame timing must reconcile to official milliseconds.
- Mismatched class/ruleset/checkpoint sequences must be rejected before comparison.
- Seeking and speed changes must not accumulate browser-clock drift.

### Task 1: Split domain and API payload

**Files:**
- Create: `api/src/speedruns/splits.js`
- Create: `api/test/speedrun-splits.test.js`
- Modify: `api/src/routes/speedruns.js`

- [x] Add red tests for event ordering, signed deltas, compatibility, and unavailable payloads.
- [x] Implement pure split parsing/analysis and optional recorded-event extraction.
- [x] Add replay ruleset/split metadata and legacy-safe API response fields.

### Task 2: Replay timing and split UI

**Files:**
- Modify: `speedrun-replay.html`
- Modify: `assets/css/speedrun-replay.css`
- Modify: `assets/js/speedrun-replay.js`

- [x] Add run timer synchronized to replay time and freeze/seek behavior.
- [x] Add split table with cumulative and segment deltas.
- [x] Add PB/WR/other compatible comparison candidates and compatibility checks.
- [x] Add marker seeking and active split highlighting.
- [x] Add legacy/unavailable and best-segments limitation messaging.

### Task 3: Verification and handoff

- [ ] Run focused and full API tests plus syntax checks.
- [ ] Inspect diff/status for unrelated changes and secrets.
- [ ] Commit task-related changes and push the existing branch.
- [ ] Provide deployment steps without production access.
