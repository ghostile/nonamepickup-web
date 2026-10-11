---
name: NoName TFC Match Details V2
description: Scoped documentation of the existing navy, blue, and red match dashboard.
colors:
  page-navy: "#030911"
  panel-navy: "#030d1b"
  player-navy: "#05101e"
  text: "#dce9fa"
  muted: "#a1b9d3"
  border: "#194566"
  team-blue: "#42b3ff"
  team-red: "#ff4766"
  selected: "#00b6ff"
  focus: "#60ccff"
typography:
  headline:
    fontFamily: "Orbitron, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 950
    lineHeight: 1
  team-score:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.1
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
rounded:
  control: "5px"
  panel: "6px"
  team: "7px"
spacing:
  panel-gap: "10px"
  team-gap: "12px"
components:
  tab:
    backgroundColor: "#061221"
    textColor: "#c7d8ee"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  tab-selected:
    backgroundColor: "#062642"
    textColor: "#fff"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  support-panel:
    backgroundColor: "{colors.panel-navy}"
    rounded: "{rounded.panel}"
    padding: "9px 10px"
---

# Match Details V2

## Overview

This document describes only `match.html` and its match dashboard. It extends the incumbent navy, blue, and red visual system in Operate mode: users compare teams, inspect player and round performance, explore captures, and open recorded replays. It does not establish a new site-wide identity or change other screens.

The page retains the shared navigation, real match metadata, map preview, score, external sources, and round tables. Compact team summaries and expandable player rows lead into class, weapon, damage, and capture comparisons. Existing Hampalyzer and NoName MVP analysis remains available through a disclosure.

Implementation sources are `assets/css/match-dashboard.css`, `assets/js/match-analytics.js`, `assets/js/match.js`, and `match.html`. The dashboard stylesheet loads after the incumbent `match.css`. Shared overrides are scoped to the match document/page; analytics behavior mounts inside `#match-analytics`.

The frontmatter records actual reusable values from those styles. It is descriptive of this surface; the source files remain the implementation authority. No root `DESIGN.md`, `PRODUCT.md`, or global design sidecar is introduced.

## Colors

Team blue identifies Team 1; team red identifies Team 2 throughout summaries, player containers, comparison bars, and capture lines. Labels accompany color so users can distinguish the teams without relying on hue alone. Selected cyan marks active tabs and filters; the focus color marks keyboard interaction.

Navy page, panel, and player surfaces provide tonal separation. Muted text supports labels and explanatory notes; the border token separates panels and disclosures. Friendly damage and deaths receive red emphasis; enemy damage receives blue emphasis; conceded kills and concussion jumps receive gold emphasis. These metric accents describe the displayed values and do not replace team identity.

## Typography

Inter is the dashboard's reading and control face. Orbitron retains the existing match heading and score character. The match heading uses the frontmatter headline role on desktop and decreases to (30px) on mobile. Team summary scores use the team-score role; the hero scoreboard uses (30px).

Panel headings use the title role. Player names use (11px, weight 700), class labels use (10px), and the dense metric labels use (7px). Round-table headers use (8px) and values use (10px). Supporting notes use (9px, line-height 1.5). Analytics and round tables use tabular numerals for reliable column comparison.

## Layout

The main container is centered at `min(97vw, 1760px)`, with desktop vertical padding of (14px 0 24px). The match hero and score share a two-column header; each round has its own table. Team summaries and player sections use two equal columns with the team-gap token. Selecting one team changes the summary and player grids to one column.

| Viewport | Team and round layout | Support panels and overflow |
| --- | --- | --- |
| Above 1150px | Two team columns; two round columns | Four support panels in one row |
| 761–1150px | Two team columns; two round columns | Two support columns; tabs wrap above the filter; player and round tables scroll internally |
| 481–760px | Teams and rounds stack; hero stacks; main padding becomes (8px) | Two support columns; tabs scroll horizontally; player identity stays sticky within its scrolling row |
| 480px and below | Stacked teams and rounds | One support column |
| 1500px and above | Wider player columns | Player-grid minimum increases from (605px) to (680px); team summary metrics use eleven columns |

The exact support breakpoint uses `max-width:1150px`, so a viewport of exactly (1150px) has two support columns. Round tables have a (590px) minimum width. Player grids retain their readable minimum width inside focusable scroll regions rather than widening the document. Dense player rows use a minimum height of (70px), increasing to (76px) on wide desktops.

