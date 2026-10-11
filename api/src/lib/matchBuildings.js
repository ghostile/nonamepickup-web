"use strict";

// Building tables are supplied by the parser and may be absent on older imports.
function readMatchBuildings(db, matchId, logRouteError) {
  function read(table) {
    try {
      return db.prepare(`SELECT * FROM ${table} WHERE match_id=?`).all(matchId);
    } catch (error) {
      if (!String(error.message).includes("no such table")) {
        logRouteError(`[match buildings: ${table}]`, error);
      }
      return [];
    }
  }

  const rounds = read("match_sentry_round_stats");
  const lives = read("match_sentry_lives");
  const number = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  function parsed(value) {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return null; }
  }
  function levelValue(row, level, metric) {
    const entries = Object.entries(row);
    const metricPattern = metric === "kills" ? /kill/i : /second|uptime|duration|time/i;
    for (const [key, value] of entries) {
      if (!metricPattern.test(key) || /dispenser|percent|ratio/i.test(key)) continue;
      const map = parsed(value);
      if (map && typeof map === "object" && !Array.isArray(map) && Object.hasOwn(map, level)) {
        return number(map[level]);
      }
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const marker = level === "unknown" ? "unknown" : `(?:level|lvl|l)${level}`;
      if (new RegExp(marker).test(normalized)) return number(value);
    }
    return null;
  }
  function samePlayer(a, b) {
    if (a.player_key && b.player_key) return String(a.player_key) === String(b.player_key);
    if (a.steam_id && b.steam_id) return String(a.steam_id) === String(b.steam_id);
    return Boolean(a.display_name && a.display_name === b.display_name);
  }
  const summaries = rounds.length ? rounds : lives.filter((row, index) =>
    lives.findIndex(other => Number(other.round_num) === Number(row.round_num) && samePlayer(row, other)) === index
  );
  return summaries.map(row => {
    const playerLives = lives.filter(life => Number(life.round_num) === Number(row.round_num) && samePlayer(row, life));
    function metric(level, name) {
      const direct = rounds.length ? levelValue(row, level, name) : null;
      if (direct !== null) return direct;
      const values = playerLives.map(life => levelValue(life, level, name));
      return values.length && values.every(value => value !== null) ? values.reduce((sum, value) => sum + value, 0) : null;
    }
    const dispenser = Object.entries(row).find(([key]) => /dispenser/i.test(key) && /seconds|uptime|duration/i.test(key) && !/percent|ratio/i.test(key));
    const notes = Object.entries(row).filter(([key]) => /warning|notes/i.test(key)).flatMap(([, value]) => {
      const list = parsed(value);
      return Array.isArray(list) ? list.filter(note => typeof note === "string") : [];
    });
    return {
      player_key: row.player_key,
      steam_id: row.steam_id,
      display_name: row.display_name,
      round_num: Number(row.round_num),
      levels: Object.fromEntries(["1", "2", "3", "unknown"].map(level => [level, {
        kills: metric(level, "kills"),
        seconds: metric(level, "seconds")
      }])),
      dispenser_seconds: dispenser ? number(dispenser[1]) : null,
      notes
    };
  });
}

module.exports = { readMatchBuildings };
