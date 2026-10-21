"use strict";

// Intentionally fictional identities and amounts. No production import or lookup.
const names = ["Demo Scout", "Demo Medic", "Demo Engineer", "Demo Soldier", "Demo Sniper", "Demo Pyro", "Demo Spy", "Demo Heavy", "Demo Runner", "Demo Defender", "Demo Captain", "Demo Rookie"];
const publicRows = names.map((displayName, index) => ({ displayName,
  netProfit: [1840, 1275, 1275, 960, 715, 480, 320, 160, 0, -85, -210, -340][index],
  settledGames: 42 - index * 2, winRate: (28 - index) / (42 - index * 2) }));

function previewPersonal() {
  const now = Date.now();
  return { initialized: true, displayName: "Demo Scout", balance: 2840, lockedPoints: 120,
    personalLimit: 520, settledGames: 42, finalizedGames: 41, netProfit: 1840,
    reviewGames: 1, reviewNetProfit: 35, winRate: 28 / 41, updatedAt: now,
    history: [
      { matchId: "DEMO-108", pick: "blue", stake: 120, credits: null, netProfit: null,
        status: "active", marketState: "countdown", outcome: null, closesAt: now + 90000, ruleVersion: 2 },
      { matchId: "DEMO-107", pick: "red", stake: 100, credits: 135, netProfit: 35,
        status: "review_required", marketState: "review_required", outcome: "red", ruleVersion: 2 },
      { matchId: "DEMO-106", pick: "blue", stake: 100, credits: 265, netProfit: 165,
        status: "settled", marketState: "settled", outcome: "blue", ruleVersion: 2 },
      { matchId: "DEMO-105", pick: "tie", stake: 80, credits: 0, netProfit: -80,
        status: "settled", marketState: "settled", outcome: "red", ruleVersion: 2 },
      { matchId: "DEMO-104", pick: "red", stake: 150, credits: 150, netProfit: 0,
        status: "settled", marketState: "settled", outcome: "blue", refunded: true, ruleVersion: 1 },
      { matchId: "DEMO-103", pick: "blue", stake: 100, credits: null, netProfit: null,
        status: "refunded", marketState: "void", outcome: null, ruleVersion: 1 }
    ].map((row, index) => ({ revision: 1, refunded: false, closesAt: null,
      updatedAt: now - index * 86400000, gameLimit: row.ruleVersion === 1 ? 250 : 520,
      availableStake: row.ruleVersion === 1 ? 250 : 520, ...row })) };
}

function previewActivity() {
  return [
    { kind: "stake", amount: -120, matchId: "DEMO-108" },
    { kind: "correction", category: "betting_correction", amount: 35, matchId: "DEMO-107" },
    { kind: "settlement", category: "betting_return", amount: 265, matchId: "DEMO-106" },
    { kind: "settlement", category: "player_reward", amount: 45, matchId: "DEMO-PLAYER-REWARD" },
    { kind: "refund", amount: 100, matchId: "DEMO-103" },
    { kind: "adjustment", amount: 50, matchId: null },
    { kind: "grant", amount: 1000, matchId: null }
  ].map((row, index) => ({ category: row.kind, ...row, createdAt: Date.now() - index * 86400000 }));
}
module.exports = { publicRows, previewPersonal, previewActivity };
