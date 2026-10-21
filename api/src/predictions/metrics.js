"use strict";

const safe = value => {
  if (!Number.isSafeInteger(value)) throw new Error("Unsafe prediction amount");
  return value;
};
const sum = values => values.reduce((total, value) => safe(total + safe(value)), 0);

// Monetary rows are intentionally selected, never the whole ledger. A bettor
// cannot be an official player on the same market under the bot's eligibility rule.
function summarize(bets, markets, credits) {
  const marketById = new Map(markets.map(market => [market.id, market]));
  const creditByMarket = new Map();
  for (const row of credits) creditByMarket.set(row.market_id,
    safe((creditByMarket.get(row.market_id) || 0) + safe(row.amount)));
  const settledIds = new Set();
  let correct = 0, decided = 0, finalized = 0, reviewGames = 0;
  const profits = [], reviewProfits = [];
  const history = bets.map(bet => {
    const market = marketById.get(bet.market_id);
    if (!market) throw new Error("Prediction market missing");
    const earned = bet.status === "settled" && market.settlement_version > 0;
    if (earned) {
      if (settledIds.has(market.match_id)) throw new Error("Ambiguous settled match revisions");
      settledIds.add(market.match_id);
    }
    const credited = creditByMarket.get(market.id) || 0;
    const net = earned ? safe(credited - safe(bet.stake)) : null;
    const allocation = market.allocation ? JSON.parse(market.allocation) : null;
    const refunded = earned && allocation?.pools?.length === 0;
    if (earned && market.state === "settled") {
      finalized++;
      profits.push(net);
      if (!refunded) {
        decided++;
        if (bet.pick === market.result) correct++;
      }
    } else if (earned) {
      reviewGames++;
      reviewProfits.push(net);
    }
    return { matchId: market.match_id, revision: market.revision,
      pick: bet.pick, stake: safe(bet.stake), credits: earned ? credited : null,
      netProfit: net, status: market.state === "review_required" ? "review_required" : bet.status,
      outcome: market.result || null, refunded, ruleVersion: market.rule_version,
      closesAt: market.closes_at, updatedAt: Math.max(bet.updated_at, market.closed_at || 0,
        market.latest_transaction_at || 0),
      marketState: market.state };
  }).sort((a, b) => b.updatedAt - a.updatedAt || b.revision - a.revision || a.matchId.localeCompare(b.matchId));
  const personalLimit = safe(100 + 10 * settledIds.size);
  return { netProfit: sum(profits), settledGames: finalized,
    progressionGames: settledIds.size, personalLimit,
    winRate: decided ? correct / decided : null, correct, decided,
    reviewGames, reviewNetProfit: sum(reviewProfits), history };
}

function standings(rows, { search = "", sort = "netProfit", direction = "desc", page = 1, pageSize = 20 } = {}) {
  const canonical = [...rows].sort((a, b) => b.netProfit - a.netProfit || a.displayName.localeCompare(b.displayName));
  let rank = 0, lastProfit;
  const ranked = canonical.map((row, index) => {
    if (index === 0 || row.netProfit !== lastProfit) rank = index + 1;
    lastProfit = row.netProfit;
    // Deliberate public allowlist: never spread repository/account objects here.
    return { rank, displayName: row.displayName, netProfit: row.netProfit,
      settledGames: row.settledGames, winRate: row.winRate };
  });
  const filtered = ranked.filter(row => row.displayName.toLowerCase().includes(search.toLowerCase()));
  const sign = direction === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    // Unknown win rate stays last in either direction.
    if (a[sort] === null || b[sort] === null) return a[sort] === b[sort] ? a.rank - b.rank : a[sort] === null ? 1 : -1;
    const compared = sort === "displayName" ? a.displayName.localeCompare(b.displayName) : a[sort] - b[sort];
    return compared * sign || a.rank - b.rank || a.displayName.localeCompare(b.displayName);
  });
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, pages);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total, pages };
}

module.exports = { safe, sum, summarize, standings };
