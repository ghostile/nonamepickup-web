# Defense IQ Implementation Plan

> Execute inline using superpowers:executing-plans. The user explicitly requested ownership from start to finish.

**Goal:** Deliver a standalone defensive class predictor and historical match review.

**Architecture:** A focused read-only store loads identity-resolved class observations; a pure model produces distributions and outcomes. An Express router exposes options and analysis. A standalone HTML/CSS/JS page consumes those endpoints.

**Tech Stack:** Existing Express, SQLite, vanilla JavaScript and site styles; no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-defense-iq-design.md`

## Global constraints
Do not create, modify or run tests. Do not modify existing site navigation. Do not introduce migrations. Use pre-match data only for historical predictions.

## Review focus
Missing defensive history, tied dominant classes, ambiguous identities, timestamp leakage, stale asynchronous responses and sparse same-map samples must remain explicit.

## Tasks
- [x] Add `api/src/lib/defenseIq.js` for dominant classes, recency weighting, smoothed probabilities and historical results.
- [x] Add `api/src/lib/defenseIqStore.js` for class observations and identities; cache per router instance for 30 seconds.
- [x] Add `api/src/routes/defenseIq.js` and register it in `api/src/routes/index.js`; validate selections and return clear errors.
- [x] Add `defense-iq.html`, `assets/css/defense-iq.css`, and `assets/js/defense-iq.js`, copying the standard header without any new menu entry. Include loading, error, empty and responsive views with shareable query parameters.
- [x] Run syntax checks only, inspect the diff and review schema compatibility. Use an available browser preview for desktop/mobile visual inspection. Record any verification limits.

## Execution notes
Implemented inline as authorized. No test files created or edited, and no tests run. No migrations, dependencies or existing navigation changes. Independent code review found no substantive issues. Source review confirmed strict historical cutoffs and identity ambiguity handling. The browser preview confirmed the standard template and API-unavailable state; checking the narrow viewport exposed an inherited hero grid constraint, which was corrected. View switching now preserves API-load errors and their retry action.

No local match database or project API dependencies are present, so populated results and database query execution remain unverified. A localhost static server was used solely to inspect the page shell. No deployment performed.

Ruling: Proceed directly through implementation under the user's explicit start-to-finish authorization; do not add further design approval stops. Keep existing unrelated model and sprite changes untouched.
