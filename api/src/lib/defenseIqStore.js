"use strict";

const { parseIdList } = require("../helpers/values");
const { CLASSES, dominantClass } = require("./defenseIq");

function loadDefenseIq(db) {
  const matches = db.prepare(`
    SELECT match_id, map_name, created_at, blue_ids, red_ids, winner
    FROM matches
    WHERE status='completed' AND match_type='pickup'
      AND player_format='4v4' AND expected_players=8
    ORDER BY created_at DESC, match_id DESC
  `).all().map(row => ({
    id: String(row.match_id), map: row.map_name || "", createdAt: Number(row.created_at),
    blue: [...new Set(parseIdList(row.blue_ids))], red: [...new Set(parseIdList(row.red_ids))],
    winner: String(row.winner || "").toUpperCase()
  }));
  const matchById = new Map(matches.map(match => [match.id, match]));
  const names = new Map(db.prepare("SELECT player_id, display_name FROM ratings").all()
    .map(row => [String(row.player_id), row.display_name || String(row.player_id)]));
  const links = new Map();
  for (const row of db.prepare("SELECT steam_id, discord_id FROM player_steam_ids").all()) {
    if (row.steam_id == null || row.discord_id == null) continue;
    const key = String(row.steam_id);
    const ids = links.get(key) || new Set();
    ids.add(String(row.discord_id));
    links.set(key, ids);
  }
  const rows = db.prepare(`
    SELECT c.match_id, c.player_key, s.steam_id, s.display_name,
      LOWER(TRIM(c.class_name)) AS class_name, SUM(c.seconds) AS seconds
    FROM match_player_classes c
    JOIN matches m ON m.match_id=c.match_id
    LEFT JOIN match_player_stats s ON s.match_id=c.match_id AND s.player_key=c.player_key
    WHERE m.status='completed' AND m.match_type='pickup'
      AND m.player_format='4v4' AND m.expected_players=8
      AND LOWER(TRIM(c.class_name)) IN ('hwguy','demoman','soldier','engineer')
      AND c.seconds > 0
    GROUP BY c.match_id, c.player_key, LOWER(TRIM(c.class_name))
  `).all();
  const grouped = new Map();
  let excludedIdentityRows = 0;
  for (const row of rows) {
    const match = matchById.get(String(row.match_id));
    if (!match || !Number.isFinite(match.createdAt) || match.createdAt <= 0) continue;
    const roster = new Set([...match.blue, ...match.red]);
    const candidates = new Set();
    for (const identifier of [row.player_key, row.steam_id]) {
      if (identifier == null) continue;
      const key = String(identifier);
      if (roster.has(key)) candidates.add(key);
      for (const id of links.get(key) || []) candidates.add(id);
    }
    // A shared Steam link must never silently attribute a choice to either player.
    if (candidates.size !== 1) { excludedIdentityRows++; continue; }
    const playerId = [...candidates][0];
    const blue = match.blue.includes(playerId);
    const red = match.red.includes(playerId);
    if (!roster.has(playerId) || blue === red) { excludedIdentityRows++; continue; }
    const key = JSON.stringify([match.id, playerId]);
    let observation = grouped.get(key);
    if (!observation) {
      const team = blue ? "BLUE" : "RED";
      const result = match.winner === "TIE" ? "tie" : !["BLUE", "RED"].includes(match.winner)
        ? "unknown" : match.winner === team ? "win" : "loss";
      observation = { matchId: match.id, playerId, map: match.map, createdAt: match.createdAt,
        team, result, seconds: Object.fromEntries(CLASSES.map(name => [name, 0])) };
      grouped.set(key, observation);
    }
    observation.seconds[row.class_name] += Number(row.seconds) || 0;
    if (!names.has(playerId)) names.set(playerId, row.display_name || playerId);
  }
  const observations = [...grouped.values()].map(row => ({ ...row, dominant: dominantClass(row.seconds) }));
  const playerIds = new Set(observations.map(row => row.playerId));
  const players = [...playerIds].map(id => ({ id, name: names.get(id) || id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { matches, matchById, observations, names, players, excludedIdentityRows,
    maps: [...new Set(observations.map(row => row.map).filter(Boolean))].sort() };
}

module.exports = { loadDefenseIq };
