"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const apiRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(apiRoot, "..");
const dataDir = path.join(apiRoot, ".dev-data");
const databasePath = path.join(dataDir, "elo.db");
const schemaPath = path.join(repositoryRoot, "docs", "database", "elo-schema.sql");

fs.mkdirSync(dataDir, { recursive: true });
if (fs.existsSync(databasePath)) fs.rmSync(databasePath);

const db = new Database(databasePath);
const schema = fs.readFileSync(schemaPath, "utf8")
  .replace(/^CREATE TABLE sqlite_sequence\(name,seq\);\s*$/m, "")
  .replace(/^CREATE TABLE sqlite_stat1\(tbl,idx,stat\);\s*$/m, "");
db.exec(schema);

const players = [
  ["1001", "Ghostile", 1515, "STEAM_0:1:1001"],
  ["1002", "MedicMain", 1490, "STEAM_0:1:1002"],
  ["1003", "RocketMan", 1530, "STEAM_0:1:1003"],
  ["1004", "ScoutRush", 1460, "STEAM_0:1:1004"],
  ["1005", "DemoKing", 1520, "STEAM_0:1:1005"],
  ["1006", "SniperJoe", 1480, "STEAM_0:1:1006"],
  ["1007", "Engie", 1500, "STEAM_0:1:1007"],
  ["1008", "Pyro", 1505, "STEAM_0:1:1008"]
];

const insertRating = db.prepare("INSERT INTO ratings(player_id,display_name,rating) VALUES(?,?,?)");
const insertSteam = db.prepare("INSERT INTO player_steam_ids(discord_id,steam_id,display_name,is_primary) VALUES(?,?,?,1)");
for (const [id, name, rating, steam] of players) {
  insertRating.run(id, name, rating);
  insertSteam.run(id, steam, name);
}

const insertMatch = db.prepare(`
  INSERT INTO matches(
    match_id,created_at,map_name,server_name,blue_ids,red_ids,winner,status,
    mode,avg_blue,avg_red,score_blue,score_red,match_type,player_format,
    expected_players,scoring_mode
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const insertChange = db.prepare(`
  INSERT INTO rating_changes(match_id,player_id,before,after,delta,created_at,ts)
  VALUES(?,?,?,?,?,?,?)
`);
const insertMatchPlayer = db.prepare(`
  INSERT INTO match_players(match_id,player_id,team,created_at,map_name,status,winner)
  VALUES(?,?,?,?,?,?,?)
`);
const insertStats = db.prepare(`
  INSERT INTO match_player_stats(
    match_id,player_key,steam_id,display_name,team,kills,deaths,enemy_damage,
    damage_taken,flag_captures,flag_touches,initial_touches,flag_time_seconds,
    main_class
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const servers = ["East", "Central", "West"];
const maps = ["2fort", "well", "shutdown2", "openfire"];
const blue = players.slice(0, 4).map(([id]) => id);
const red = players.slice(4).map(([id]) => id);
const ratings = new Map(players.map(([id, , rating]) => [id, rating - 15]));
const now = Math.floor(Date.now() / 1000);

db.transaction(() => {
  for (let index = 0; index < 18; index += 1) {
    const matchId = `dev-match-${String(index + 1).padStart(2, "0")}`;
    const createdAt = now - ((18 - index) * 86400);
    const server = servers[index % servers.length];
    const map = maps[index % maps.length];
    const winner = index % 4 === 3 ? "RED" : "BLUE";
    insertMatch.run(
      matchId, createdAt, map, server, JSON.stringify(blue), JSON.stringify(red),
      winner, "completed", "4v4", 1500, 1500,
      winner === "BLUE" ? 5 : 2, winner === "RED" ? 5 : 2,
      "pickup", "4v4", 8, "rounds"
    );

    players.forEach(([id, name, , steam], playerIndex) => {
      const team = playerIndex < 4 ? "BLUE" : "RED";
      const won = team === winner;
      const delta = won ? 15 : -15;
      const before = ratings.get(id);
      const after = before + delta;
      ratings.set(id, after);
      insertChange.run(matchId, id, before, after, delta, createdAt, createdAt);
      insertMatchPlayer.run(matchId, id, team, createdAt, map, "completed", winner);
      insertStats.run(
        matchId, steam, steam, name, team,
        8 + ((index + playerIndex) % 16), 6 + ((index + playerIndex * 2) % 12),
        1200 + (index * 55) + (playerIndex * 90), 1000 + (playerIndex * 80),
        won && playerIndex % 3 === 0 ? 1 : 0, 2 + (playerIndex % 4),
        playerIndex % 2, 20 + (index * 3),
        ["soldier", "medic", "scout", "demoman"][playerIndex % 4]
      );
    });
  }

  const updateRating = db.prepare("UPDATE ratings SET rating=? WHERE player_id=?");
  for (const [id, rating] of ratings) updateRating.run(rating, id);
})();

db.close();
console.log(`Created local development database: ${databasePath}`);
console.log("Demo player: Ghostile (id 1001)");
