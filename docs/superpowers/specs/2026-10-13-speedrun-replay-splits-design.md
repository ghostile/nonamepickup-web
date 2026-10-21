# Speedrun Replay Split Timing Design

## Goal

Add authoritative replay timing and split analysis to `speedrun-replay.html` without fabricating checkpoint events for legacy replays.

## Existing data boundary

The replay API already supplies frame timestamps, official run duration, map zones, ruleset, class, and compatible same-map replay candidates. This repository does not contain the speedrun recorder or a checkpoint-event schema. The API therefore reads optional recorded event fields when present and returns an explicit unavailable state otherwise.

## Design

- `api/src/speedruns/splits.js` owns event parsing, ordering, cumulative/segment math, compatibility, and future best-segment aggregation.
- `api/src/routes/speedruns.js` exposes replay ruleset metadata and normalized split analysis. Official `time_ms` remains the finish-time source of truth.
- `speedrun-replay.html`, `assets/css/speedrun-replay.css`, and `assets/js/speedrun-replay.js` add the timer, compact table, comparison picker labels for PB/WR/other runs, active-row highlighting, and actual event markers on the scrubber.
- A replay without explicit recorded checkpoint events shows authoritative Start/Finish values and an unavailable checkpoint state. It never infers historical checkpoint crossings from geometry.
- Comparisons require compatible map, class, ruleset, and checkpoint sequence. Deltas use current cumulative/segment values minus comparison values; negative is ahead.

## Verification

Unit coverage exercises ordering, precision, cumulative and segment deltas, mismatched checkpoint sequences, and legacy payload parsing. The repository test suite, JavaScript syntax checks, and a local static-browser smoke check are run before commit. Production deployment and live verification remain the human handoff.
