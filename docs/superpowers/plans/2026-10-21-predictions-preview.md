# Prediction Website Implementation Record

## Current scope (user approved October 21)

Public standings and rules; existing bot Discord IDs are internal matching keys. No website login or personal pages. Keep production disconnected until separately configured/approved.

- [x] Remove My Predictions page, OAuth module/options, /me routes and private repository methods.
- [x] Remove private mock data, account JS/CSS, links and obsolete account screenshots.
- [x] Preserve aggregate accounting, sorting/paging and read-only integration boundary.
- [x] Rewrite current API/setup documentation with no OAuth requirements.
- [x] Verify syntax/whitespace, desktop/mobile standings/rules and removal; complete static review.

No tests created/modified/run (AGENTS.md). Original three-page preview was superseded by the user's approved standings-only change. Keep NN // TFC header, Inter/Orbitron, dark surfaces and all unrelated site navigation. No bot modifications, database mutations, live activation, merge or deployment.

Verification: JavaScript syntax checks passed. Refreshed desktop/mobile screenshots; navigation contains only Standings and How it works, mobile body width matches the 390px viewport, and the browser reported no JavaScript errors. Static review found the rules heading selector was removed with account styles; restored its existing declarations. No other actionable findings.