## Elevation & Depth

The dashboard uses navy tonal layers and thin team/border strokes instead of panel shadows. The hero map image is darkened by a directional overlay so the match metadata and scores remain legible. Selected controls have a cyan inset bottom stroke; open player rows change surface tone and add a dividing border. Existing disclosed MVP components retain their incumbent treatments.

## Shapes

Controls and player rows use the control radius, support panels use the panel radius, and team containers use the team radius. The hero is rectangular. Filters join into a segmented group with rounded outer ends. Compact bars use (2px) tracks and (1px) fills; capture markers are circles.

## Components

### Match navigation and team filters

Eight views are available: Player Overview, Team Comparison, Round Timeline, Flag Pace, Weapon Usage, Damage, Map Vision, and Downloads. Native buttons implement a tablist with a single active tab stop, `aria-selected`, and a labelled tabpanel. Arrow Left/Right cycle through enabled tabs; Home/End select the first/last enabled tab. Both, Team 1, and Team 2 filters use `aria-pressed` and apply consistently to summaries and analytical views.

Controls show an explicit focus outline of (2px) with an offset of (3px). Hover adds a lighter navy surface and blue border. Disabled views retain an explanatory title, reduced opacity, and a default cursor. Flag Pace, Round Timeline, and Weapon Usage are disabled when their required records are absent. Reduced-motion preferences remove analytics transitions.

### Player rows and expanded statistics

Each native `details` row presents identity/class, twelve combat and objective metrics, up to four weapon-share bars, and a round K/D graphic. Profile links preserve the existing player identity and supporter badge behavior. Mouse and keyboard expansion expose all returned class playtimes and weapon kill records, a detailed round table, damage taken, initial touches, and rating change.

Engineer information reuses `renderEngineerBuildings` rather than implementing a second interpretation. It includes sentry kills and uptime by level, total SG, dispenser uptime, and applicable recording notes. Incomplete building values remain unavailable; the section appears only when recorded building information supports it.

### Support comparisons and captures

Overview shows five class entries and six weapon entries ranked by pooled totals; notes identify truncated overview lists and point users to complete player detail records. Comparison bars use actual values and scale each pair against its larger finite value. Damage totals and per-kill/per-death ratios are distinct rows.

Round Performance and Flag Pace draw cumulative capture steps using exact event timestamps on the full match clock. Capture points have accessible names and can be hovered or focused to reveal team, capture number, time, and player in a live detail area. No timestamped captures produces an explicit empty state; the overview falls back to recorded round scores when available.

### Map Vision and downloads

Map Vision checks `api/pickup-replays/viewer/{matchId}/{round}` for each known round and enables itself only when metadata with replay files is returned. It links to the existing `pickup-replay.html?matchId={matchId}&round={round}` viewer. Both rounds were verified for D9M3FT. An unavailable replay leaves Map Vision disabled and shows an availability message in Downloads.

JSON exports the full match API response regardless of team selection. CSV exports player metrics for the selected team(s), with quoted cells and spreadsheet-formula escaping for string values. Exports use Blob URLs and revoke them after initiating a download. Available Hampalyzer and TFCStats links remain accessible as match sources.

## Do's and Don'ts

- Do preserve this match-only scope when modifying shared selectors or desktop scaling.
- Do retain team labels, explicit metric definitions, keyboard access, and internal table scrolling.
- Do show unavailable data as `—` and preserve complete-record checks for round-derived metrics.
- Don't convert weapon kill counts into shots fired, weapon shares into aggregate kill shares, or pooled class time into elapsed match duration.
- Don't shift capture timestamps by round duration or infer score points when the source omits them.
- Don't turn this compact match composition into a requirement for unrelated screens.

## Metric sources and interpretation

The page loads `api/match/{id}`. Player matching reuses the incumbent key/Steam ID/name resolution. Full-match player totals come from the API's aggregate `player_stats`; round details retain separate enemy/team/suicide values.

