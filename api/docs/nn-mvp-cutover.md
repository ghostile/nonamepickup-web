# Canonical NN MVP Cutover Runbook

This rollout makes `nn-mvp-v1` canonical for completed matches created at or after Unix epoch `1791388800` (`2026-10-07 12:00:00 America/New_York`). Earlier matches continue using preserved Hampalyzer MVP rows.

## 1. Deploy the additive code

Deploy the website/API revision containing the NN MVP schema, canonical view, persistence service, and public query changes. Do not restart the API yet.

Do not delete or update `match_round_mvps`. It remains the preserved Hampalyzer source.

## 2. Resolve and back up the exact production database

On the website host, read `ELO_DB` from the deployed environment. The default is `/root/tfcbot/elo.db`, but use the configured absolute path rather than assuming the default.

Create a recoverable SQLite backup before applying the backfill:

```bash
sqlite3 "$ELO_DB" ".backup '${ELO_DB}.before-nn-mvp-20261014'"
sqlite3 "$ELO_DB" "PRAGMA integrity_check;"
```

Expected integrity output: `ok`.

Record preserved source counts before applying:

```bash
sqlite3 "$ELO_DB" "SELECT COUNT(*) AS hampalyzer_rows, COUNT(DISTINCT match_id) AS hampalyzer_matches FROM match_round_mvps;"
sqlite3 "$ELO_DB" "SELECT COUNT(*) FROM matches WHERE status='completed' AND created_at>=1791388800;"
```

## 3. Prepare the additive schema and dry run

From the deployed `api` directory:

```bash
npm run backfill:nn-mvps -- --prepare-schema
npm run backfill:nn-mvps
```

The first command only adds the nullable `matches.nn_mvp_*` columns and recreates `canonical_match_mvps`; it does not compute or write MVP results. The second command is read-only. Review every line showing the preserved Hampalyzer identity, proposed NN identity, raw/display scores, and whether the canonical winner changes. Investigate any `FAILED` entry before continuing. `unavailable` is allowed only when the match lacks sufficient scoring inputs and will not fall back to Hampalyzer.

## 4. Apply

After reviewing the dry run:

```bash
npm run backfill:nn-mvps -- --apply
```

The command updates only `matches.nn_mvp_*`. It does not alter `match_round_mvps`. A second apply should report current available rows as unchanged.

Restart the API to clear in-memory aggregate caches:

```bash
pm2 restart tfcapi
```

## 5. Reconcile the database

```bash
sqlite3 "$ELO_DB" "PRAGMA integrity_check;"
sqlite3 "$ELO_DB" "SELECT nn_mvp_status, COUNT(*) FROM matches WHERE status='completed' AND created_at>=1791388800 GROUP BY nn_mvp_status;"
sqlite3 "$ELO_DB" "SELECT COUNT(*) FROM matches WHERE status='completed' AND created_at>=1791388800 AND nn_mvp_status='available' AND nn_mvp_formula_version='nn-mvp-v1';"
sqlite3 "$ELO_DB" "SELECT COUNT(*) AS hampalyzer_rows, COUNT(DISTINCT match_id) AS hampalyzer_matches FROM match_round_mvps;"
```

Expected results:

- integrity is `ok`;
- every eligible match is `available` or explicitly `unavailable`;
- all available rows use `nn-mvp-v1`;
- Hampalyzer counts exactly match the pre-apply values.

## 6. Verify public behavior

Check these live endpoints/pages after restart:

- `/api/match/LFRR4J`: `mvp_source` is `nn`, `match_mvps[0]` is Kix, and `round_mvps` is empty.
- `/match.html?id=LFRR4J`: Kix is labeled Game MVP with NN scoring details.
- A match created before epoch `1791388800`: its existing Hampalyzer game/round MVP display remains intact.
- `/api/stats/mvps`, home summary, player profiles, and player recent-match badges: counts reconcile to `canonical_match_mvps`.

The server synchronizer processes future completed matches every 60 seconds by default. Set `NN_MVP_SYNC_INTERVAL_MS=0` only when intentionally disabling it.

## Rollback

To restore the old public behavior, deploy the prior application revision. The preserved `match_round_mvps` rows are sufficient for the old code.

If the additive NN results must also be cleared, first stop the API and run:

```sql
UPDATE matches
SET nn_mvp_player_key = NULL,
    nn_mvp_steam_id = NULL,
    nn_mvp_display_name = NULL,
    nn_mvp_final_score = NULL,
    nn_mvp_display_score = NULL,
    nn_mvp_formula_version = NULL,
    nn_mvp_status = NULL,
    nn_mvp_reason = NULL,
    nn_mvp_computed_at = NULL
WHERE created_at >= 1791388800;
```

This rollback does not delete or modify Hampalyzer data.
