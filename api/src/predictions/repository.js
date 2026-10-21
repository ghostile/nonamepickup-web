"use strict";

const { safe, sum, summarize } = require("./metrics");

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
  const account = db.prepare("SELECT balance,updated_at FROM prediction_accounts WHERE discord_id=?");
  const bets = db.prepare("SELECT * FROM prediction_bets WHERE discord_id=?");
  const markets = db.prepare(`SELECT m.*,
    (SELECT MAX(t.created_at) FROM prediction_transactions t WHERE t.market_id=m.id) AS latest_transaction_at
    FROM prediction_markets m
    WHERE EXISTS (SELECT 1 FROM prediction_bets b WHERE b.market_id=m.id AND b.discord_id=?)`);
  const credits = db.prepare(`SELECT t.market_id,t.amount FROM prediction_transactions t
    WHERE t.account_id=? AND t.kind IN ('settlement','correction')`);
  const activityRows = db.prepare(`SELECT t.id,t.kind,t.amount,t.created_at,m.match_id,
    EXISTS(SELECT 1 FROM prediction_bets b WHERE b.market_id=t.market_id
      AND b.discord_id=t.account_id AND b.status='settled') AS is_bettor
    FROM prediction_transactions t LEFT JOIN prediction_markets m ON m.id=t.market_id
    WHERE t.account_id=? AND t.kind IN ('grant','stake','cancel','refund','settlement','correction','adjustment')
    ORDER BY t.created_at DESC,t.id DESC LIMIT ? OFFSET ?`);
  const activityCount = db.prepare(`SELECT COUNT(*) AS total FROM prediction_transactions
    WHERE account_id=? AND kind IN ('grant','stake','cancel','refund','settlement','correction','adjustment')`);
  const read = id => {
    const ownBets = bets.all(id), ownMarkets = markets.all(id);
    return { account: account.get(id), bets: ownBets,
      metrics: summarize(ownBets, ownMarkets, credits.all(id)) };
  };
  const snapshot = fn => db.transaction(fn)();
  return {
    activity(id, page, pageSize) {
      return snapshot(() => {
        const total = activityCount.get(id).total, pages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(page, pages);
        return { page, pageSize, pages, total, rows: activityRows.all(id, pageSize, (page - 1) * pageSize)
          .map(row => ({ kind: row.kind,
            category: row.kind === "settlement" ? (row.is_bettor ? "betting_return" : "player_reward") :
              row.kind === "correction" ? (row.is_bettor ? "betting_correction" : "player_correction") : row.kind,
            amount: safe(row.amount), createdAt: row.created_at, matchId: row.match_id || null })) };
      });
    },
    publicRows(consents, minimumGames) {
      return snapshot(() => consents.flatMap(consent => {
        const { account: stored, metrics } = read(consent.discordId);
        return stored && metrics.settledGames >= minimumGames ? [{ displayName: consent.displayName,
          netProfit: metrics.netProfit, settledGames: metrics.settledGames, winRate: metrics.winRate }] : [];
      }));
    },
    personal(id) {
      return snapshot(() => {
        const { account: stored, bets: ownBets, metrics } = read(id);
        const lockedPoints = sum(ownBets.filter(bet => bet.status === "active").map(bet => bet.stake));
        return { initialized: Boolean(stored), balance: stored ? safe(stored.balance) : null,
          lockedPoints, personalLimit: metrics.personalLimit, settledGames: metrics.progressionGames,
          finalizedGames: metrics.settledGames, netProfit: metrics.netProfit,
          reviewGames: metrics.reviewGames, reviewNetProfit: metrics.reviewNetProfit,
          winRate: metrics.winRate, updatedAt: stored?.updated_at || null,
          history: metrics.history.map(row => ({ ...row,
            gameLimit: row.ruleVersion === 1 ? 250 : metrics.personalLimit,
            availableStake: stored ? Math.min(safe(stored.balance), row.ruleVersion === 1 ? 250 : metrics.personalLimit) : 0 })) };
      });
    }
  };
}

module.exports = { createPredictionRepository };
