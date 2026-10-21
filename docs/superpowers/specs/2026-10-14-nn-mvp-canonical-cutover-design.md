# Canonical NN MVP Cutover Design

## Goal

Make the NoName (`nn-mvp-v1`) ranking the canonical game MVP for every completed match created on or after October 7, 2026. Backfill the prior seven days at rollout and continue calculating NN MVPs for new matches. Matches before the cutoff retain their existing Hampalyzer-derived MVP behavior.

The original Hampalyzer round-MVP records must remain intact for audit and historical use, but they must not drive public game-MVP displays or aggregate MVP statistics on or after the cutoff.

## Cutover rule

- Use a fixed cutoff timestamp corresponding to `2026-10-07 12:00:00 America/New_York` (noon EDT, UTC−04:00).
- For matches before the cutoff, the canonical MVP remains the existing Hampalyzer-derived identity from `match_round_mvps`.
- For matches on or after the cutoff, the canonical MVP is the rank-1 result produced by `nn-mvp-v1` from the complete match statistics.
- The NN winner is selected by the existing raw `final_score` ordering. The normalized `/100` display score is presentation data and must not determine the winner.
- If a post-cutoff match lacks enough source statistics to compute NN MVP, expose the MVP as unavailable rather than falling back silently to Hampalyzer.

## Persistence

Store the computed NN result on the existing `matches` row using dedicated nullable `nn_mvp_*` columns. At minimum the persisted data must include:

- player key;
- Steam ID;
- display name;
- raw final score;
- normalized display score;
- formula version;
- computation timestamp.

The schema change is additive. Do not delete, rewrite, or repurpose `match_round_mvps`; it remains the preserved Hampalyzer source. Schema initialization must add missing columns idempotently so an existing production database upgrades safely.

## Calculation and synchronization

Extract the per-match statistics query and NN persistence into a focused service shared by the match route, the backfill command, and the forward synchronizer.

The service will:

1. Load the same aggregate player, round, and flag-carrier-kill inputs currently passed to `buildNnMvp`.
2. Run the existing `nn-mvp-v1` implementation.
3. Persist only the winning identity and score metadata to the matching `matches` row.
4. Skip unchanged rows already computed with the current formula unless explicitly forced.
5. Write each result transactionally.

A bounded background synchronizer in the API process will periodically scan completed post-cutoff matches that do not have a current-formula NN result. The match-detail route may also ensure the requested post-cutoff match is synchronized before serializing it. This makes new matches converge automatically without requiring changes in the external Hampalyzer importer.

## Historical backfill

Add a command-line backfill utility with two modes:

- Dry run (default): calculate all completed matches from the cutoff forward and print the existing Hampalyzer identity, proposed NN identity, scores, and whether the winner changes. Do not write.
- Apply: repeat the calculation and persist `nn_mvp_*` values in a transaction, reporting totals for changed, unchanged, unavailable, and failed matches.

The apply mode must require an explicit flag. A failed match must not abort or partially corrupt results for other matches; failures are reported by match ID and leave that row unchanged.

## Canonical read behavior

Centralize the source-selection rule so all consumers agree:

- Match detail header and MVP card.
- Player recent-match MVP markers and profile MVP totals.
- Home-page MVP leader and MVP-rate calculations.
- MVP leaderboard/statistics endpoints.
- Analytics responses that identify MVPs.

For pre-cutoff matches, queries continue to resolve distinct game MVP identities from `match_round_mvps`. For post-cutoff matches, queries read only `matches.nn_mvp_*`. Public payloads should include the canonical source (`hampalyzer` or `nn`) where useful for clear labeling.

The existing `round_mvps` source rows remain stored, but post-cutoff pages must not display Hampalyzer round or game MVP labels. The match-level UI should use the neutral label `Game MVP` and, for post-cutoff matches, display the NN score and scoring reasons.

## Error handling and operational safety

- Missing or incomplete NN inputs produce an unavailable result and a diagnostic log; they never fall back to Hampalyzer after the cutoff.
- Database-busy errors use the repository's existing bounded retry pattern for backfill writes.
- Backfill output contains no credentials or private configuration.
- Deployment order is additive schema upgrade, dry run, review of changes, apply, API restart, and live verification.
- Hampalyzer rows remain recoverable because the cutover changes only canonical selection and additive NN columns.

## Verification

Repository instructions prohibit adding, modifying, or running tests for this task. Verification will therefore use:

- JavaScript syntax checks for every changed server and script file;
- `git diff --check`;
- schema inspection confirming all additive columns and intact `match_round_mvps` rows;
- dry-run output review for every completed match since the cutoff;
- apply-mode counts reconciled against the eligible-match count;
- direct API inspection of representative pre-cutoff and post-cutoff matches;
- live comparison confirming `LFRR4J` resolves to Kix as the canonical Game MVP;
- spot checks of player MVP totals, recent-match badges, home statistics, and the MVP leaderboard.

## Success criteria

- Every completed match on or after October 7, 2026 with sufficient statistics has a persisted `nn-mvp-v1` winner.
- `LFRR4J` and other changed matches publicly identify their NN rank-1 player as Game MVP.
- All future completed matches automatically receive an NN MVP.
- Public aggregate counts use Hampalyzer only before the cutoff and NN only from the cutoff forward.
- Original Hampalyzer data remains unchanged in `match_round_mvps`.