| Display | Source and calculation | Availability or interpretation |
| --- | --- | --- |
| K, D, K/D | `player_stats.kills`, `deaths`; kills / deaths | D excludes suicides. For all eight audited players it equals round enemy deaths + team deaths. K/D displays infinity for positive kills with zero deaths and zero for zero kills/zero deaths. |
| CK, SG | Sum `round_player_stats.conced_kills`, `sentry_kills` | Requires exactly one player record for every known round and valid values throughout; missing or duplicate round records produce `—`. |
| TK | `player_stats.team_kills` | Friendly kills, separate from enemy kills. |
| DMG, TDMG | `player_stats.damage`, `team_damage` | Enemy damage and friendly damage remain separate. |
| CJ, CAPS, TOUCH, TIME | `player_stats.conc_jumps`, `caps`, `touches`, `flag_time_seconds` | Concussion jumps, captures, flag touches, and formatted possession time. |
| Additional details | `player_stats.damage_taken`, `initial_touches`; roster `delta`; returned round fields | Preserve the API's meaning; round deaths show enemy / team / suicide. |
| Team totals | Sum each selected team's player metrics | Missing inputs propagate as unavailable; team K/D is total kills / total deaths. |
| Class Breakdown | Pool `class_stats.seconds` by class and team | Player playtime can exceed elapsed match duration when pooled across a roster. |
| Weapon Usage / player bars | Returned `weapon_stats.kills` | The API query has `LIMIT 50`. Percentages divide a weapon's returned kills by that player's total returned weapon kills, not aggregate player kills. Counts describe recorded kills, not firing frequency. |
| Damage / kill, Damage / death | Team enemy damage / team kills or deaths | Missing inputs or zero denominators produce `—`; no invented finite ratio. |
| Duration | Sum `rounds.duration_seconds` | Requires valid duration for every returned round. |
| Capture chart | Sorted nonnegative `capTimeline.time_seconds`; cumulative count per team | Axis extent covers the full duration and latest event. D9M3FT spans roughly 31 minutes. Timestamps already use the whole-match clock; no round offset is added. |
| Score after capture | `capTimeline.score_after` | Null values remain `—`. The chart counts actual captures and does not manufacture score points. |

## Recorded verification

The public reference inspected on October 10, 2026 was [D9M3FT](https://nonamepickup.servehalflife.com/match.html?id=D9M3FT), on `demolish2_b6`, with score (100:70) and duration (30:41). The validation record reconciles all eight players, sixteen round records, and seventeen captures. It records zero page errors and successful checks of all tabs, team filters, mouse/keyboard expansion, keyboard tab navigation, exact capture detail at (29:26), and both replay links. Empty and incomplete data states were also checked.

JSON Blob payloads matched the full response; filtered CSV Blob payloads contained the selected team's four players. Actual browser file saving was canceled by the sandbox, so payload validation is the completed export evidence.

Evidence is saved in `C:/Users/riari/.codex/visualizations/2026/10/11/01a128a1-45ef-7893-9549-9de92f44df66/`:

- `dashboard-validation.json` — reconciliation and interaction results.
- `desktop-final.png`, `tablet-final.png`, `mobile-final.png` — final viewport captures.
- `replay-1.json`, `replay-2.json` — returned replay metadata.
- `main-tests.log` — existing suite result: 119 tests, 104 passed, 15 pre-existing failures outside the Match Details changes. The API package defines no lint or build scripts.

This documentation pass only reads the saved verification artifacts; it creates, changes, and runs no tests. The recorded failing test names are:

| Existing file | Failing names |
| --- | --- |
| `comparison-engine.test.js` | invalid performance and zero variance use equal-share fallback; fixed-pool replay is chronological, cumulative, separate, and read-only |
| `pickup-replay-brushes.test.js` | pickup replay renders bounded and trigger-aware GoldSrc entity lighting; schema-v4 worker parses sparse brush definitions and transferable timelines; renderer binds brush IDs to submodel nodes and seeks sparse tracks deterministically |
| `pickup-replay-corpses.test.js` | schema-v3 crouch uses baked crouch_idle player geometry instead of scaling; catalog provides class-held weapons and distinct buildable team palettes |
| `pickup-replay-hitscan.test.js` | assault cannon effects originate at the player muzzle and honor the projectile toggle; held weapons inherit the normalized player model scale |
| `pickup-replay-layout.test.js` | pickup replay uses the complete site-wide navigation |
| `pickup-replays.test.js` | event timestamp reversals greater than 50 ms are rejected; schema-v3 rejects absolute, URL, drive-letter, null, and unallowlisted model paths; concurrent identical invalid uploads create one terminal quarantine |
| `replay-map-materials.test.js` | classifies GoldSrc water and effect textures without matching signs |
| `replay-projectile-colors.test.js` | pickup replay cache key exposes the latest projectile classifier |
