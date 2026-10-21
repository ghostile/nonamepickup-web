# Prediction website staging

The site visuals and backend are staged on `codex/prediction-website-preview`. Existing navigation, sitemap and live data remain disconnected. All preview accounts/amounts are synthetic. No deployment or live publication is authorized by these files.

## Local preview

From `api/`, install the existing package dependencies and run:

```sh
npm ci
npm run preview:predictions
```

Open `http://127.0.0.1:4173/predictions.html`. Other pages: `/my-predictions.html` and `/prediction-rules.html`. The standalone server binds loopback, loads no `.env`, opens no database and never starts the bot or main API. Only preview pages/assets and synthetic endpoints are served. Existing site header links are preserved; unrelated site pages are not served by this isolated preview.

Use `?state=empty`, `?state=unavailable` or `?state=stale` to inspect standings/account states. Empty account preview shows an uninitialized account, with no invented stored balance. Stale simulates an old snapshot; data is otherwise read fresh per request. These state switches have no effect in live mode. Preview timestamps/deadlines are generated for demonstration and never describe real games.

## API contract (version 1)

All responses have `Cache-Control: private, no-store, max-age=0`. Success: `{ ok:true, data, meta:{ contractVersion:1, mode, synthetic, updatedAt, stale } }`. Timestamps are Unix **milliseconds**, ratios are 0–1 or null, point values are safe whole integers. Errors return `{ ok:false, error:<fixed code> }` without database details or private state.

| GET endpoint under `/api/predictions` | Data |
| --- | --- |
| `/config` | Column keys/labels/types, proposed rank policy, login/public availability |
| `/standings` | `columns`, `rows`, `page`, `pageSize`, `pages`, `total` |
| `/me` | Private account summary and paginated own bet/market history |
| `/me/activity` | Paginated own monetary ledger entries, excluding operation/allocation/house markers |
| `/auth/login` | Discord identify-only authorization redirect (live configuration only) |
| `/auth/callback` | Server token exchange and fixed redirect to private page |

`POST /auth/logout` clears the server session and requires the configured same origin. No financial or consent mutation endpoints exist. `/me` endpoints derive identity exclusively from the server session; any client-provided ID is ignored. Preview always uses a fixed fictional account.

Standings query: `page` (1–1,000,000), `pageSize` (1–100, default 20), `search` (max 100 characters), `sort` (`rank`, `displayName`, `netProfit`, `settledGames`, `winRate`), `direction` (`asc`/`desc`). Account/activity query: `page`, `pageSize` (default 10). Invalid queries return 400. Requests beyond the final page clamp to the final page. Unknown correct-pick rate sorts last in either direction.

Public row fields are exactly `rank`, `displayName`, `netProfit`, `settledGames`, `winRate`. Rank always represents net profit, including when the table is sorted differently. Equal profit uses competition ranking (1,1,3), with deterministic name ordering. Searches do not recalculate ranks. Ten finalized games is a proposed eligibility threshold, not an approved publication policy. Inactive opted-in players remain included.

Private summary: `initialized`, `displayName`, `balance` (null if uninitialized), `lockedPoints`, `personalLimit`, `settledGames` (progression), `finalizedGames`, `netProfit`, `reviewGames`, `reviewNetProfit`, `winRate`, `updatedAt`. History fields: `matchId`, `revision`, `pick`, `stake`, `credits`, `netProfit`, `status`, `outcome`, `refunded`, `ruleVersion`, `closesAt`, `updatedAt`, `marketState`, `gameLimit`, `availableStake`. Game limit means the current applicable rule for that market, not the historical placement-time limit. Null credits/net means unsettled or non-settlement refund, not zero earnings. `availableStake` is a balance bound, not permission to wager: eligibility/state must still be enforced by Discord.

Activity fields: `kind`, `category`, `amount`, `createdAt`, `matchId`. Kinds distinguish `grant`, `stake` (including replacement delta), `cancel`, `refund`, `settlement`, `correction`, `adjustment`. Category separates `betting_return`, `player_reward`, `betting_correction` and `player_correction` using the account's retained settled bet on that market; other categories equal the kind. Bot eligibility prevents a player receiving both roles in one market. Public profit only includes markets with that account's settled bet. Private activity never exposes raw actor IDs, operation keys, reasons or allocation snapshots.

## Accounting and rules

