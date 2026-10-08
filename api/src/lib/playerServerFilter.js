"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");

// Filter match-backed player data using matches.server_name (see docs/database/elo-schema.sql).
function createPlayerServerFilter(database) {
  const context = new AsyncLocalStorage();
  const tables = ["matches", "match_rounds", "match_player_stats", "match_player_round_stats",
    "match_player_weapons", "match_player_classes", "match_round_mvps", "rating_changes",
    "match_kill_events", "pickup_flag_carry_rounds", "pickup_flag_carry_players", "pickup_flag_carries"];
  function metadata() {
    // The bot's schema records historical server names on matches.
    const hasServerName = database.prepare("PRAGMA table_info(matches)").all()
      .some(row => row.name === "server_name");
    const sql = hasServerName
      ? "SELECT match_id, TRIM(server_name) AS server FROM matches WHERE server_name IS NOT NULL AND TRIM(server_name) != ''"
      : "SELECT NULL AS match_id, NULL AS server WHERE 0";
    const servers = database.prepare(`SELECT DISTINCT server FROM (${sql}) ORDER BY server COLLATE NOCASE`).all().map(row => row.server);
    return { sql, servers };
  }

  const db = new Proxy(database, {
    get(target, property) {
      if (property !== "prepare") {
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return sql => {
        const filter = context.getStore();
        if (!filter?.server) return database.prepare(sql);
        const used = new Set();
        const scopedSql = sql.replace(/\b(FROM|JOIN)\s+([a-z_]+)\b/gi, (text, keyword, table) => {
          if (!tables.includes(table)) return text;
          used.add(table);
          return `${keyword} nn_server_${table}`;
        });
        if (!used.size) return database.prepare(sql);
        const scope = `nn_server_match_ids AS (SELECT DISTINCT match_id FROM (${filter.sql}) WHERE server = ?), ` +
          [...used].map(table => `nn_server_${table} AS (SELECT * FROM ${table} WHERE match_id IN (SELECT match_id FROM nn_server_match_ids))`).join(", ");
        const statement = database.prepare(/^\s*WITH\b/i.test(scopedSql)
          ? scopedSql.replace(/^\s*WITH\b/i, `WITH ${scope},`)
          : `WITH ${scope} ${scopedSql}`);
        return {
          all: (...params) => statement.all(filter.server, ...params),
          get: (...params) => statement.get(filter.server, ...params)
        };
      };
    }
  });

  function middleware(req, res, next) {
    if (!req.path.startsWith("/player/")) return next();
    const server = req.query.server === undefined ? "" : req.query.server;
    if (typeof server !== "string" || server.length > 256) return res.status(400).json({ ok: false, error: "invalid_server" });
    if (!server && !req.path.endsWith("/v3")) return next();
    try {
      const info = metadata();
      req.playerServers = info.servers;
      if (server && !info.servers.includes(server)) return res.status(400).json({ ok: false, error: "unknown_server" });
      return context.run({ ...info, server }, next);
    } catch (error) {
      return next(error);
    }
  }

  return { db, middleware };
}

module.exports = { createPlayerServerFilter };
