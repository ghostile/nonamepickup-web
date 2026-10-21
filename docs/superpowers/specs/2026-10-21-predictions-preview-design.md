# Prediction website design

Updated October 21 after the user approved removing My Predictions and Discord login.

## Scope

Keep the standard NoNamePickups design with public standings and rules only. Remove the private prediction page, OAuth module/configuration, private account/history endpoints, synthetic private account data, account UI code/styles and obsolete screenshots. Discord IDs remain internal identifiers for associating bot records; no visitor identity is needed. Picks/stakes/balances/history stay in Discord. Preserve financial accounting logic for aggregate standings.

## Integration

The read-only ELO adapter and isolated preview remain. Same-server deployment is confirmed by the user; checked-in PM2 config names tfcapi with ELO_DB=/root/tfcbot/elo.db. Do not activate production or broaden publication policy as part of removing login. Public fields remain rank, displayName, netProfit, settledGames and winRate. Real publication requires the existing explicit approval switch/consent allowlist until the owner chooses a different policy.

## Verification

No tests created, modified or run per AGENTS.md. Check syntax/whitespace, inspect standings/rules desktop and mobile, and review removal for stale references and private response exposure. Keep the feature branch; no merge/deployment.
