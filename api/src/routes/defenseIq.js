"use strict";

const express = require("express");
const { loadDefenseIq } = require("../lib/defenseIqStore");
const { actualChoice, analyzePlayer } = require("../lib/defenseIq");

function createDefenseIqRouter({ db, cleanString, sendError, logRouteError }) {
  const router = express.Router();
  let snapshot;
  let expiresAt = 0;
  function data() {
    if (!snapshot || Date.now() >= expiresAt) {
      snapshot = loadDefenseIq(db);
      expiresAt = Date.now() + 30000;
    }
    return snapshot;
  }
  function fail(res, error) {
    logRouteError("[/api/defense-iq]", error);
    const unavailable = /no such (table|column)/i.test(String(error.message));
    return sendError(res, unavailable ? 503 : 500,
      unavailable ? "defense_iq_data_unavailable" : "defense_iq_failed");
  }
  router.get("/defense-iq/options", (req, res) => {
    try {
      const source = data();
      const covered = new Set(source.observations.map(row => row.matchId));
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({ ok: true, data: { players: source.players, maps: source.maps,
        matches: source.matches.slice(0, 100).map(match => ({ id: match.id, map: match.map,
          createdAt: match.createdAt, hasDefenseData: covered.has(match.id) })) } });
    } catch (error) { fail(res, error); }
  });
  router.get("/defense-iq", (req, res) => {
    try {
      const matchId = cleanString(req.query.match, 100);
      const playerId = cleanString(req.query.player, 100);
      const map = cleanString(req.query.map, 200);
      if (matchId && (playerId || map)) return sendError(res, 400, "choose_one_defense_iq_view");
      if (!matchId && (!playerId || !map)) return sendError(res, 400, "missing_player_or_map");
      const source = data();
      res.setHeader("Cache-Control", "public, max-age=30");
      if (matchId) {
        const match = source.matchById.get(matchId);
        if (!match) return sendError(res, 404, "completed_pickup_not_found");
        const actual = new Map(source.observations.filter(row => row.matchId === matchId)
          .map(row => [row.playerId, row]));
        const players = [ ["BLUE", match.blue], ["RED", match.red] ].flatMap(([team, ids]) =>
          ids.map(id => ({ id, name: source.names.get(id) || id, team,
            ...analyzePlayer(source.observations, id, match.map, match.createdAt),
            actual: actualChoice(actual.get(id)) })));
        return res.json({ ok: true, data: { mode: "match", match, players,
          cutoff: match.createdAt, modelVersion: "defense-iq-v1" } });
      }
      if (!source.players.some(player => player.id === playerId)) return sendError(res, 404, "player_defense_history_not_found");
      if (!source.maps.includes(map)) return sendError(res, 404, "map_defense_history_not_found");
      const cutoff = Math.floor(Date.now() / 1000);
      return res.json({ ok: true, data: { mode: "player", map, cutoff,
        player: { id: playerId, name: source.names.get(playerId) || playerId,
          ...analyzePlayer(source.observations, playerId, map, cutoff) }, modelVersion: "defense-iq-v1" } });
    } catch (error) { fail(res, error); }
  });
  return router;
}

module.exports = { createDefenseIqRouter };
