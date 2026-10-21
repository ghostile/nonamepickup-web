# Defense IQ

Standalone `/defense-iq.html`, inheriting the existing NoName header, fonts, colors, and responsive styling. Do not add navigation links on any existing page. The user authorized autonomous implementation from start to finish.

## Purpose
Compare expected defensive class choices with recorded choices and historical team results. Predict habits, not skill or a causal explanation for losing. Exclude Spy, Medic, Scout and all other classes; use only HWGuy, Demoman, Soldier, Engineer. No Elo input or ping input.

## Views
Match Review selects a completed 4v4 pickup and shows both rosters. Each player has four pre-match probabilities, recorded defensive time shares, and earlier same-map results grouped by dominant defensive class. Player + Map selects a linked player and map and shows current probabilities, class results, and recent recorded choices.

## Model and data
Read existing class seconds, match metadata, roster membership and Steam-to-Discord links. Aggregate each player's four defensive classes per match. A unique class with the most positive seconds is the observed target; a tie remains mixed and is excluded from prediction labels and class outcome buckets. Full actual time shares remain visible. Ignore matches with no defensive seconds. Resolve aliases to a single identity; ambiguous identity links are excluded. Use completed 4v4 pickups only.

Each labeled match contributes one recency-weighted observation (180-day half-life). Smooth player-wide counts with one pseudo-observation per class, then smooth player-on-map counts toward that distribution with a prior strength of five. No player history means no personal prediction. Map history absent means a clearly labeled overall fallback. Percentages use largest-remainder rounding to sum to 100. These are estimated habits, not calibrated guarantees.

Historical review restricts all history to timestamps strictly before the selected match. Equal timestamps are excluded. Results are unweighted W/L/T per dominant class on that map; win percentage excludes ties and unknown winners. Do not recommend a class based on raw win rates. Show sample counts and sparse-history notices. Offensive-only and missing data must not become 25% predictions or invented actual classes.

## Interfaces and limits
GET `/api/defense-iq/options` returns recent matches (100), available maps and linked players with defensive records. GET `/api/defense-iq?match=ID` returns match review. GET `/api/defense-iq?player=ID&map=NAME` returns current player analysis. Parameterized SQL, bounded IDs, cache options/history for 30 seconds, no schema migrations or new dependencies. Existing records are read only.

## Verification
No test files or test execution, as required by AGENTS.md. Check JavaScript syntax, review SQL and rendering paths, and inspect browser layout if a local browser preview is available. Clearly report any runtime verification unavailable without a local database.
