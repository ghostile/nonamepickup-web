# Spelling Invaders Shared Scoreboard Design

## Goal

Allow a parent to see how named players perform across Arcade, Practice, and Friday Spelling Test sessions from the protected Parent Zone. The feature must work without accounts, external services, or a database migration.

## Scope

The server will store summary records in a versioned JSON file. A browser submits one summary when a session finishes. The Parent Zone fetches the protected summary collection and displays results grouped and filterable by player and mode.

Each record contains:

- stable record ID and ISO timestamp
- player name entered in the player picker
- active weekly-list ID, name, and word-count snapshot
- mode: `arcade`, `practice`, or `test`
- points earned during the session
- correct count, total count, and calculated accuracy
- first-attempt correct count when available

No answer text, speech data, device identifiers, or other personal information is sent to the server.

## Server API

Add `SPELLING_SCORES_FILE` configuration with a safe default beside the existing spelling-list storage.

- `POST /api/spelling/scores` accepts a validated session summary. It is public because children’s browsers need to submit results; the endpoint rejects malformed data, caps string lengths, validates modes and numeric ranges, and limits stored records to a bounded recent-history maximum.
- `GET /api/spelling/admin/scores` returns the summary records and aggregate totals. It is served through the existing protected `/api/spelling/admin/` Nginx location.
- `DELETE /api/spelling/admin/scores` clears server scoreboard data only after Parent Zone authentication and explicit UI confirmation.

Writes use the same atomic JSON persistence pattern as weekly lists. Missing, empty, or malformed score files recover to an empty collection without breaking the game.

## Browser data flow

At session completion, the client keeps its current LocalStorage behavior and asynchronously submits a summary. A failed submission does not block the results screen and is announced as a non-fatal sync warning. Duplicate submission protection uses the in-memory completed-session guard and a stable session ID.

The player name comes from the active local profile. If the default name is still `Player 1`, the player picker asks for a name before starting a scored session. Names are trimmed and length-limited on both client and server.

The Parent Zone loads server results after authentication and keeps local analytics available as a fallback. It displays:

- player summary cards with sessions, best score, latest accuracy, and average accuracy
- mode filters for All, Arcade, Practice, and Test
- a recent-results table with player, mode, list, score, accuracy, correct/total, and date
- a clear-results control protected by confirmation

## Privacy and trust model

This is a family/classroom scoreboard, not a secure identity system. Anyone able to use the public game can submit a name and summary, so the Parent Zone should label results as self-reported. Parent viewing and deletion remain protected by the existing Basic Auth gate. The UI will not claim that player names are verified.

## Compatibility and migration

The score file schema is versioned independently from the existing LocalStorage schema. Existing local progress and weekly lists remain valid. Existing installations without the environment variable use the default score path. Existing sessions that finish while the API is unavailable remain playable; only their server summary is missed.

## Verification

Verify with API-level tests for validation, persistence, malformed-file recovery, duplicate session IDs, mode filtering, and protected reads/deletes. Verify the frontend production build and the existing unit suite. In a browser, verify named-player submission, Arcade/Practice/Test records, Parent Zone filtering, reload persistence, and clear-results confirmation.