- Net profit = account-specific `settlement` and `correction` credits for finalized markets with that account's settled bet, minus its retained settled stake once. No grant/adjustment/player-only reward/void/cancel/pregame-refund income. Positive house-funded correction credits count once as actual retained credits; `house_funding`, `operation` and `allocation` rows are never income.
- Correctness uses the latest approved outcome, not historical cash receipts. Corrected accuracy can differ from retained profit. No-correct-bettor refunds count as settled games and progression, yield net zero at that settlement, and are excluded from the accuracy denominator. Correctly predicted ties count as correct picks.
- Reviewed markets' retained net appears only in private review totals; finalized scores exclude them. Previously earned progression remains. Retained prediction history works independently of deleted match-table rows.
- Progression counts distinct retained settled match IDs with `settlement_version > 0`; legacy settled bets count. Multiple settled revisions for one account/game fail closed as ambiguous data rather than duplicating income.
- Rule version 1 is fixed 250. Version 2 personal limit is `100 + 10 × progression games`, with safe-integer bounds and available balance. Website never calls `ensureAccount` or migrates the schema. Null balance means not initialized; first grant remains the bot's job.
- Original team identities, the full 120-second countdown, and persisted market deadlines come from the bot. Browser never guesses a real closing time from gameplay. All betting remains private in Discord.

## Future activation configuration — leave unset now

Existing API mode defaults **off** and mounts no prediction routes. `PREDICTIONS_WEB_MODE=preview` explicitly mounts synthetic routes in the existing application; the standalone command is preferred for development because it never starts the main API's database/analytics services.

Live mode (`PREDICTIONS_WEB_MODE=live`) opens a **separate read-only** connection to the configured `ELO_DB` (otherwise the existing API configuration's ELO path). Requires bot prediction schema version 2. It never changes WAL pragmas, copies a live SQLite file/WAL, initializes the bot store or migrates the bot's tables. The source currently inspected is the uncommitted progression implementation in `C:/Users/ricky/.codex/worktrees/match-predictions/tfcbot`; reconcile with the owner's approved bot revision before activating. Local website work did not alter that checkout.

Public live standings fail closed unless `PREDICTIONS_PUBLIC_POLICY=net-profit-v1-approved`. Even then only entries in `PREDICTIONS_CONSENT_FILE` qualify. This file must live **outside the website repository and configured PUBLIC_DIR**, readable only by the API operator. Proposed shape (fill only after documented consent/field approval):

```json
[
  { "discordId": "123456789012345678", "displayName": "Approved display name", "optedIn": true }
]
```

This is a deployment-time record of approved consent, not automatic opt-in or an inference from using Discord predictions. Remove an entry and restart to withdraw it. No default users, no public Discord IDs, and no self-service consent changes in this staging version. Missing allowlist means empty standings. Duplicate/invalid entries or files inside served paths reject startup.

Discord login requires `PREDICTIONS_DISCORD_CLIENT_ID`, `PREDICTIONS_DISCORD_CLIENT_SECRET`, `PREDICTIONS_DISCORD_REDIRECT_URI`. Register the exact `/api/predictions/auth/callback` URI with Discord. Uses [Discord authorization-code OAuth](https://docs.discord.com/developers/topics/oauth2), `identify` only, single-use five-minute state, one-hour random server sessions, HttpOnly/SameSite=Lax/path-scoped cookies (Secure on HTTPS), fixed return URL and bounded network timeouts. Access/refresh tokens are not stored or sent to browsers. Remote redirect URIs require HTTPS; HTTP is allowed only for loopback development. Missing credentials leave login unavailable. Sessions are process-local: restart signs everyone out; use one API process or sticky sessions for staging. A shared session store is required before a multi-instance launch.

Private/API routes mount before website analytics, use no shared cache and return fixed error codes. New pages include no third-party analytics beacon. Configure the proxy to avoid logging OAuth query strings, disable CDN caching on `/api/predictions/*`, and keep the consent file/secrets outside static hosting. Public shell JS still uses the site's normal supporters/queue/player search when the page is eventually integrated; isolated preview stubs these calls.

If the bot and site run on separate hosts, this local-file adapter is insufficient: a separately approved authenticated read API or consistent SQLite-aware export is needed. Never distribute the SQLite file/WAL directly to browsers or copy a live SQLite file as an integration strategy.

## Verification and remaining work

Repository instruction forbids test creation/modification/execution; no tests were added, changed or run. Syntax and whitespace checks, desktop/mobile screenshots and a source review are used for this staging delivery. These checks do not establish financial correctness against fixtures or production behavior.

Captured all three pages at 1440px desktop and 390px mobile in `docs/review-artifacts/predictions/`. Inspected search, tied ranks, pagination, empty/uninitialized account, unavailable backend and stale account display. No browser JS errors; account/rules/mobile standings stayed within viewport width with tables scrolling inside their wrappers. Source review issues (correction history dates and stale account previews) were fixed. Syntax checks and tracked whitespace checks passed.

Before activation: approve fields, consent, ranking and bot revision; confirm same-host ELO path/schema or implement an approved remote adapter; configure OAuth/proxy/caches; verify permissions with two actual Discord accounts and anonymous access; authorize and run schema-shaped financial fixture checks covering corrections/revisions/refunds/legacy limits; visually inspect authenticated states. No live DB read, OAuth session, production topology or two-account integration has been verified here. No deployment, merge, push or public navigation change was performed.
