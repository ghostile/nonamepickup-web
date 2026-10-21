"use strict";

const { summarize } = require("./metrics");

// Do not import the bot's PredictionStore: its constructor performs schema writes.
function createPredictionRepository(db) {
  const required = ["prediction_accounts", "prediction_markets", "prediction_bets", "prediction_transactions", "prediction_meta"];
  for (const name of required) {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) {
      throw new Error("Prediction schema unavailable");
    }
  }
  if (db.prepare("SELECT value FROM prediction_meta WHERE key='schema_version'").get()?.value !== "2") {
    throw new Error("Prediction schema version 2 required");
  }
  const account = db.prepare("SELECT 1 AS initialized FROM prediction_accounts WHERE discord_id=?");
  const bets = db.prepare("SELECT * FROM prediction_bets WHERE discord_id=?");
  const markets = db.prepare(`SELECT m.* FROM prediction_markets m
    WHERE EXISTS (SELECT 1 FROM prediction_bets b WHERE b.market_id=m.id AND b.discord_id=?)`);
  const credits = db.prepare(`SELECT t.market_id,t.amount FROM prediction_transactions t
    WHERE t.account_id=? AND t.kind IN ('settlement','correction')`);
  const read = id => {
    const ownBets = bets.all(id), ownMarkets = markets.all(id);
    return { account: account.get(id), bets: ownBets,
      metrics: summarize(ownBets, ownMarkets, credits.all(id)) };
  };
  const snapshot = fn => db.transaction(fn)();
  return {
    publicRows(consents, minimumGames) {
      return snapshot(() => consents.flatMap(consent => {
        const { account: stored, metrics } = read(consent.discordId);
        return stored && metrics.settledGames >= minimumGames ? [{ displayName: consent.displayName,
          netProfit: metrics.netProfit, settledGames: metrics.settledGames, winRate: metrics.winRate }] : [];
      }));
    }
  };
}

module.exports = { createPredictionRepository };
