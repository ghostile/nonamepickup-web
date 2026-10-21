"use strict";

// Intentionally fictional identities and amounts. No production import or lookup.
const names = ["Demo Scout", "Demo Medic", "Demo Engineer", "Demo Soldier", "Demo Sniper", "Demo Pyro", "Demo Spy", "Demo Heavy", "Demo Runner", "Demo Defender", "Demo Captain", "Demo Rookie"];
const publicRows = names.map((displayName, index) => ({ displayName,
  netProfit: [1840, 1275, 1275, 960, 715, 480, 320, 160, 0, -85, -210, -340][index],
  settledGames: 42 - index * 2, winRate: (28 - index) / (42 - index * 2) }));

module.exports = { publicRows };
