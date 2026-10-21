# Prediction website staging design

Build the website visuals and backend now; do not connect production data, publish standings, add navigation links elsewhere, merge, or deploy. User clarified this scope on October 21. Preserve the standard NN // TFC header, navigation, shared CSS, Inter/Orbitron type, dark surfaces and existing leaderboard patterns. This extends the incumbent site, not a redesign.

## Surfaces and columns

- `predictions.html`: standings with rank, fictional player, net prediction profit, finalized settled games, and correct-pick rate. Search, sorting, pagination, updated time, loading/empty/error states. Fixed canonical rank uses profit; sorting does not renumber rank.
- `my-predictions.html`: private available points, locked points, personal limit, distinct settled games, and paginated personal market history (game, original team pick, stake, actual credits, net, status, game limit). Demo is a fixed fictional account, never a request-selected real identity.
- `prediction-rules.html`: private Discord betting, eligibility, 120-second deadline, progressive/legacy limits, pot allocation and positive-only corrections.
- Visible demo label on all preview data. No analytics beacon on these pages. No live public policy implied by preview columns.

## Backend contract

Isolated Express router at `/api/predictions`; mode defaults off. Standalone loopback preview server serves static pages and synthetic API responses without opening any database. Existing application mounts the module only when explicitly configured. Preview supports deterministic empty/unavailable/stale states. Live adapter opens configured ELO SQLite read-only and does not instantiate the bot store (its constructor migrates schema).

Public live standings require a separately explicit approved-policy switch and an operator-managed consent allowlist outside the public directory. Return only rank, displayName, netProfit, settledGames, winRate. Suggested future policy: opt-in, 10 finalized games, competition ties (1,1,3), inactive opt-ins retained. No public Discord IDs, picks, stakes, balances or ledger data. Policy remains a proposal.

Private endpoints use server-owned Discord OAuth sessions with identify scope, state validation, short-lived HttpOnly cookies, no browser identity parameter, no shared caches and no retained OAuth tokens. Sessions are process-local and clear on restart. Financial reads never initialize accounts or issue grants. Login is unavailable until operator credentials are configured; mock account is preview-only.

## Metrics

Retained settled bets with settlement_version > 0 contribute distinct match IDs to progression even during review. Finalized statistics include only state=settled. Betting credits are account-specific settlement/correction rows for markets in which that account has a settled bet; subtract that retained bet's stake once. Markers/allocation snapshots, house issuance rows, grants, adjustments, player-only rewards and cancelled/void/pregame refunds do not contribute. Current schema forbids players betting their own market. No-correct refunds have zero net and count for progression/finalized games, but are excluded from the correct-pick denominator. Win rate is correct bets / non-refunded finalized bets; ties picked correctly count as correct. Corrections use actual retained credits for profit and latest approved outcome for correctness; these can differ. Review figures stay separate. Use safe integer checks and consistent SQLite read transactions.

Bot source inspected: working checkout `C:/Users/ricky/.codex/worktrees/match-predictions/tfcbot`, branch codex/match-predictions. It contains uncommitted schema-v2/progression changes. Record this dependency; do not alter that checkout or database. Rule-version 1 markets remain 250; rule-version 2 personal limit is 100 + 10 times distinct settled games, constrained by available funds and safe integer representation. Backend calculates limits from persisted state; browser only formats them.

## Delivery and validation

Feature branch `codex/prediction-website-preview`. No new or changed tests and no tests run, per AGENTS.md. Use syntax/whitespace checks, a desktop/mobile visual inspection, and code review. Credentials, two-account Discord verification, bot schema approval, production topology and live database integration remain rollout work. No claim of production readiness until those are verified.
