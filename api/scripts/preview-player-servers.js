"use strict";

// Local preview only: creates an isolated, ignored database with synthetic data.
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const Database = require("better-sqlite3");
const { createPlayersRouter } = require("../src/routes/players");
const { createPickupFlagCarryRouter } = require("../src/routes/pickupFlagCarry");
const { createMatchPlayerLoader } = require("../src/db/matchPlayers");
const { matchColumns, serializeMatch } = require("../src/serializers/match");
const { positiveInt, cleanString, parseIdList } = require("../src/helpers/values");

const root = path.resolve(__dirname, "../..");
const databasePath = path.join(root, "api", "player-server-demo.db");
const fresh = !fs.existsSync(databasePath);
const db = new Database(databasePath);
if (fresh) {
  try {
    const schema = fs.readFileSync(path.join(root, "docs/database/elo-schema.sql"), "utf8")
      .replace(/^CREATE TABLE sqlite_(?:sequence|stat1)\([^;]+;\s*/gm, "");
    db.transaction(() => {
      db.exec(schema);
      const players = Array.from({ length: 8 }, (_, index) => ({
        id: `demo-${index + 1}`, name: `Demo Player ${index + 1}`, steam: `STEAM_0:1:${900001 + index}`
      }));
      for (const player of players) {
        db.prepare("INSERT INTO ratings (player_id, display_name, rating) VALUES (?, ?, ?)").run(player.id, player.name, 1500);
        db.prepare("INSERT INTO player_steam_ids (discord_id, steam_id, display_name, is_primary) VALUES (?, ?, ?, 1)").run(player.id, player.steam, player.name);
      }
      const now = Math.floor(Date.now() / 1000);
      for (let game = 0; game < 6; game++) {
        const matchId = `demo-match-${game + 1}`;
        const east = game < 3;
        const timestamp = now - (6 - game) * 86400;
        const map = east ? "2fort" : "schtop";
        db.prepare("INSERT INTO matches (match_id, created_at, map_name, server_name, blue_ids, red_ids, winner, status, score_blue, score_red) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 20, 10)")
          .run(matchId, timestamp, map, east ? "Demo East" : "Demo West", JSON.stringify(players.slice(0, 4).map(p => p.id)), JSON.stringify(players.slice(4).map(p => p.id)), east ? "BLUE" : "RED");
        db.prepare("INSERT INTO match_rounds (match_id, round_num, map_name, duration_seconds, offense_team, defense_team) VALUES (?, 1, ?, 1200, 'BLUE', 'RED')").run(matchId, map);
        for (const [index, player] of players.entries()) {
          const kills = east ? 10 : 30;
          const delta = (east === (index < 4)) ? 10 : -10;
          db.prepare("INSERT INTO rating_changes (match_id, player_id, before, after, delta, ts) VALUES (?, ?, 1500, ?, ?, ?)").run(matchId, player.id, 1500 + delta, delta, timestamp);
          db.prepare("INSERT INTO match_players (match_id, player_id, team, created_at, map_name, status, winner) VALUES (?, ?, ?, ?, ?, 'completed', ?)").run(matchId, player.id, index < 4 ? "BLUE" : "RED", timestamp, map, east ? "BLUE" : "RED");
          db.prepare("INSERT INTO match_player_stats (match_id, player_key, steam_id, display_name, kills, deaths, enemy_damage, flag_captures, flag_touches, initial_touches, main_class) VALUES (?, ?, ?, ?, ?, 5, ?, ?, 4, 4, 'soldier')").run(matchId, player.steam, player.steam, player.name, kills, kills * 100, east ? 1 : 2);
          db.prepare("INSERT INTO match_player_round_stats (match_id, player_key, steam_id, display_name, round_num, team_name, role, kills, deaths_by_enemy, enemy_damage, flag_captures) VALUES (?, ?, ?, ?, 1, ?, 'defense', ?, 5, ?, ?)").run(matchId, player.steam, player.steam, player.name, index < 4 ? "BLUE" : "RED", kills, kills * 100, east ? 1 : 2);
          db.prepare("INSERT INTO match_player_classes (match_id, player_key, class_name, round_num, seconds) VALUES (?, ?, 'soldier', 1, 1200)").run(matchId, player.steam);
          db.prepare("INSERT INTO match_player_weapons (match_id, player_key, weapon, kills) VALUES (?, ?, 'rocket', ?)").run(matchId, player.steam, kills);
          const victim = players[(index + 4) % 8];
          for (let kill = 0; kill < kills; kill++) {
            db.prepare("INSERT INTO match_kill_events (match_id, round_num, event_time_seconds, attacker_key, attacker_steam_id, attacker_discord_id, attacker_name, attacker_class, attacker_role, attacker_class_confidence, weapon, victim_name, victim_key, victim_steam_id, victim_discord_id, is_enemy_kill) VALUES (?, 1, ?, ?, ?, ?, ?, 'soldier', 'defense', 'exact_single_class_round', 'rocket', ?, ?, ?, ?, 1)").run(matchId, kill * 20, player.steam, player.steam, player.id, player.name, victim.name, victim.steam, victim.steam, victim.id);
          }
        }
        db.prepare("INSERT INTO match_round_mvps (match_id, round_num, mvp_display_name, mvp_player_key, steam_id) VALUES (?, 1, ?, ?, ?)").run(matchId, players[0].name, players[0].steam, players[0].steam);
      }
    })();
  } catch (error) {
    db.close();
    fs.unlinkSync(databasePath);
    throw error;
  }
}

const app = express();
const sendError = (res, status, error) => res.status(status).json({ ok: false, error });
app.use("/api", createPlayersRouter({ db, positiveInt, cleanString, parseIdList, sendError,
  logRouteError: console.error, MAX_PLAYER_MATCH_LIMIT: 5000, matchColumns, serializeMatch,
  loadMatchPlayers: createMatchPlayerLoader(db), cached: (_key, fn) => fn() }));
app.use("/api", createPickupFlagCarryRouter({ db }));
app.get("/api/supporters", (_req, res) => res.json({ ok: true, data: [] }));
app.use(express.static(root, { dotfiles: "deny", index: "player.html" }));
const port = Number(process.env.DEMO_PORT || 4100);
app.listen(port, "127.0.0.1", () => {
  console.log(`Player demo: http://127.0.0.1:${port}/player.html?id=demo-1`);
  console.log(`Database: ${databasePath}`);
  console.log("Expected kills: All servers 120; Demo East 30; Demo West 90.");
});
